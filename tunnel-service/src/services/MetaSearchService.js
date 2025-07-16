const TokenCounter = require('./TokenCounter');
const QdrantService = require('./QdrantService');
const SearchTemplate = require('../models/SearchTemplate');
const SearchHistory = require('../models/SearchHistory');
const QdrantCollection = require('../models/QdrantCollection');
const Tunnel = require('../models/Tunnel');
const EmbeddingProvider = require('./EmbeddingProvider');
const { QdrantClient } = require('@qdrant/js-client-rest');
const axios = require('axios');

class MetaSearchService {
  constructor() {
    this.tokenCounter = new TokenCounter();
    this.embeddingProvider = new EmbeddingProvider();
    this.maxConcurrentSearches = parseInt(process.env.MAX_META_SEARCH_SOURCES) || 20;
    this.cacheEnabled = process.env.META_SEARCH_CACHE_TTL > 0;
    this.cacheTTL = parseInt(process.env.META_SEARCH_CACHE_TTL) || 300;
  }

  async performMetaSearch(userId, query, options = {}) {
    const {
      collections = [],
      tunnels = [],
      maxResults = 50,
      scoreThreshold = 0.7,
      maxTokens = 4000,
      includeMetadata = true,
      searchTemplateId = null,
      model = 'gpt-4'
    } = options;

    const startTime = Date.now();

    try {
      // 1. Get search targets (collections + tunnels)
      const searchTargets = await this.getSearchTargets(userId, collections, tunnels, searchTemplateId);

      if (searchTargets.length === 0) {
        throw new Error('No active search targets found');
      }

      // 3. Limit concurrent searches
      const limitedTargets = searchTargets.slice(0, this.maxConcurrentSearches);

      // 3. Execute parallel searches
      const searchResults = await this.executeParallelSearches(query, limitedTargets, {
        maxResults: Math.ceil(maxResults / limitedTargets.length),
        scoreThreshold
      });

      // 5. Aggregate and rank results
      const aggregatedResults = await this.aggregateResults(searchResults, limitedTargets);

      // 6. Apply token limit and format response
      const finalResults = await this.applyTokenLimit(aggregatedResults, maxTokens, includeMetadata, model);

      // 7. Store search history
      await this.storeSearchHistory(userId, query, searchTargets, finalResults, options);

      const executionTime = Date.now() - startTime;
      finalResults.executionTime = executionTime;

      return finalResults;
    } catch (error) {
      console.error('Meta search failed:', error);
      throw error;
    }
  }

