# Meta Search Implementation Plan for Git Contextor Host

## Overview
Implement a "Me    // 3. Aggregate and rank results
    const aggregatedResults = await this.aggregateResults(searchResults, searchTargets);

    // 4. Apply token limit and format response
    const finalResults = await this.applyTokenLimit(aggregatedResults, maxTokens, includeMetadata, model);arch" feature that allows semantic search across multiple Qdrant collections (both hosted and tunneled) with relevance-based result aggregation. This feature is designed for AI agents to perform deep research across distributed vector stores.

## 1. Database Schema Extensions

### 1.1 New Collection: SearchTemplates
```javascript
// src/models/SearchTemplate.js
const SearchTemplateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: String,
  collections: [{
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QdrantCollection' },
    tunnelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tunnel' },
    weight: { type: Number, default: 1.0 }, // Collection importance weight
    enabled: { type: Boolean, default: true }
  }],
  searchConfig: {
    maxResults: { type: Number, default: 50 },
    scoreThreshold: { type: Number, default: 0.7 },
    maxTokens: { type: Number, default: 4000 },
    includeMetadata: { type: Boolean, default: true }
  },
  createdAt: { type: Date, default: Date.now },
  lastUsed: { type: Date, default: Date.now }
});
```

### 1.2 New Collection: SearchHistory
```javascript
// src/models/SearchHistory.js
const SearchHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  query: { type: String, required: true },
  embedding: [Number], // Store query embedding for cache/similarity
  collections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'QdrantCollection' }],
  tunnels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tunnel' }],
  results: {
    totalResults: Number,
    processedResults: Number,
    finalTokenCount: Number,
    executionTime: Number
  },
  searchConfig: {
    maxResults: Number,
    scoreThreshold: Number,
    maxTokens: Number
  },
  createdAt: { type: Date, default: Date.now }
});
```

## 2. Core Service Implementation

