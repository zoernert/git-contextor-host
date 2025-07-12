const QdrantCollection = require('../models/QdrantCollection');
const Tunnel = require('../models/Tunnel');
const { nanoid } = require('nanoid');

class QdrantTunnelManager {
    constructor() {
        this.qdrantTunnels = new Map(); // connectionId -> tunnel info
        this.connections = new Map(); // connectionId -> connection info
    }

    /**
     * Create a dedicated tunnel for Qdrant collection access
     */
    async createQdrantTunnel(userId, collectionId, description = 'Qdrant Collection Access') {
        try {
            const collection = await QdrantCollection.findOne({ 
                _id: collectionId, 
                userId, 
                isActive: true 
            });

            if (!collection) {
                throw new Error('Collection not found or access denied');
            }

            // Create unique tunnel path for this collection
            const tunnelPath = `qdrant-${collection.name}-${nanoid(8)}`;
            
            // Use a special port for Qdrant proxy (we'll proxy to actual Qdrant internally)
            const proxyPort = 6333; // Standard Qdrant port
            
            // Create tunnel record
            const tunnel = new Tunnel({
                userId,
                subdomain: `qdrant-${nanoid(8)}`, // Required field for backward compatibility
                tunnelPath,
                localPort: proxyPort,
                targetHost: 'qdrant-proxy',
                description: `${description} - Collection: ${collection.name}`,
                connectionId: nanoid(),
                isActive: true,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                metadata: {
                    type: 'qdrant',
                    collectionId: collection._id,
                    collectionName: collection.name
                }
            });

            await tunnel.save();

            // Store tunnel info for connection handling
            this.qdrantTunnels.set(tunnel.connectionId, {
                tunnel,
                collection,
                userId
            });

            return {
                tunnelId: tunnel._id,
                connectionId: tunnel.connectionId,
                tunnelPath: tunnel.tunnelPath,
                url: `${process.env.TUNNEL_BASE_URL || 'https://tunnel.corrently.cloud'}/tunnel/${tunnel.tunnelPath}`,
                qdrantUrl: `${process.env.TUNNEL_BASE_URL || 'https://tunnel.corrently.cloud'}/qdrant/${tunnel.tunnelPath}`,
                collection: {
                    id: collection._id,
                    name: collection.name,
                    collectionName: collection.collectionName
                },
                connectionInfo: {
                    host: (process.env.TUNNEL_BASE_URL || 'https://tunnel.corrently.cloud').replace('https://', ''),
                    port: 443,
                    https: true,
                    apiKey: await this.generateCollectionApiKey(collection._id),
                    path: `/qdrant/${tunnel.tunnelPath}`,
                    url: `${process.env.TUNNEL_BASE_URL || 'https://tunnel.corrently.cloud'}/qdrant/${tunnel.tunnelPath}`
                },
                expiresAt: tunnel.expiresAt
            };
        } catch (error) {
            console.error('Error creating Qdrant tunnel:', error);
            throw error;
        }
    }

    /**
     * Get connection information for a collection
     */
    async getCollectionConnectionInfo(userId, collectionId) {
        try {
            const collection = await QdrantCollection.findOne({ 
                _id: collectionId, 
                userId, 
                isActive: true 
            });

            if (!collection) {
                throw new Error('Collection not found');
            }

            // Find active tunnel for this collection
            const tunnel = await Tunnel.findOne({
                userId,
                'metadata.collectionId': collectionId,
                isActive: true,
                expiresAt: { $gt: new Date() }
            });

            if (!tunnel) {
                throw new Error('No active tunnel found for this collection');
            }

            return {
                host: (process.env.TUNNEL_BASE_URL || 'https://tunnel.corrently.cloud').replace('https://', ''),
                port: 443,
                https: true,
                url: `${process.env.TUNNEL_BASE_URL || 'https://tunnel.corrently.cloud'}/qdrant/${tunnel.tunnelPath}`,
                apiKey: await this.generateCollectionApiKey(collectionId),
                path: `/qdrant/${tunnel.tunnelPath}`,
                collection: {
                    name: collection.name,
                    internalName: collection.collectionName
                },
                usage: {
                    host: (process.env.TUNNEL_BASE_URL || 'https://tunnel.corrently.cloud').replace('https://', ''),
                    port: 443,
                    https: true,
                    apiKey: await this.generateCollectionApiKey(collectionId)
                }
            };
        } catch (error) {
            console.error('Error getting collection connection info:', error);
            throw error;
        }
    }

