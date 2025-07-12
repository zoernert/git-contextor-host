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
     * Map user collection name to internal collection name
     */
    mapCollectionName(userCollectionName, userId, userCollections) {
        // Find the collection by user-friendly name
        const collection = userCollections.find(c => c.name === userCollectionName);
        if (!collection) {
            throw new Error(`Collection '${userCollectionName}' not found`);
        }
        return collection.collectionName; // Returns user-{userId}-{name}
    }

    /**
     * Map internal collection name back to user collection name
     */
    reverseMapCollectionName(internalCollectionName, userId, userCollections) {
        const collection = userCollections.find(c => c.collectionName === internalCollectionName);
        return collection ? collection.name : internalCollectionName;
    }

    /**
     * Rewrite request body to use internal collection names
     */
    rewriteRequestBody(body, userId, userCollections) {
        if (!body) return body;

        const rewrittenBody = JSON.parse(JSON.stringify(body));

        // Handle different Qdrant API endpoints
        if (rewrittenBody.collection_name) {
            rewrittenBody.collection_name = this.mapCollectionName(
                rewrittenBody.collection_name, 
                userId, 
                userCollections
            );
        }

        // Handle batch operations
        if (rewrittenBody.batch && Array.isArray(rewrittenBody.batch)) {
            rewrittenBody.batch = rewrittenBody.batch.map(item => {
                if (item.collection_name) {
                    item.collection_name = this.mapCollectionName(
                        item.collection_name, 
                        userId, 
                        userCollections
                    );
                }
                return item;
            });
        }

        return rewrittenBody;
    }

    /**
     * Rewrite response body to use user collection names
     */
    rewriteResponseBody(body, userId, userCollections) {
        if (!body) return body;

        const rewrittenBody = JSON.parse(JSON.stringify(body));

        // Handle collections list response
        if (rewrittenBody.result && rewrittenBody.result.collections) {
            rewrittenBody.result.collections = rewrittenBody.result.collections
                .filter(collection => {
                    // Only show collections that belong to this user
                    return collection.name.startsWith(`user-${userId}-`);
                })
                .map(collection => ({
                    ...collection,
                    name: this.reverseMapCollectionName(collection.name, userId, userCollections)
                }));
        }

        // Handle single collection response
        if (rewrittenBody.result && rewrittenBody.result.collection_name) {
            rewrittenBody.result.collection_name = this.reverseMapCollectionName(
                rewrittenBody.result.collection_name, 
                userId, 
                userCollections
            );
        }

        return rewrittenBody;
    }

    /**
     * Proxy middleware for Qdrant requests
     */
    async proxyRequest(req, res, next) {
        try {
            // Extract API key from headers
            const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
            
            if (!apiKey) {
                return res.status(401).json({ error: 'API key required' });
            }

            // Authenticate user
            const { user, collections } = await this.authenticateUser(apiKey);

            // For mock mode, return mock responses
            if (QdrantService.mock) {
                return this.handleMockRequest(req, res, user, collections);
            }

            // Get the original request body
            const originalBody = req.body;

            // Rewrite request body to use internal collection names
            const rewrittenBody = this.rewriteRequestBody(originalBody, user._id, collections);

            // Make request to actual Qdrant service
            const qdrantResponse = await this.forwardToQdrant(req, rewrittenBody);

            // Rewrite response body to use user collection names
            const rewrittenResponse = this.rewriteResponseBody(qdrantResponse, user._id, collections);

            res.json(rewrittenResponse);

        } catch (error) {
            console.error('Qdrant proxy error:', error);
            res.status(error.status || 500).json({ 
                error: error.message || 'Internal server error' 
            });
        }
    }

    /**
     * Forward request to actual Qdrant service
     */
    async forwardToQdrant(req, body) {
        const url = `${process.env.QDRANT_URL}${req.path}`;
        const headers = {
            'Content-Type': 'application/json',
            'Api-Key': process.env.QDRANT_API_KEY
        };

        const response = await fetch(url, {
            method: req.method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        if (!response.ok) {
            throw new Error(`Qdrant request failed: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Handle mock requests for testing
     */
    handleMockRequest(req, res, user, collections) {
        console.log(`[QdrantProxy MOCK] ${req.method} ${req.path} for user ${user._id}`);
        
        // Mock response based on endpoint
        if (req.path === '/collections') {
            return res.json({
                result: {
                    collections: collections.map(col => ({
                        name: col.name,
                        status: 'green',
                        vectors_count: col.usage.vectorCount || 0,
                        config: {
                            params: {
                                vectors: {
                                    size: 1536,
                                    distance: 'Cosine'
                                }
                            }
                        }
                    }))
                }
            });
        }

        // Default mock response
        res.json({
            result: true,
            status: 'ok',
            time: 0.001
        });
    }
}

module.exports = QdrantProxyMiddleware;