### 2.1 Meta Search Service
```javascript
// src/services/MetaSearchService.js
class MetaSearchService {
  constructor() {
    this.tokenCounter = new TokenCounter();
  }

  async performMetaSearch(userId, query, options = {}) {
    const {
      collections = [],
      tunnels = [],
      maxResults = 50,
      scoreThreshold = 0.7,
      maxTokens = 4000,
      includeMetadata = true,
      searchTemplateId = null
    } = options;

    // 1. Get search targets (collections + tunnels)
    const searchTargets = await this.getSearchTargets(userId, collections, tunnels, searchTemplateId);

    // 2. Execute parallel searches
    const searchResults = await this.executeParallelSearches(query, searchTargets, {
      maxResults: Math.ceil(maxResults / searchTargets.length),
      scoreThreshold
    });

    // 4. Aggregate and rank results
    const aggregatedResults = await this.aggregateResults(searchResults, searchTargets);

    // 5. Apply token limit and format response
    const finalResults = await this.applyTokenLimit(aggregatedResults, maxTokens, includeMetadata);

    // 6. Store search history
    await this.storeSearchHistory(userId, query, queryEmbedding, searchTargets, finalResults, options);

    return finalResults;
  }

  async getSearchTargets(userId, collectionIds, tunnelIds, searchTemplateId) {
    const targets = [];

    if (searchTemplateId) {
      const template = await SearchTemplate.findOne({ _id: searchTemplateId, userId });
      if (template) {
        return template.collections.filter(c => c.enabled);
      }
    }

    // Get hosted collections
    for (const collectionId of collectionIds) {
      const collection = await QdrantCollection.findOne({ 
        _id: collectionId, 
        userId, 
        isActive: true 
      });
      if (collection) {
        targets.push({
          type: 'hosted',
          id: collection._id,
          name: collection.name,
          collectionName: collection.collectionName,
          client: await this.getHostedClient(collection),
          weight: 1.0
        });
      }
    }

    // Get tunnel collections
    for (const tunnelId of tunnelIds) {
      const tunnel = await Tunnel.findOne({ 
        _id: tunnelId, 
        userId, 
        isActive: true 
      });
      if (tunnel) {
        targets.push({
          type: 'tunnel',
          id: tunnel._id,
          name: tunnel.tunnelPath,
          tunnelUrl: tunnel.url,
          client: await this.getTunnelClient(tunnel),
          weight: 1.0
        });
      }
    }

    return targets;
  }

  async executeParallelSearches(queryEmbedding, targets, options) {
    const searchPromises = targets.map(target => 
      this.searchSingleTarget(target, queryEmbedding, options)
        .catch(error => ({
          target: target.id,
          error: error.message,
          results: []
        }))
    );

    return await Promise.all(searchPromises);
  }

  async searchSingleTarget(target, queryEmbedding, options) {
    try {
      const searchParams = {
        vector: queryEmbedding,
        limit: options.maxResults,
        score_threshold: options.scoreThreshold,
        with_payload: true
      };

      let results;
      if (target.type === 'hosted') {
        results = await target.client.search(target.collectionName, searchParams);
      } else {
        // For tunnel collections, use HTTP API
        results = await this.searchTunnelCollection(target, searchParams);
      }

      return {
        target: target.id,
        targetName: target.name,
        targetType: target.type,
        weight: target.weight,
        results: results || []
      };
    } catch (error) {
      console.error(`Search failed for target ${target.name}:`, error);
      return {
        target: target.id,
        error: error.message,
        results: []
      };
    }
  }

  async aggregateResults(searchResults, targets) {
    const allResults = [];

    for (const searchResult of searchResults) {
      if (searchResult.results && searchResult.results.length > 0) {
        for (const result of searchResult.results) {
          allResults.push({
            ...result,
            sourceCollection: searchResult.targetName,
            sourceType: searchResult.targetType,
            weightedScore: result.score * searchResult.weight,
            originalScore: result.score
          });
        }
      }
    }

    // Sort by weighted score (highest first)
    return allResults.sort((a, b) => b.weightedScore - a.weightedScore);
  }

  async applyTokenLimit(results, maxTokens, includeMetadata) {
    const finalResults = [];
    let currentTokens = 0;
    let processedCount = 0;

    for (const result of results) {
      // Calculate tokens for this result
      const content = this.extractContent(result, includeMetadata);
      const tokens = this.tokenCounter.count(content);

      if (currentTokens + tokens > maxTokens && finalResults.length > 0) {
        break; // Stop if adding this would exceed limit
      }

      finalResults.push({
        id: result.id,
        score: result.weightedScore,
        originalScore: result.originalScore,
        sourceCollection: result.sourceCollection,
        sourceType: result.sourceType,
        content: content,
        tokens: tokens,
        payload: includeMetadata ? result.payload : undefined
      });

      currentTokens += tokens;
      processedCount++;
    }

    return {
      query: results.query,
      totalResults: results.length,
      processedResults: processedCount,
      results: finalResults,
      tokenUsage: {
        used: currentTokens,
        limit: maxTokens,
        percentage: (currentTokens / maxTokens * 100).toFixed(1)
      },
      executionTime: Date.now()
    };
  }

  extractContent(result, includeMetadata) {
    let content = '';
    
    if (result.payload) {
      // Common content fields
      if (result.payload.text) content += result.payload.text;
      if (result.payload.content) content += result.payload.content;
      if (result.payload.description) content += ' ' + result.payload.description;
      
      // Git Contextor specific fields
      if (result.payload.filepath) content += ` [File: ${result.payload.filepath}]`;
      if (result.payload.filename) content += ` [${result.payload.filename}]`;
      
      if (includeMetadata && result.payload.metadata) {
        content += ` [Metadata: ${JSON.stringify(result.payload.metadata)}]`;
      }
    }
    
    return content.trim();
  }
}
```

### 2.2 Token Counter Service
```javascript
// src/services/TokenCounter.js
class TokenCounter {
  count(text) {
    if (!text) return 0;
    
    // Rough approximation: 1 token ≈ 4 characters for English text
    // More accurate would be to use tiktoken or similar
    return Math.ceil(text.length / 4);
  }

  estimateTokens(results) {
    return results.reduce((total, result) => {
      return total + this.count(result.content || '');
    }, 0);
  }
}
```

## 3. API Routes Implementation

