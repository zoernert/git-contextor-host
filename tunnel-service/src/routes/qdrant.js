const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const QdrantCollection = require('../models/QdrantCollection');
const QdrantService = require('../services/QdrantService');
const plansConfig = require('../config/plans');

// @route   GET api/qdrant/collections
// @desc    Get user's Qdrant collections
// @access  Private
router.get('/collections', auth, async (req, res) => {
    try {
        const collections = await QdrantCollection.find({ userId: req.user.id, isActive: true });
        
        // Enhance collection data with stable identifiers
        const enhancedCollections = collections.map(collection => {
            const collectionData = collection.toObject();
            collectionData.identifier = collection.uuid; // Stable identifier
            collectionData.url = collection.apiUrl; // Use the virtual URL
            return collectionData;
        });
        
        res.json(enhancedCollections);
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
        
        // Create collection in Qdrant with optimized configuration for larger payloads
        await QdrantService.createCollection(qdrantCollectionName, {
            vectors: {
                size: vectorSize,
                distance: distance,
                on_disk: true, // Store vectors on disk to save memory
            },
            // Enable on-disk payload storage for larger payloads
            on_disk_payload: true,
            // Optimize for larger payloads and better memory usage
            hnsw_config: {
                m: 16,
                ef_construct: 100,
                full_scan_threshold: 10000,
                max_indexing_threads: 0,
                on_disk: true // Store HNSW index on disk
            }
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
            tunnelInfo: {
                proxyUrl: `${process.env.TUNNEL_BASE_URL || 'https://tunnel.corrently.cloud'}/api/qdrant/collections/${qdrantCollectionName}`,
                isManaged: true
            },
            config: {
                vectorSize,
                distance,
                description
            }
        });

        await newCollection.save();

        res.status(201).json(newCollection);
    } catch (err) {
        res.status(500).json({ msg: err.message || 'Server Error' });
    }
});

// @route   GET api/qdrant/collections/:identifier/connection
// @desc    Get connection information for a collection (supports UUID, name, or ObjectId)
// @access  Private
router.get('/collections/:identifier/connection', auth, async (req, res) => {
    try {
        const identifier = req.params.identifier;
        if (!identifier) {
            return res.status(400).json({ msg: 'Collection identifier is required' });
        }

        const collection = await QdrantCollection.findByIdentifier(identifier, req.user.id);

        if (!collection) {
            return res.status(404).json({ msg: 'Collection not found' });
        }

        // Get user's API key for authentication
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        
        const connectionInfo = {
            url: `${process.env.TUNNEL_BASE_URL || 'https://tunnel.corrently.cloud'}/api/qdrant/collections/${collection.uuid}`,
            apiKey: user.apiKey,
            collectionName: collection.name,
            internalCollectionName: collection.collectionName,
            collectionId: collection.uuid  // Use UUID instead of ObjectId
        };

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
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/qdrant/collections/:identifier/test-connection
// @desc    Test connection to a collection (supports UUID, name, or ObjectId)
// @access  Private
router.post('/collections/:identifier/test-connection', auth, async (req, res) => {
    try {
        const identifier = req.params.identifier;
        if (!identifier) {
            return res.status(400).json({ msg: 'Collection identifier is required' });
        }

        const collection = await QdrantCollection.findByIdentifier(identifier, req.user.id);

        if (!collection) {
            return res.status(404).json({ msg: 'Collection not found' });
        }

        // Test connection by attempting to get collection info from Qdrant
        try {
            const collectionInfo = await QdrantService.getCollectionInfo(collection.collectionName);
            
            res.json({
                success: true,
                message: 'Connection successful',
                collectionInfo: collectionInfo,
                timestamp: new Date().toISOString()
            });
        } catch (testError) {
            console.error('Collection connection test failed:', testError);
            
            res.json({
                success: false,
                message: 'Connection failed',
                error: testError.message,
                timestamp: new Date().toISOString()
            });
        }
    } catch (err) {
        console.error('Error testing connection:', err);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   GET api/qdrant/collections/:identifier/usage
// @desc    Get usage statistics for a collection (supports UUID, name, or ObjectId)
// @access  Private
router.get('/collections/:identifier/usage', auth, async (req, res) => {
    try {
        const identifier = req.params.identifier;
        if (!identifier) {
            return res.status(400).json({ msg: 'Collection identifier is required' });
        }

        const collection = await QdrantCollection.findByIdentifier(identifier, req.user.id);

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

// @route   DELETE api/qdrant/collections/:identifier
// @desc    Delete a Qdrant collection (supports UUID, name, or ObjectId)
// @access  Private
router.delete('/collections/:identifier', auth, async (req, res) => {
    try {
        const collection = await QdrantCollection.findByIdentifier(req.params.identifier, req.user.id, false);
        if (!collection) {
            return res.status(404).json({ msg: 'Collection not found or permission denied.' });
        }

        // Delete from Qdrant
        await QdrantService.deleteCollection(collection.collectionName);
        
        // Delete from database
        await QdrantCollection.findByIdAndDelete(collection._id);
        
        res.json({ msg: 'Collection deleted' });
    } catch (err) {
        res.status(500).json({ msg: err.message || 'Server Error' });
    }
});

// @route   GET api/qdrant/collections/:identifier
// @desc    Get specific collection info by UUID, name, or ObjectId
// @access  Private
router.get('/collections/:identifier', auth, async (req, res) => {
    try {
        const { identifier } = req.params;
        
        // Find the collection using the flexible identifier lookup
        const collection = await QdrantCollection.findByIdentifier(identifier, req.user.id);
        
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found or access denied' });
        }
        
        // Get additional collection info from Qdrant if available
        let qdrantInfo = null;
        try {
            if (QdrantService.client) {
                qdrantInfo = await QdrantService.client.getCollection(collection.collectionName);
            }
        } catch (error) {
            console.log('Could not fetch Qdrant info:', error.message);
        }
        
        // Enhance collection data with stable identifiers and Qdrant info
        const collectionData = collection.toObject();
        collectionData.identifier = collection.uuid; // Stable identifier
        collectionData.url = collection.apiUrl; // Use the virtual URL
        
        // Add Qdrant collection info if available
        if (qdrantInfo) {
            collectionData.qdrantInfo = {
                status: qdrantInfo.status,
                vectorsCount: qdrantInfo.vectors_count || 0,
                indexedVectorsCount: qdrantInfo.indexed_vectors_count || 0,
                pointsCount: qdrantInfo.points_count || 0,
                segmentsCount: qdrantInfo.segments_count || 0,
                config: qdrantInfo.config
            };
        }
        
        res.json(collectionData);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;
