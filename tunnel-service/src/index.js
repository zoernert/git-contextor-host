const express = require('express');
const http = require('http');
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

// Handle WebSocket connections
wss.on('connection', (ws) => {
    TunnelManager.handleConnection(ws);
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
    res.json({ status: 'ok' });
});

// Mount routers
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tunnels', require('./routes/tunnels'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/qdrant', require('./routes/qdrant'));

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`Error: ${err.message}`);
  server.close(() => process.exit(1));
});

module.exports = app;