### 2.3 Meta Search Routes
```javascript
// src/routes/metaSearch.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const MetaSearchService = require('../services/MetaSearchService');
const SearchTemplate = require('../models/SearchTemplate');
const SearchHistory = require('../models/SearchHistory');

// @route   POST /api/meta-search/search
// @desc    Perform meta search across collections
// @access  Private
router.post('/search', auth, async (req, res) => {
  try {
    const {
      query,
      collections = [],
      tunnels = [],
      maxResults = 50,
      scoreThreshold = 0.7,
      maxTokens = 4000,
      includeMetadata = true,
      searchTemplateId = null
    } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ msg: 'Query is required' });
    }

    const metaSearchService = new MetaSearchService();
    const results = await metaSearchService.performMetaSearch(req.user.id, query, {
      collections,
      tunnels,
      maxResults,
      scoreThreshold,
      maxTokens,
      includeMetadata,
      searchTemplateId
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
        .select('name config usage createdAt'),
      Tunnel.find({ userId: req.user.id, isActive: true })
        .select('tunnelPath url localPort metadata createdAt expiresAt')
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

    const template = new SearchTemplate({
      userId: req.user.id,
      name,
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
      .sort({ lastUsed: -1 });
    res.json(templates);
  } catch (error) {
    console.error('Error fetching search templates:', error);
    res.status(500).json({ msg: 'Failed to fetch search templates' });
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
      .select('-embedding'); // Don't return embeddings in history

    res.json(history);
  } catch (error) {
    console.error('Error fetching search history:', error);
    res.status(500).json({ msg: 'Failed to fetch search history' });
  }
});

module.exports = router;
```

## 4. Frontend Implementation

