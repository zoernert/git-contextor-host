const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const MetaSearchService = require('../services/MetaSearchService');
const SearchTemplate = require('../models/SearchTemplate');
const SearchHistory = require('../models/SearchHistory');
const rateLimit = require('express-rate-limit');

// Rate limiting for search endpoints
const searchRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many search requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// @route   POST /api/meta-search/search
// @desc    Perform meta search across collections
// @access  Private
router.post('/search', auth, searchRateLimit, async (req, res) => {
  try {
    const {
      query,
      collections = [],
      tunnels = [],
      maxResults = 50,
      scoreThreshold = 0.7,
      maxTokens = 4000,
      includeMetadata = true,
      searchTemplateId = null,
      model = 'gpt-4'
    } = req.body;

    // Validation
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ msg: 'Query is required' });
    }

    if (query.length > 1000) {
      return res.status(400).json({ msg: 'Query too long (max 1000 characters)' });
    }

    if (maxResults > 200) {
      return res.status(400).json({ msg: 'Max results cannot exceed 200' });
    }

    if (maxTokens > 50000) {
      return res.status(400).json({ msg: 'Max tokens cannot exceed 50000' });
    }

    if (collections.length === 0 && tunnels.length === 0 && !searchTemplateId) {
      return res.status(400).json({ msg: 'At least one collection, tunnel, or search template must be selected' });
    }

    const metaSearchService = new MetaSearchService();
    const results = await metaSearchService.performMetaSearch(req.user.id, query, {
      collections,
      tunnels,
      maxResults,
      scoreThreshold,
      maxTokens,
      includeMetadata,
      searchTemplateId,
      model
    });

    res.json(results);
  } catch (error) {
    console.error('Meta search error:', error);
    res.status(500).json({ msg: error.message || 'Meta search failed' });
  }
});

// @route   GET /api/meta-search/sources
// @desc    Get available search sources for user
// @access  Private
router.get('/sources', auth, async (req, res) => {
  try {
    const QdrantCollection = require('../models/QdrantCollection');
    const Tunnel = require('../models/Tunnel');

    const [collections, tunnels] = await Promise.all([
      QdrantCollection.find({ userId: req.user.id, isActive: true })
        .select('name collectionName config usage createdAt')
        .sort({ createdAt: -1 }),
      Tunnel.find({ 
        userId: req.user.id, 
        isActive: true,
        expiresAt: { $gt: new Date() }
      })
        .select('tunnelPath url localPort metadata createdAt expiresAt')
        .sort({ createdAt: -1 })
    ]);

    res.json({
      hostedCollections: collections,
      tunnelCollections: tunnels,
      totalSources: collections.length + tunnels.length
    });
  } catch (error) {
    console.error('Error fetching search sources:', error);
    res.status(500).json({ msg: 'Failed to fetch search sources' });
  }
});

// @route   POST /api/meta-search/templates
// @desc    Create search template
// @access  Private
router.post('/templates', auth, async (req, res) => {
  try {
    const { name, description, collections, searchConfig } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ msg: 'Template name is required' });
    }

    if (!collections || collections.length === 0) {
      return res.status(400).json({ msg: 'At least one collection must be selected' });
    }

    // Check if template name already exists for this user
    const existingTemplate = await SearchTemplate.findOne({
      userId: req.user.id,
      name: name.trim()
    });

    if (existingTemplate) {
      return res.status(400).json({ msg: 'Template name already exists' });
    }

    const template = new SearchTemplate({
      userId: req.user.id,
      name: name.trim(),
      description,
      collections,
      searchConfig
    });

    await template.save();
    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating search template:', error);
    res.status(500).json({ msg: 'Failed to create search template' });
  }
});

// @route   GET /api/meta-search/templates
// @desc    Get user's search templates
// @access  Private
router.get('/templates', auth, async (req, res) => {
  try {
    const templates = await SearchTemplate.find({ userId: req.user.id })
      .populate('collections.collectionId', 'name collectionName')
      .populate('collections.tunnelId', 'tunnelPath url')
      .sort({ lastUsed: -1 });
    
    res.json(templates);
  } catch (error) {
    console.error('Error fetching search templates:', error);
    res.status(500).json({ msg: 'Failed to fetch search templates' });
  }
});

// @route   PUT /api/meta-search/templates/:id
// @desc    Update search template
// @access  Private
router.put('/templates/:id', auth, async (req, res) => {
  try {
    const { name, description, collections, searchConfig } = req.body;

    const template = await SearchTemplate.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!template) {
      return res.status(404).json({ msg: 'Template not found' });
    }

    // Check if new name conflicts with existing templates
    if (name && name !== template.name) {
      const existingTemplate = await SearchTemplate.findOne({
        userId: req.user.id,
        name: name.trim(),
        _id: { $ne: req.params.id }
      });

      if (existingTemplate) {
        return res.status(400).json({ msg: 'Template name already exists' });
      }
    }

    // Update fields
    if (name) template.name = name.trim();
    if (description !== undefined) template.description = description;
    if (collections) template.collections = collections;
    if (searchConfig) template.searchConfig = searchConfig;

    await template.save();
    res.json(template);
  } catch (error) {
    console.error('Error updating search template:', error);
    res.status(500).json({ msg: 'Failed to update search template' });
  }
});

// @route   DELETE /api/meta-search/templates/:id
// @desc    Delete search template
// @access  Private
router.delete('/templates/:id', auth, async (req, res) => {
  try {
    const template = await SearchTemplate.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!template) {
      return res.status(404).json({ msg: 'Template not found' });
    }

    res.json({ msg: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting search template:', error);
    res.status(500).json({ msg: 'Failed to delete search template' });
  }
});

// @route   GET /api/meta-search/history
// @desc    Get search history
// @access  Private
router.get('/history', auth, async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const history = await SearchHistory.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .select('-embedding') // Don't return embeddings in history
      .populate('collections', 'name collectionName')
      .populate('tunnels', 'tunnelPath url');

    const total = await SearchHistory.countDocuments({ userId: req.user.id });

    res.json({
      history,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching search history:', error);
    res.status(500).json({ msg: 'Failed to fetch search history' });
  }
});

// @route   DELETE /api/meta-search/history/:id
// @desc    Delete search history item
// @access  Private
router.delete('/history/:id', auth, async (req, res) => {
  try {
    const historyItem = await SearchHistory.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!historyItem) {
      return res.status(404).json({ msg: 'History item not found' });
    }

    res.json({ msg: 'History item deleted successfully' });
  } catch (error) {
    console.error('Error deleting search history:', error);
    res.status(500).json({ msg: 'Failed to delete search history' });
  }
});

// @route   POST /api/meta-search/history/clear
// @desc    Clear all search history
// @access  Private
router.post('/history/clear', auth, async (req, res) => {
  try {
    await SearchHistory.deleteMany({ userId: req.user.id });
    res.json({ msg: 'Search history cleared successfully' });
  } catch (error) {
    console.error('Error clearing search history:', error);
    res.status(500).json({ msg: 'Failed to clear search history' });
  }
});

// @route   GET /api/meta-search/similar-queries
// @desc    Get similar queries for suggestions
// @access  Private
router.get('/similar-queries', auth, async (req, res) => {
  try {
    const { query, limit = 5 } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ msg: 'Query parameter is required' });
    }

    const metaSearchService = new MetaSearchService();
    const similarQueries = await metaSearchService.getSimilarQueries(req.user.id, query, limit);

    res.json(similarQueries);
  } catch (error) {
    console.error('Error fetching similar queries:', error);
    res.status(500).json({ msg: 'Failed to fetch similar queries' });
  }
});

module.exports = router;
