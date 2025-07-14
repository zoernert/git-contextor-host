const User = require('../models/User');
const Tunnel = require('../models/Tunnel');
const { generateTunnelPath, generateSubdomain } = require('../utils/tunnelPath');
const { v4: uuidv4 } = require('uuid');
const NginxManager = require('./NginxManager');
const UsageTracker = require('./UsageTracker');

const nginxManager = new NginxManager(
    process.env.NGINX_PROXY_MANAGER_API_URL,
    process.env.NGINX_PROXY_MANAGER_API_KEY
);

// Core tunneling logic
class TunnelManager {
  constructor() {
    this.connections = new Map(); // Map<connectionId, WebSocket>
    this.httpRequests = new Map(); // Map<requestId, http.ServerResponse>
  }
  async createTunnel(userId, localPort, options = {}) {
    // 1. Validate user exists (subscription limits are checked in middleware)
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }

    // 2. Generate unique tunnelPath and subdomain (for backward compatibility)
    const tunnelPath = await generateTunnelPath(options.requestedPath);
    const subdomain = await generateSubdomain(options.requestedSubdomain);

    // 3. Skip Nginx proxy configuration for path-based tunnels
    const proxyConfig = { id: null, scheme: "https" };

    // 4. Generate connection ID
    const connectionId = uuidv4();

    // 5. Create tunnel in database
    const tunnel = new Tunnel({
        userId,
        subdomain, // Keep for backward compatibility
        tunnelPath, // New path-based identifier
        localPort,
        connectionId,
        proxyHostId: proxyConfig.id,
        metadata: options.metadata || {},
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours expiry
        targetHost: 'localhost',
        protocol: proxyConfig.scheme
    });

    await tunnel.save();

    // 6. Return tunnel details with proper URL format
    const baseUrl = process.env.TUNNEL_BASE_URL || 'https://tunnel.corrently.cloud';
    
    return {
        id: tunnel._id.toString(),         // Database ID for internal use
        tunnelPath: tunnel.tunnelPath,     // URL path identifier
        connectionId: tunnel.connectionId, // WebSocket connection ID
        url: `${baseUrl}/tunnel/${tunnel.tunnelPath}`, // Complete tunnel URL
        localPort: tunnel.localPort,
        subdomain: tunnel.subdomain,       // Legacy compatibility
        isActive: tunnel.isActive,
        expiresAt: tunnel.expiresAt,
        createdAt: tunnel.createdAt
    };
  }

  async destroyTunnel(tunnelId, userId) {
    const tunnel = await Tunnel.findOne({ _id: tunnelId, userId });

    if (!tunnel) {
        throw new Error('Tunnel not found or permission denied.');
    }

    if (tunnel.proxyHostId) {
      await nginxManager.deleteProxyHost(tunnel.proxyHostId);
    }

    tunnel.isActive = false;
    await tunnel.save();

    const connection = this.connections.get(tunnel.connectionId);
    if (connection) {
        connection.terminate();
        this.connections.delete(tunnel.connectionId);
    }

    return { msg: 'Tunnel destroyed' };
  }

  async proxyRequest(connectionId, req, res) {
    const ws = this.connections.get(connectionId);
    if (!ws || ws.readyState !== ws.OPEN) {
        return res.status(502).send('Bad Gateway: Tunnel client not connected.');
    }
    
    const requestBody = req.body; // Buffer from raw-body

    // Check usage and track it
    const canTransfer = await UsageTracker.canTransfer(ws.userId, requestBody.length);
    if (!canTransfer) {
        res.status(403).send('Data transfer limit reached.');
        ws.terminate(); // Terminate the tunnel connection
        return;
    }
    if(requestBody.length > 0) {
        await UsageTracker.trackData({ _id: ws.tunnelId, userId: ws.userId }, requestBody.length);
    }

    const requestId = uuidv4();
    this.httpRequests.set(requestId, res);

    // Clean up if the client closes the connection before we get a response
    req.on('close', () => {
        this.httpRequests.delete(requestId);
    });

    // Extract the path that should be forwarded to the tunnel client
    // The req.tunnelPath is set by the routing middleware
    const forwardPath = req.tunnelPath || '/';

    const requestData = {
        type: 'http-request',
        data: {
            id: requestId,
            method: req.method,
            path: forwardPath,
            headers: req.headers,
            body: requestBody.length > 0 ? requestBody.toString('base64') : null
        }
    };

    ws.send(JSON.stringify(requestData));
  }

  async handleTunnelResponse(message, ws) {
    try {
        const data = JSON.parse(message);
        if (data.type === 'http-response' && data.data && data.data.id) {
            const res = this.httpRequests.get(data.data.id);
            if (res) {
                const responseBody = data.data.body ? Buffer.from(data.data.body, 'base64') : Buffer.alloc(0);
                // Check usage and track it
                const canTransfer = await UsageTracker.canTransfer(ws.userId, responseBody.length);
                if (!canTransfer) {
                    res.status(403).send('Data transfer limit reached during response.');
                    this.httpRequests.delete(data.data.id);
                    ws.terminate();
                    return;
                }
                if (responseBody.length > 0) {
                   await UsageTracker.trackData({ _id: ws.tunnelId, userId: ws.userId }, responseBody.length);
                }

                this.httpRequests.delete(data.data.id);
                res.status(data.data.status || 200);
                res.set(data.data.headers || {});
                res.send(responseBody);
            }
        } else if (data.type === 'ping') {
            // Handle ping messages
            ws.send(JSON.stringify({ type: 'pong' }));
        }
    } catch (err) {
        console.error(`[TunnelManager] Error processing response from client:`, err);
    }
  }

  async handleConnection(ws, connectionId) {
    // Use the provided connectionId from the WebSocket server
    if (!connectionId) {
        console.log(`[TunnelManager] No connectionId provided`);
        ws.terminate();
        return;
    }

    // Find the tunnel by connectionId
    try {
        const tunnel = await Tunnel.findOne({ connectionId, isActive: true });
        if (!tunnel) {
            console.log(`[TunnelManager] Invalid or inactive tunnel for connectionId: ${connectionId}`);
            ws.terminate();
            return;
        }
        
        console.log(`[TunnelManager] Client connected for tunnel: ${tunnel.tunnelPath}`);
        ws.tunnelId = tunnel.id;
        ws.userId = tunnel.userId;
        this.connections.set(connectionId, ws);
        
        // Handle responses from the tunnel client
        ws.on('message', (responseMsg) => this.handleTunnelResponse(responseMsg, ws));

        ws.on('close', () => {
            console.log(`[TunnelManager] Client disconnected for tunnel: ${tunnel.tunnelPath}`);
            this.connections.delete(connectionId);
        });
        
        ws.on('error', (err) => {
             console.error(`[TunnelManager] WebSocket error for ${tunnel.tunnelPath}:`, err);
             this.connections.delete(connectionId);
        });
    } catch (err) {
        console.error('[TunnelManager] Error finding tunnel:', err);
        ws.terminate();
    }
  }
}

module.exports = new TunnelManager();