### 3.1 Meta Search Page Component
```javascript
// admin-ui/src/pages/MetaSearch.jsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';

export default function MetaSearch() {
  const [query, setQuery] = useState('');
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [selectedTunnels, setSelectedTunnels] = useState([]);
  const [searchConfig, setSearchConfig] = useState({
    maxResults: 50,
    scoreThreshold: 0.7,
    maxTokens: 4000,
    includeMetadata: true
  });
  const [searchResults, setSearchResults] = useState(null);

  // Fetch available sources
  const { data: sources } = useQuery(['metaSearchSources'], async () => {
    const token = localStorage.getItem('token');
    const { data } = await axios.get('/api/meta-search/sources', {
      headers: { 'x-auth-token': token }
    });
    return data;
  });

  // Search mutation
  const searchMutation = useMutation(async (searchParams) => {
    const token = localStorage.getItem('token');
    const { data } = await axios.post('/api/meta-search/search', searchParams, {
      headers: { 'x-auth-token': token }
    });
    return data;
  });

  const handleSearch = () => {
    if (!query.trim()) return;

    searchMutation.mutate({
      query,
      collections: selectedCollections,
      tunnels: selectedTunnels,
      ...searchConfig
    }, {
      onSuccess: (data) => {
        setSearchResults(data);
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Meta Search</h1>
      
      {/* Search Interface */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Search Query</label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your search query for AI-powered research..."
            className="w-full p-3 border rounded-lg"
            rows={3}
          />
        </div>

        {/* Source Selection */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="font-medium mb-2">Hosted Collections</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {sources?.hostedCollections?.map(collection => (
                <label key={collection._id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedCollections.includes(collection._id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCollections([...selectedCollections, collection._id]);
                      } else {
                        setSelectedCollections(selectedCollections.filter(id => id !== collection._id));
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm">{collection.name}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({collection.usage?.vectorCount || 0} vectors)
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-2">Tunnel Collections</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {sources?.tunnelCollections?.map(tunnel => (
                <label key={tunnel._id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedTunnels.includes(tunnel._id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTunnels([...selectedTunnels, tunnel._id]);
                      } else {
                        setSelectedTunnels(selectedTunnels.filter(id => id !== tunnel._id));
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm">{tunnel.tunnelPath}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    (port {tunnel.localPort})
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Search Configuration */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium mb-1">Max Results</label>
            <input
              type="number"
              value={searchConfig.maxResults}
              onChange={(e) => setSearchConfig({...searchConfig, maxResults: parseInt(e.target.value)})}
              className="w-full p-2 text-sm border rounded"
              min="1"
              max="200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Score Threshold</label>
            <input
              type="number"
              value={searchConfig.scoreThreshold}
              onChange={(e) => setSearchConfig({...searchConfig, scoreThreshold: parseFloat(e.target.value)})}
              className="w-full p-2 text-sm border rounded"
              min="0"
              max="1"
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Max Tokens</label>
            <input
              type="number"
              value={searchConfig.maxTokens}
              onChange={(e) => setSearchConfig({...searchConfig, maxTokens: parseInt(e.target.value)})}
              className="w-full p-2 text-sm border rounded"
              min="100"
              max="10000"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={searchConfig.includeMetadata}
                onChange={(e) => setSearchConfig({...searchConfig, includeMetadata: e.target.checked})}
                className="mr-2"
              />
              Include Metadata
            </label>
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={searchMutation.isLoading || !query.trim()}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg disabled:opacity-50"
        >
          {searchMutation.isLoading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Search Results */}
      {searchResults && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold">Search Results</h2>
            <div className="text-sm text-gray-600 mt-1">
              Found {searchResults.totalResults} results, showing {searchResults.processedResults} 
              (Token usage: {searchResults.tokenUsage.used}/{searchResults.tokenUsage.limit} - {searchResults.tokenUsage.percentage}%)
            </div>
          </div>

          <div className="space-y-4">
            {searchResults.results.map((result, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{result.sourceCollection}</span>
                    <span className="mx-2">•</span>
                    <span className="capitalize">{result.sourceType}</span>
                    <span className="mx-2">•</span>
                    <span>Score: {result.score.toFixed(3)}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {result.tokens} tokens
                  </div>
                </div>
                <div className="text-sm bg-gray-50 p-3 rounded">
                  {result.content}
                </div>
                {searchConfig.includeMetadata && result.payload && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer">Metadata</summary>
                    <pre className="text-xs bg-gray-100 p-2 mt-1 rounded overflow-x-auto">
                      {JSON.stringify(result.payload, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

## 5. Integration Points

### 4.1 Add Meta Search to Main Router
```javascript
// src/index.js
// Add this line with other route mounts
app.use('/api/meta-search', require('./routes/metaSearch'));
```

### 4.2 Add Meta Search to Navigation
```javascript
// admin-ui/src/components/Sidebar.jsx
// Add to navigation array
{ name: 'Meta Search', href: '/meta-search', icon: MagnifyingGlassIcon },
```

### 4.3 Add Meta Search Route
```javascript
// admin-ui/src/App.jsx
// Add to routes
<Route path="/meta-search" element={<PrivateRoute><MetaSearch /></PrivateRoute>} />
```

## 6. Environment Configuration

### 5.1 Required Environment Variables
```bash
# .env additions
MAX_META_SEARCH_SOURCES=20  # Limit concurrent searches
META_SEARCH_CACHE_TTL=300  # Cache TTL in seconds
```

## 7. Testing Strategy

### 6.1 Unit Tests
```javascript
// tests/services/MetaSearchService.test.js
describe('MetaSearchService', () => {
  test('should aggregate results from multiple sources', async () => {
    // Test implementation
  });
  
  test('should respect token limits', async () => {
    // Test implementation
  });
  
  test('should handle search failures gracefully', async () => {
    // Test implementation
  });
});
```

### 6.2 Integration Tests
```javascript
// tests/routes/metaSearch.test.js
describe('Meta Search API', () => {
  test('POST /api/meta-search/search should return aggregated results', async () => {
    // Test implementation
  });
});
```

## 8. Documentation Updates

### 7.1 API Documentation
- Add Meta Search endpoints to OpenAPI spec
- Include request/response examples
- Document rate limits and usage patterns

### 7.2 User Guide
- Create Meta Search user guide
- Include best practices for query construction
- Document AI agent integration patterns

## 9. Monitoring and Analytics

### 8.1 Metrics to Track
- Search query performance
- Token usage patterns
- Collection usage distribution
- Error rates by source type
- User adoption metrics

### 8.2 Alerting
- High error rates in meta search
- Unusual token consumption
- Performance degradation alerts

## 10. Deployment Considerations

### 9.1 Performance
- Implement connection pooling for external Qdrant clients
- Add Redis caching for frequent searches
- Consider request queuing for high-load scenarios

### 9.2 Scaling
- Horizontal scaling support for search workers
- Load balancing for concurrent searches
- Resource limits per user/plan

This implementation plan provides a comprehensive Meta Search feature that minimally impacts existing code while adding powerful semantic search capabilities across distributed vector stores. The design is optimized for AI agent consumption with token-aware result aggregation and flexible source selection.