    /**
     * Generate API key for collection access
     */
    async generateCollectionApiKey(collectionId) {
        // For now, we'll use a combination of collection ID and a secret
        // In production, you might want to store these in the database
        const crypto = require('crypto');
        const secret = process.env.QDRANT_COLLECTION_SECRET || 'default-secret';
        return crypto.createHash('sha256')
            .update(`${collectionId}:${secret}`)
            .digest('hex');
    }

    /**
     * Verify collection API key
     */
    async verifyCollectionApiKey(apiKey, collectionId) {
        const expectedKey = await this.generateCollectionApiKey(collectionId);
        return apiKey === expectedKey;
    }

    /**
     * Handle Qdrant tunnel connection
     */
    async handleQdrantConnection(connectionId, socket) {
        const tunnelInfo = this.qdrantTunnels.get(connectionId);
        
        if (!tunnelInfo) {
            throw new Error('Invalid Qdrant tunnel connection');
        }

        console.log(`[QdrantTunnel] Connection established for collection: ${tunnelInfo.collection.name}`);
        
        // Store connection info
        this.connections.set(connectionId, {
            socket,
            tunnelInfo,
            type: 'qdrant',
            connectedAt: new Date()
        });

        // Handle socket events
        socket.on('disconnect', () => {
            console.log(`[QdrantTunnel] Connection closed for collection: ${tunnelInfo.collection.name}`);
            this.connections.delete(connectionId);
        });

        socket.on('error', (error) => {
            console.error(`[QdrantTunnel] Socket error for collection ${tunnelInfo.collection.name}:`, error);
        });
    }

    /**
     * Get all Qdrant tunnels for a user
     */
    async getUserQdrantTunnels(userId) {
        try {
            const tunnels = await Tunnel.find({
                userId,
                'metadata.type': 'qdrant',
                isActive: true,
                expiresAt: { $gt: new Date() }
            });

            return tunnels.map(tunnel => ({
                tunnelId: tunnel._id,
                connectionId: tunnel.connectionId,
                tunnelPath: tunnel.tunnelPath,
                url: `${process.env.TUNNEL_BASE_URL || 'https://tunnel.corrently.cloud'}/qdrant/${tunnel.tunnelPath}`,
                collection: {
                    name: tunnel.metadata.collectionName,
                    id: tunnel.metadata.collectionId
                },
                isActive: tunnel.isActive,
                expiresAt: tunnel.expiresAt,
                createdAt: tunnel.createdAt
            }));
        } catch (error) {
            console.error('Error getting user Qdrant tunnels:', error);
            throw error;
        }
    }

    /**
     * Delete Qdrant tunnel
     */
    async deleteQdrantTunnel(userId, tunnelId) {
        try {
            const tunnel = await Tunnel.findOne({
                _id: tunnelId,
                userId,
                'metadata.type': 'qdrant'
            });

            if (!tunnel) {
                throw new Error('Tunnel not found');
            }

            // Remove from active connections
            this.qdrantTunnels.delete(tunnel.connectionId);
            this.connections.delete(tunnel.connectionId);

            // Mark as inactive
            tunnel.isActive = false;
            await tunnel.save();

            return true;
        } catch (error) {
            console.error('Error deleting Qdrant tunnel:', error);
            throw error;
        }
    }
}

module.exports = QdrantTunnelManager;
