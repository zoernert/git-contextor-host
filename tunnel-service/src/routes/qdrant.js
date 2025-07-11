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
    const { name } = req.body;
    if (!name || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name)) {
        return res.status(400).json({ msg: 'Invalid collection name. Use lowercase letters, numbers, and hyphens.' });
    }

    try {
        // Enforce limits
        const user = await User.findById(req.user.id);
        const plan = plansConfig[user.plan];
        const collectionCount = await QdrantCollection.countDocuments({ userId: req.user.id, isActive: true });

        if (plan.limits.maxQdrantCollections !== -1 && collectionCount >= plan.limits.maxQdrantCollections) {
            return res.status(403).json({ msg: `Collection limit of ${plan.limits.maxQdrantCollections} reached for your plan.` });
        }

        const qdrantCollectionName = `user-${req.user.id}-${name}`;
        await QdrantService.createCollection(qdrantCollectionName);

        const qdrantUrl = new URL(process.env.QDRANT_URL);
        
        const newCollection = new QdrantCollection({
            userId: req.user.id,
            name,
            collectionName: qdrantCollectionName,
            credentials: {
                host: qdrantUrl.hostname,
                port: qdrantUrl.port || 6333,
                apiKey: process.env.QDRANT_API_KEY
            }
        });

        await newCollection.save();
        res.status(201).json(newCollection);
    } catch (err) {
        res.status(500).json({ msg: err.message || 'Server Error' });
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
        await QdrantService.deleteCollection(collection.collectionName);
        await QdrantCollection.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Collection deleted' });
    } catch (err) {
        res.status(500).json({ msg: err.message || 'Server Error' });
    }
});

module.exports = router;
