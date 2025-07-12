const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const dotenv = require('dotenv');
const helmet = require('helmet');
const cors = require('cors');
const connectDB = require('./config/database');
const TunnelManager = require('./services/TunnelManager');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Initialize services
const QdrantProxyMiddleware = require('./middleware/qdrantProxy');
const qdrantProxy = new QdrantProxyMiddleware();

// Handle WebSocket connections
wss.on('connection', (ws) => {
    TunnelManager.handleConnection(ws);
});

// Proxy requests to tunnel clients before any body parsers
const getRawBody = require('raw-body');
const Tunnel = require('./models/Tunnel');

// Path-based tunnel proxy middleware
app.use('/tunnel/:tunnelPath(*)', async (req, res, next) => {
    const tunnelPath = req.params.tunnelPath;
    
    try {
        const tunnel = await Tunnel.findOne({ tunnelPath, isActive: true });
        if (!tunnel) {
            return res.status(404).json({ 
                error: 'Tunnel not found',
                message: `Tunnel '${tunnelPath}' not found or is not active.`
            });
        }

        // Get raw body for proxying
        req.body = await getRawBody(req);
        
        // Proxy the request to the tunnel client
        TunnelManager.proxyRequest(tunnel.connectionId, req, res);

    } catch (err) {
        console.error('Tunnel proxy error:', err.message);
        res.status(500).json({ 
            error: 'Proxy Error',
            message: 'Internal server error during tunnel proxying.'
        });
    }
});

// Qdrant proxy middleware for direct API access
app.use('/qdrant/:tunnelPath(*)', async (req, res, next) => {
    const tunnelPath = req.params.tunnelPath;
    
    try {
        const tunnel = await Tunnel.findOne({ 
            tunnelPath, 
            isActive: true,
            'metadata.type': 'qdrant'
        });
        
        if (!tunnel) {
            return res.status(404).json({ 
                error: 'Qdrant tunnel not found',
                message: `Qdrant tunnel '${tunnelPath}' not found or is not active.`
            });
        }

        // Parse JSON body for Qdrant API calls
        if (req.headers['content-type'] === 'application/json') {
            req.body = JSON.parse(await getRawBody(req));
        }

        // Use Qdrant proxy middleware
        await qdrantProxy.proxyRequest(req, res, next);

    } catch (err) {
        console.error('Qdrant proxy error:', err.message);
        res.status(500).json({ 
            error: 'Qdrant Proxy Error',
            message: 'Internal server error during Qdrant proxying.'
        });
    }
});

// Legacy subdomain support (for backward compatibility)
app.use(async (req, res, next) => {
    // Skip API requests and tunnel paths
    if (req.path.startsWith('/api/') || req.path.startsWith('/tunnel/') || req.path === '/') {
        return next();
    }

    const host = req.get('host');
    const tunnelDomain = process.env.TUNNEL_DOMAIN;

    // Check if it's a request to a tunnel subdomain (legacy support)
    if (host && tunnelDomain && host.endsWith(`.${tunnelDomain}`)) {
        const subdomain = host.substring(0, host.length - tunnelDomain.length - 1);
        
        try {
            const tunnel = await Tunnel.findOne({ subdomain, isActive: true });
            if (!tunnel) {
                return res.status(404).json({ msg: `Legacy tunnel for ${host} not found or is not active.` });
            }

            req.body = await getRawBody(req);
            TunnelManager.proxyRequest(tunnel.connectionId, req, res);

        } catch (err) {
            console.error('Legacy tunnel proxy error:', err.message);
            res.status(500).send('Internal Server Error during legacy tunnel proxying.');
        }
    } else {
        next();
    }
});

// Stripe webhook needs raw body, so we add it before the general JSON parser
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }));

// Body parser
app.use(express.json());

// Security headers
app.use(helmet());

// Enable CORS
app.use(cors());

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', mode: 'path-based-tunnels' });
});

// Mount routers
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tunnels', require('./routes/tunnels'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/qdrant', require('./routes/qdrant'));

// Serve static files from admin-ui/dist
app.use(express.static(path.join(__dirname, '../admin-ui/dist')));

// Handle React Router - serve index.html for non-API routes
app.get('*', (req, res, next) => {
  // Skip API routes and tunnel paths
  if (req.path.startsWith('/api/') || req.path.startsWith('/tunnel/')) {
    return next();
  }
  
  // Skip tunnel subdomain requests (legacy)
  const host = req.get('host');
  const tunnelDomain = process.env.TUNNEL_DOMAIN;
  if (host && tunnelDomain && host.endsWith(`.${tunnelDomain}`)) {
    return next();
  }
  
  // Serve index.html for all other routes (React Router)
  res.sendFile(path.join(__dirname, '../admin-ui/dist/index.html'));
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => console.log(`Server running on port ${PORT} with path-based tunnels`));
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`Error: ${err.message}`);
  server.close(() => process.exit(1));
});

module.exports = app;
