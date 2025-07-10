const User = require('../models/User');
const Tunnel = require('../models/Tunnel');
const { generateSubdomain } = require('../utils/subdomain');
const { v4: uuidv4 } = require('uuid');
const NginxManager = require('./NginxManager');

const nginxManager = new NginxManager(
    process.env.NGINX_PROXY_MANAGER_API_URL,
    process.env.NGINX_PROXY_MANAGER_API_KEY
);

// Core tunneling logic
class TunnelManager {
  constructor() {
    this.connections = new Map(); // Map<connectionId, WebSocket>
  }
  async createTunnel(userId, localPort, options = {}) {
    // 1. Validate user subscription and limits
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }
    // TODO: Add actual plan-based limits check from subscription model
    const existingTunnels = await Tunnel.countDocuments({ userId, isActive: true });
    if (existingTunnels >= 5) { // Mock limit, should be based on user.plan
        throw new Error('Tunnel limit reached for your plan.');
    }

    // 2. Generate unique subdomain
    const subdomain = await generateSubdomain(options.requestedSubdomain);

    // 3. Create Nginx proxy configuration (mocked)
    const proxyConfig = await nginxManager.createProxyHost(subdomain, localPort);

    // 4. Connection ID for WebSocket client to identify itself
    const connectionId = uuidv4();

    // 5. Store tunnel in database
    const tunnel = new Tunnel({
        userId,
        localPort,
        subdomain,
        connectionId,
        proxyHostId: proxyConfig.id,
        metadata: options.metadata || {},
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours expiry
        targetHost: 'localhost', // The client will connect to this service, so target is here.
        protocol: proxyConfig.scheme
    });

    await tunnel.save();

    // 6. Return tunnel details
    return tunnel.toObject();
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

  handleConnection(ws) {
    // The client should send its connectionId immediately upon connection.
    ws.once('message', async (message) => {
        try {
            const data = JSON.parse(message);
            const { connectionId } = data;

            if (!connectionId) {
                ws.terminate();
                return;
            }

            const tunnel = await Tunnel.findOne({ connectionId, isActive: true });
            if (!tunnel) {
                console.log(`[TunnelManager] Invalid or inactive tunnel for connectionId: ${connectionId}`);
                ws.terminate();
                return;
            }
            
            console.log(`[TunnelManager] Client connected for tunnel: ${tunnel.subdomain}`);
            this.connections.set(connectionId, ws);
            
            ws.on('close', () => {
                console.log(`[TunnelManager] Client disconnected for tunnel: ${tunnel.subdomain}`);
                this.connections.delete(connectionId);
            });
            
            ws.on('error', (err) => {
                 console.error(`[TunnelManager] WebSocket error for ${tunnel.subdomain}:`, err);
                 this.connections.delete(connectionId);
            });

            // Actual data proxying logic would go here.

        } catch (err) {
            console.error('[TunnelManager] Error processing auth message from client:', err);
            ws.terminate();
        }
    });
  }
}

module.exports = new TunnelManager();
