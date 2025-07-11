const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const QdrantCollection = require('../models/QdrantCollection');
const { v4: uuidv4 } = require('uuid');

// @route   GET api/qdrant/collections
// @desc    Get user's Qdrant collections
// @access  Private
router.get('/collections', auth, async (req, res) => {
    try {
        const collections = await QdrantCollection.find({ userId: req.user.id });
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
    if (!name) {
        return res.status(400).json({ msg: 'Collection name is required.' });
    }

    try {
        // Mocking the creation of a real Qdrant collection
        const newCollection = new QdrantCollection({
            userId: req.user.id,
            name,
            qdrantInstanceId: `qdrant-instance-${uuidv4()}`,
            collectionName: `collection-${uuidv4()}`,
            credentials: {
                host: 'qdrant.yourservice.com',
                port: 6333,
                apiKey: `qdrant-api-key-${uuidv4()}`
            }
        });

        await newCollection.save();
        res.status(201).json(newCollection);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
