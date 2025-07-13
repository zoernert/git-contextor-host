const User = require('../models/User');
const QdrantCollection = require('../models/QdrantCollection');
const QdrantService = require('../services/QdrantService');
const { QdrantClient } = require('@qdrant/js-client-rest');

class QdrantProxyMiddleware {
    constructor() {
        this.actualQdrantClient = QdrantService.mock ? null : new QdrantClient({
            url: process.env.QDRANT_URL,
            apiKey: process.env.QDRANT_API_KEY,
        });
    }

    /**
     * Authenticate user and get their collections
     */
    async authenticateUser(apiKey) {
        try {
            const user = await User.findOne({ apiKey, isActive: true });
            if (!user) {
                throw new Error('Invalid API key');
            }

            const collections = await QdrantCollection.find({ 
                userId: user._id, 
                isActive: true 
            });

            return { user, collections };
        } catch (error) {
            throw new Error('Authentication failed');
        }
    }

    /**
     * Proxy request to Qdrant API with collection-specific access control
     */
    async proxyRequest(req, res, next) {
        try {
            // Extract collection ID from path
            const collectionId = req.params.collectionId;
            if (!collectionId) {
                return res.status(400).json({ error: 'Collection ID is required' });
            }

            // Get API key from header
            const apiKey = req.headers['api-key'] || req.headers['authorization']?.replace('Bearer ', '');
            if (!apiKey) {
                return res.status(401).json({ error: 'API key is required' });
            }

            // Authenticate user and get their collections
            const { user, collections } = await this.authenticateUser(apiKey);
            
            // Find the specific collection
            const collection = collections.find(c => c._id.toString() === collectionId);
            if (!collection) {
                return res.status(404).json({ error: 'Collection not found or access denied' });
            }

            // Handle different API paths
            const apiPath = req.params[0] || '';
            
            if (this.actualQdrantClient) {
                // Forward to actual Qdrant service
                await this.forwardToQdrant(req, res, collection, apiPath);
            } else {
                // Mock mode
                res.json({ 
                    status: 'ok', 
                    mode: 'mock',
                    collection: collection.name,
                    path: apiPath
                });
            }
        } catch (error) {
            console.error('Qdrant proxy error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Forward request to actual Qdrant service
     */
    async forwardToQdrant(req, res, collection, apiPath) {
        try {
            const method = req.method.toLowerCase();
            const internalCollectionName = collection.collectionName;
            
            // Map common API paths
            let qdrantPath = '';
            if (apiPath.startsWith('collections')) {
                qdrantPath = apiPath.replace(/^collections\/[^\/]+/, `collections/${internalCollectionName}`);
            } else if (apiPath.startsWith('points')) {
                qdrantPath = `collections/${internalCollectionName}/${apiPath}`;
            } else {
                qdrantPath = `collections/${internalCollectionName}/${apiPath}`;
            }

            // Execute the appropriate Qdrant client method
            let result;
            switch (method) {
                case 'get':
                    if (qdrantPath.includes('/points/search')) {
                        result = await this.actualQdrantClient.search(internalCollectionName, req.body || {});
                    } else if (qdrantPath.includes('/points')) {
                        result = await this.actualQdrantClient.retrieve(internalCollectionName, req.body || {});
                    } else {
                        result = await this.actualQdrantClient.getCollection(internalCollectionName);
                    }
                    break;
                case 'post':
                    if (qdrantPath.includes('/points/search')) {
                        result = await this.actualQdrantClient.search(internalCollectionName, req.body);
                    } else if (qdrantPath.includes('/points')) {
                        result = await this.actualQdrantClient.upsert(internalCollectionName, req.body);
                    }
                    break;
                case 'put':
                    result = await this.actualQdrantClient.upsert(internalCollectionName, req.body);
                    break;
                case 'delete':
                    if (qdrantPath.includes('/points')) {
                        result = await this.actualQdrantClient.delete(internalCollectionName, req.body);
                    }
                    break;
                default:
                    return res.status(405).json({ error: 'Method not allowed' });
            }

            res.json(result);
        } catch (error) {
            console.error('Qdrant forwarding error:', error);
            res.status(500).json({ error: 'Failed to process request' });
        }
    }
}

module.exports = QdrantProxyMiddleware;
