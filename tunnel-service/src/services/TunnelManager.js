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
    // 1. Validate ownership
    // 2. Remove Nginx configuration
    // 3. Close WebSocket connections
    // 4. Update database
  }

  async handleConnection(socket, authToken) {
    // WebSocket connection handler for tunnel data
  }
}

module.exports = new TunnelManager();
