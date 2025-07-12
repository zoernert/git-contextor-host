const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const QdrantCollection = require('../models/QdrantCollection');
const QdrantService = require('../services/QdrantService');
const QdrantTunnelManager = require('../services/QdrantTunnelManager');
const plansConfig = require('../config/plans');

// Initialize Qdrant Tunnel Manager
const qdrantTunnelManager = new QdrantTunnelManager();

// @route   GET api/qdrant/collections
// @desc    Get user's Qdrant collections
// @access  Private
router.get('/collections', auth, async (req, res) => {
    try {
        const collections = await QdrantCollection.find({ userId: req.user.id, isActive: true });
        res.json(collections);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/qdrant/collections
// @desc    Create a Qdrant collection
// @access  Private
router.post('/collections', auth, async (req, res) => {
    const { name, description, vectorSize = 1536, distance = 'Cosine' } = req.body;
    if (!name || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name)) {
        return res.status(400).json({ msg: 'Invalid collection name. Use lowercase letters, numbers, and hyphens.' });
    }

    try {
        // Enforce limits
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        const plan = plansConfig[user.plan];
        if (!plan) {
            return res.status(400).json({ msg: 'Invalid user plan' });
        }
        const collectionCount = await QdrantCollection.countDocuments({ userId: req.user.id, isActive: true });

        if (plan.limits.maxQdrantCollections !== -1 && collectionCount >= plan.limits.maxQdrantCollections) {
            return res.status(403).json({ msg: `Collection limit of ${plan.limits.maxQdrantCollections} reached for your plan.` });
        }

        const qdrantCollectionName = `user-${req.user.id}-${name}`;
        
        // Create collection in Qdrant
        await QdrantService.createCollection(qdrantCollectionName, {
            vectors: {
                size: vectorSize,
                distance: distance,
            },
        });

        let credentials = {};
        if (process.env.QDRANT_URL) {
            const qdrantUrl = new URL(process.env.QDRANT_URL);
            credentials = {
                host: qdrantUrl.hostname,
                port: parseInt(qdrantUrl.port) || 6333,
                apiKey: process.env.QDRANT_API_KEY,
            };
        } else {
            // Mock credentials for test environment where QDRANT_URL is not set
            credentials = {
                host: 'mock-qdrant.local',
                port: 6333,
                apiKey: '',
            };
        }
        
        const newCollection = new QdrantCollection({
            userId: req.user.id,
            name,
            collectionName: qdrantCollectionName,
            credentials,
            config: {
                vectorSize,
                distance,
                description
            }
        });

        await newCollection.save();

        // Create tunnel for direct access
        try {
            const tunnelInfo = await qdrantTunnelManager.createQdrantTunnel(
                req.user.id, 
                newCollection._id, 
                `Direct access to ${name} collection`
            );

            // Update collection with tunnel info
            newCollection.tunnelInfo = {
                tunnelId: tunnelInfo.tunnelId,
                connectionId: tunnelInfo.connectionId,
                tunnelPath: tunnelInfo.tunnelPath,
                url: tunnelInfo.qdrantUrl,
                apiKey: tunnelInfo.connectionInfo.apiKey,
                lastTunnelUpdate: new Date()
            };

            await newCollection.save();
        } catch (tunnelError) {
            console.error('Failed to create tunnel for collection:', tunnelError);
            // Don't fail the collection creation if tunnel creation fails
        }

        res.status(201).json(newCollection);
    } catch (err) {
        res.status(500).json({ msg: err.message || 'Server Error' });
    }
});

// @route   GET api/qdrant/collections/:id/connection
// @desc    Get connection information for a collection
// @access  Private
router.get('/collections/:id/connection', auth, async (req, res) => {
    try {
        const collectionId = req.params.id;
        if (!collectionId) {
            return res.status(400).json({ msg: 'Collection ID is required' });
        }

        const collection = await QdrantCollection.findOne({ 
            _id: collectionId, 
            userId: req.user.id, 
            isActive: true 
        });

        if (!collection) {
            return res.status(404).json({ msg: 'Collection not found' });
        }

        // Get or create tunnel connection info
        let connectionInfo;
        try {
            connectionInfo = await qdrantTunnelManager.getCollectionConnectionInfo(
                req.user.id, 
                collection._id
            );
        } catch (tunnelError) {
            // If no tunnel exists, create one
            try {
                const tunnelInfo = await qdrantTunnelManager.createQdrantTunnel(
                    req.user.id, 
                    collection._id, 
                    `Direct access to ${collection.name} collection`
                );

                connectionInfo = tunnelInfo.connectionInfo;

                // Update collection with tunnel info
                collection.tunnelInfo = {
                    tunnelId: tunnelInfo.tunnelId,
                    connectionId: tunnelInfo.connectionId,
                    tunnelPath: tunnelInfo.tunnelPath,
                    url: tunnelInfo.qdrantUrl,
                    apiKey: tunnelInfo.connectionInfo.apiKey,
                    lastTunnelUpdate: new Date()
                };

                await collection.save();
            } catch (createError) {
                console.error('Failed to create tunnel:', createError);
                return res.status(500).json({ msg: 'Failed to create connection' });
            }
        }

        // Provide connection examples
        const response = {
            connectionInfo,
            examples: {
                nodeJs: {
                    install: 'npm install @qdrant/js-client-rest',
                    code: `const { QdrantClient } = require('@qdrant/js-client-rest');

const client = new QdrantClient({
    url: '${connectionInfo.url}',
    apiKey: '${connectionInfo.apiKey}'
});

// Use your collection name (not the internal name)
const collectionName = '${collection.name}';

// Example: Search vectors
const searchResult = await client.search(collectionName, {
    vector: [/* your vector here */],
    limit: 5
});`
                },
                python: {
                    install: 'pip install qdrant-client',
                    code: `from qdrant_client import QdrantClient

client = QdrantClient(
    url="${connectionInfo.url}",
    api_key="${connectionInfo.apiKey}"
)

# Use your collection name (not the internal name)
collection_name = "${collection.name}"

# Example: Search vectors
search_result = client.search(
    collection_name=collection_name,
    query_vector=[# your vector here],
    limit=5
)`
                },
                curl: {
                    code: `# List collections
curl -X GET "${connectionInfo.url}/collections" \\
  -H "Api-Key: ${connectionInfo.apiKey}"

# Search vectors
curl -X POST "${connectionInfo.url}/collections/${collection.name}/points/search" \\
  -H "Api-Key: ${connectionInfo.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "vector": [/* your vector here */],
    "limit": 5
  }'`
                }
            }
        };

        res.json(response);
    } catch (err) {
        console.error('Error getting connection info:', err);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   POST api/qdrant/collections/:id/test-connection
// @desc    Test connection to a collection
// @access  Private
router.post('/collections/:id/test-connection', auth, async (req, res) => {
    try {
        const collectionId = req.params.id;
        if (!collectionId) {
            return res.status(400).json({ msg: 'Collection ID is required' });
        }

        const collection = await QdrantCollection.findOne({ 
            _id: collectionId, 
            userId: req.user.id, 
            isActive: true 
        });

        if (!collection) {
            return res.status(404).json({ msg: 'Collection not found' });
        }

        // Test connection
        if (collection.tunnelInfo?.url) {
            try {
                const testResponse = await fetch(`${collection.tunnelInfo.url}/collections`, {
                    method: 'GET',
                    headers: {
                        'Api-Key': collection.tunnelInfo.apiKey,
                        'Content-Type': 'application/json'
                    }
                });

                const success = testResponse.ok;
                
                res.json({
                    success,
                    status: testResponse.status,
                    message: success ? 'Connection successful' : 'Connection failed',
                    timestamp: new Date().toISOString()
                });
            } catch (testError) {
                res.json({
                    success: false,
                    message: 'Connection test failed',
                    error: testError.message,
                    timestamp: new Date().toISOString()
                });
            }
        } else {
            res.json({
                success: false,
                message: 'No tunnel connection available',
                timestamp: new Date().toISOString()
            });
        }
    } catch (err) {
        console.error('Error testing connection:', err);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   GET api/qdrant/collections/:id/usage
// @desc    Get usage statistics for a collection
// @access  Private
router.get('/collections/:id/usage', auth, async (req, res) => {
    try {
        const collectionId = req.params.id;
        if (!collectionId) {
            return res.status(400).json({ msg: 'Collection ID is required' });
        }

        const collection = await QdrantCollection.findOne({ 
            _id: collectionId, 
            userId: req.user.id, 
            isActive: true 
        });

        if (!collection) {
            return res.status(404).json({ msg: 'Collection not found' });
        }

        res.json({
            usage: collection.usage,
            config: collection.config,
            lastAccessed: collection.usage.lastAccessed,
            createdAt: collection.createdAt
        });
    } catch (err) {
        console.error('Error getting usage:', err);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   DELETE api/qdrant/collections/:id
// @desc    Delete a Qdrant collection
// @access  Private
router.delete('/collections/:id', auth, async (req, res) => {
    try {
        const collection = await QdrantCollection.findOne({ _id: req.params.id, userId: req.user.id });
        if (!collection) {
            return res.status(404).json({ msg: 'Collection not found or permission denied.' });
        }

        // Delete tunnel if it exists
        if (collection.tunnelInfo?.tunnelId) {
            try {
                await qdrantTunnelManager.deleteQdrantTunnel(req.user.id, collection.tunnelInfo.tunnelId);
            } catch (tunnelError) {
                console.error('Failed to delete tunnel:', tunnelError);
            }
        }

        // Delete from Qdrant
        await QdrantService.deleteCollection(collection.collectionName);
        
        // Delete from database
        await QdrantCollection.findByIdAndDelete(req.params.id);
        
        res.json({ msg: 'Collection deleted' });
    } catch (err) {
        res.status(500).json({ msg: err.message || 'Server Error' });
    }
});

module.exports = router;