  async getSearchTargets(userId, collectionIds, tunnelIds, searchTemplateId) {
    const targets = [];

    if (searchTemplateId) {
      const template = await SearchTemplate.findOne({ _id: searchTemplateId, userId });
      if (template) {
        // Process template collections
        for (const templateItem of template.collections.filter(c => c.enabled)) {
          if (templateItem.collectionId) {
            const collection = await QdrantCollection.findOne({ 
              _id: templateItem.collectionId, 
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
                tunnelInfo: collection.tunnelInfo || {
                  proxyUrl: collection.apiUrl,
                  isManaged: true
                },
                weight: templateItem.weight || 1.0
              });
            }
          }
          if (templateItem.tunnelId) {
            const tunnel = await Tunnel.findOne({ 
              _id: templateItem.tunnelId, 
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
                weight: templateItem.weight || 1.0
              });
            }
          }
        }
        return targets;
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
          tunnelInfo: collection.tunnelInfo || {
            proxyUrl: collection.apiUrl,
            isManaged: true
          },
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

  async getHostedClient(collection) {
    try {
      // SECURITY: Always use proxy URL for managed collections - never direct connection
      const baseUrl = process.env.TUNNEL_BASE_URL || 'https://tunnel.corrently.cloud';
      const proxyUrl = `${baseUrl}/api/qdrant/collections/${collection.uuid}`;
      
      // Get user's API key for authentication
      const User = require('../models/User');
      const user = await User.findById(collection.userId);
      if (!user) {
        throw new Error('User not found for collection');
      }
      
      // Return proxy client configuration for managed collections
      return {
        isProxyClient: true,
        proxyUrl: proxyUrl,
        apiKey: user.apiKey,
        collectionName: collection.name, // Use user-friendly name
        internalCollectionName: collection.collectionName, // Internal Qdrant name
        collection: collection
      };
    } catch (error) {
      console.error(`Failed to create proxy client for collection ${collection.name}:`, error);
      throw error;
    }
  }

  async getTunnelClient(tunnel) {
    // For tunnel collections, we'll use HTTP API calls
    return {
      tunnelUrl: tunnel.url,
      localPort: tunnel.localPort,
      metadata: tunnel.metadata
    };
  }

  async executeParallelSearches(query, targets, options) {
    const searchPromises = targets.map(target => 
      this.searchSingleTarget(target, query, options)
        .catch(error => ({
          target: target.id,
          targetName: target.name,
          error: error.message,
          results: []
        }))
    );

    return await Promise.all(searchPromises);
  }

  async searchSingleTarget(target, query, options) {
    try {
      const searchParams = {
        query: query,
        limit: options.maxResults,
        score_threshold: options.scoreThreshold,
        with_payload: true
      };

      let results;
      if (target.type === 'hosted') {
        // For managed collections, use proxy endpoint
        if (target.client.isProxyClient) {
          results = await this.searchProxyCollection(target, searchParams);
        } else {
          // Fallback for direct Qdrant client (deprecated)
          results = await target.client.search(target.collectionName, searchParams);
        }
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
        targetName: target.name,
        targetType: target.type,
        weight: target.weight,
        error: error.message,
        results: []
      };
    }
  }

  async searchProxyCollection(target, searchParams) {
    try {
      const client = target.client;
      const searchEndpoint = `${client.proxyUrl}/points/search`;
      
      // Convert text query to vector embedding
      let searchVector;
      if (Array.isArray(searchParams.query)) {
        // Query is already a vector
        searchVector = searchParams.query;
      } else {
        // Query is text, convert to vector
        console.log(`Converting text query to vector for collection ${target.name}: "${searchParams.query}"`);
        searchVector = await this.embeddingProvider.generateEmbedding(searchParams.query);
      }
      
      const requestBody = {
        vector: searchVector,
        limit: searchParams.limit,
        score_threshold: searchParams.score_threshold,
        with_payload: searchParams.with_payload
      };
      
      const response = await axios.post(searchEndpoint, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': client.apiKey
        },
        timeout: 30000 // 30 second timeout for embedding + search
      });

      return response.data.result || response.data;
    } catch (error) {
      console.error(`Proxy search failed for ${target.name}:`, error);
      throw error;
    }
  }

  async searchTunnelCollection(target, searchParams) {
    try {
      // Try to search via tunnel URL (assuming it's a Qdrant instance)
      const response = await axios.post(
        `${target.tunnelUrl}/collections/search`,
        searchParams,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        }
      );

      return response.data.result || response.data;
    } catch (error) {
      console.error(`Tunnel search failed for ${target.name}:`, error);
      throw error;
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

  async applyTokenLimit(results, maxTokens, includeMetadata, model = 'gpt-4') {
    const finalResults = [];
    let currentTokens = 0;
    let processedCount = 0;

    for (const result of results) {
      // Calculate tokens for this result
      const content = this.extractContent(result, includeMetadata);
      const tokens = this.tokenCounter.countForModel(content, model);

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
      totalResults: results.length,
      processedResults: processedCount,
      results: finalResults,
      tokenUsage: {
        used: currentTokens,
        limit: maxTokens,
        percentage: (currentTokens / maxTokens * 100).toFixed(1)
      }
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
      if (result.payload.code) content += ` [Code: ${result.payload.code}]`;
      if (result.payload.function_name) content += ` [Function: ${result.payload.function_name}]`;
      if (result.payload.class_name) content += ` [Class: ${result.payload.class_name}]`;
      
      if (includeMetadata && result.payload.metadata) {
        content += ` [Metadata: ${JSON.stringify(result.payload.metadata)}]`;
      }
    }
    
    return content.trim();
  }

  async storeSearchHistory(userId, query, searchTargets, finalResults, options) {
    try {
      const history = new SearchHistory({
        userId,
        query,
        collections: searchTargets.filter(t => t.type === 'hosted').map(t => t.id),
        tunnels: searchTargets.filter(t => t.type === 'tunnel').map(t => t.id),
        results: {
          totalResults: finalResults.totalResults,
          processedResults: finalResults.processedResults,
          finalTokenCount: finalResults.tokenUsage.used,
          executionTime: finalResults.executionTime
        },
        searchConfig: {
          maxResults: options.maxResults,
          scoreThreshold: options.scoreThreshold,
          maxTokens: options.maxTokens
        }
      });

      await history.save();
    } catch (error) {
      console.error('Failed to store search history:', error);
      // Don't throw error, as this is not critical
    }
  }

  async getSimilarQueries(userId, query, limit = 5) {
    try {
      // Use text-based similarity search instead of embedding-based
      const similarQueries = await SearchHistory.find({
        userId,
        query: { $regex: new RegExp(query.split(' ').join('|'), 'i') }
      })
      .limit(limit)
      .sort({ createdAt: -1 })
      .select('query createdAt results');

      return similarQueries;
    } catch (error) {
      console.error('Failed to get similar queries:', error);
      return [];
    }
  }
}

module.exports = MetaSearchService;
