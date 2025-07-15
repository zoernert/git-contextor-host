const User = require('../models/User');
const QdrantCollection = require('../models/QdrantCollection');
const QdrantService = require('../services/QdrantService');
const { QdrantClient } = require('@qdrant/js-client-rest');

class QdrantProxyMiddleware {
    constructor() {
        // Create direct Qdrant client for proxy operations
        if (process.env.QDRANT_URL) {
            this.qdrantClient = new QdrantClient({
                url: process.env.QDRANT_URL,
                apiKey: process.env.QDRANT_API_KEY,
                checkCompatibility: false, // Skip version compatibility check
            });
        } else {
            this.qdrantClient = null; // Mock mode
        }
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
            console.log(`[QdrantProxy] Processing request: ${req.method} ${req.path}`);
            
            // Extract collection identifier from path (supports UUID, name, or ObjectId)
            const collectionIdentifier = req.params.collectionId;
            if (!collectionIdentifier) {
                console.log('[QdrantProxy] Missing collection identifier');
                return res.status(400).json({ error: 'Collection identifier is required' });
            }
            console.log(`[QdrantProxy] Collection identifier: ${collectionIdentifier}`);

            // Get API key from header
            const apiKey = req.headers['api-key'] || req.headers['authorization']?.replace('Bearer ', '');
            if (!apiKey) {
                console.log('[QdrantProxy] Missing API key');
                return res.status(401).json({ error: 'API key is required' });
            }

            // Authenticate user with timeout
            console.log('[QdrantProxy] Authenticating user...');
            const { user } = await Promise.race([
                this.authenticateUser(apiKey),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Authentication timeout')), 5000))
            ]);
            console.log(`[QdrantProxy] User authenticated: ${user._id}`);
            
            // Find the specific collection by identifier (UUID, name, or ObjectId)
            console.log('[QdrantProxy] Looking up collection...');
            const collection = await Promise.race([
                QdrantCollection.findByIdentifier(collectionIdentifier, user._id),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Collection lookup timeout')), 5000))
            ]);
            
            if (!collection) {
                console.log('[QdrantProxy] Collection not found');
                return res.status(404).json({ error: 'Collection not found or access denied' });
            }
            console.log(`[QdrantProxy] Collection found: ${collection.name} (${collection.uuid})`);

            // Handle different API paths
            const apiPath = req.params[0] || '';
            console.log(`[QdrantProxy] API path: ${apiPath}`);
            
            if (this.qdrantClient) {
                // Forward to actual Qdrant service
                console.log('[QdrantProxy] Forwarding to actual Qdrant...');
                await this.forwardToQdrant(req, res, collection, apiPath);
            } else {
                // Mock mode
                console.log('[QdrantProxy] Using mock mode');
                return res.json({ 
                    status: 'ok', 
                    mode: 'mock',
                    collection: collection.name,
                    path: apiPath,
                    message: 'Operation completed in mock mode'
                });
            }
        } catch (error) {
            console.error('[QdrantProxy] Error:', error.message);
            if (error.message.includes('timeout')) {
                return res.status(504).json({ error: 'Request timeout' });
            }
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
            console.log(`[QdrantProxy] Executing ${method.toUpperCase()} ${qdrantPath}`);
            
            switch (method) {
                case 'get':
                    if (qdrantPath.includes('/points/search')) {
                        result = await this.qdrantClient.search(internalCollectionName, req.body || {});
                    } else if (qdrantPath.includes('/points')) {
                        result = await this.qdrantClient.retrieve(internalCollectionName, req.body || {});
                    } else {
                        result = await this.qdrantClient.getCollection(internalCollectionName);
                    }
                    break;
                case 'post':
                    if (qdrantPath.includes('/points/search')) {
                        result = await this.qdrantClient.search(internalCollectionName, req.body);
                    } else if (qdrantPath.includes('/points/upsert')) {
                        // Fix: Use correct upsert method signature
                        console.log(`[QdrantProxy] Upserting ${req.body.points?.length || 0} points to collection: ${internalCollectionName}`);
                        console.log(`[QdrantProxy] Request body:`, JSON.stringify(req.body, null, 2));
                        
                        try {
                            // Use the correct upsert method signature from QdrantClient
                            result = await this.qdrantClient.upsert(internalCollectionName, {
                                wait: req.body.wait || true,
                                points: req.body.points || []
                            });
                            console.log(`[QdrantProxy] Upsert successful:`, result);
                        } catch (error) {
                            console.error(`[QdrantProxy] Upsert error:`, error);
                            console.error(`[QdrantProxy] Error details:`, {
                                name: error.name,
                                message: error.message,
                                stack: error.stack?.split('\n').slice(0, 3).join('\n'),
                                response: error.response?.data
                            });
                            throw error;
                        }
                    } else if (qdrantPath.includes('/points')) {
                        result = await this.qdrantClient.upsert(internalCollectionName, req.body);
                    }
                    break;
                case 'put':
                    result = await this.qdrantClient.upsert(internalCollectionName, req.body);
                    break;
                case 'delete':
                    if (qdrantPath.includes('/points')) {
                        result = await this.qdrantClient.delete(internalCollectionName, req.body);
                    }
                    break;
                default:
                    return res.status(405).json({ error: 'Method not allowed' });
            }

            res.json(result);
        } catch (error) {
            console.error('Qdrant forwarding error:', error);
            console.error('Request details:', {
                method: req.method,
                path: apiPath,
                collection: collection.collectionName,
                bodyKeys: Object.keys(req.body || {})
            });
            res.status(500).json({ 
                error: 'Failed to process request',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined,
                qdrantError: error.response?.data || error.toString()
            });
        }
    }
}

module.exports = QdrantProxyMiddleware;
