# Git Contextor Integration with Hosted Qdrant Collections

This guide explains how to integrate Git Contextor with the hosted Qdrant Collections service, replacing the need for a local Qdrant server.

## Overview

The hosted Qdrant Collections service provides:
- Managed Qdrant vector database
- User-isolated collections
- Automatic tunnel creation for secure access
- Built-in authentication and connection management

## Integration Steps

### 1. Account Setup

1. Create account at `https://tunnel.corrently.cloud`
2. Get your API key from the dashboard
3. Note your collection limits based on your plan

### 2. Git Contextor Configuration

Update your Git Contextor configuration to use the hosted service:

```json
{
  "vectorDatabase": {
    "provider": "hosted-qdrant",
    "hostedQdrant": {
      "apiUrl": "https://tunnel.corrently.cloud/api",
      "apiKey": "your_api_key_here",
      "collectionName": "git-contextor-main"
    }
  }
}
```

### 3. Implementation

#### Service Provider Class

```javascript
// src/providers/HostedQdrantProvider.js
const { QdrantClient } = require('@qdrant/js-client-rest');

class HostedQdrantProvider {
  constructor(config) {
    this.apiUrl = config.apiUrl;
    this.apiKey = config.apiKey;
    this.defaultCollectionName = config.collectionName || 'git-contextor-default';
    this.collections = new Map();
  }

  async initialize() {
    // Ensure default collection exists
    await this.ensureCollection(this.defaultCollectionName);
  }

  async ensureCollection(name, vectorSize = 1536) {
    if (this.collections.has(name)) {
      return this.collections.get(name);
    }

    // Check if collection exists
    const existing = await this.getCollection(name);
    if (existing) {
      await this.initializeClient(existing);
      return existing;
    }

    // Create new collection
    const response = await fetch(`${this.apiUrl}/qdrant/collections`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        description: `Git Contextor collection: ${name}`,
        vectorSize,
        distance: 'Cosine'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create collection: ${response.statusText}`);
    }

    const collection = await response.json();
    await this.initializeClient(collection);
    return collection;
  }

  async getCollection(name) {
    const response = await fetch(`${this.apiUrl}/qdrant/collections`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to list collections: ${response.statusText}`);
    }

    const collections = await response.json();
    return collections.find(c => c.name === name);
  }

  async initializeClient(collection) {
    const client = new QdrantClient({
      url: collection.tunnelInfo.url,
      apiKey: collection.tunnelInfo.apiKey,
      checkCompatibility: false
    });

    this.collections.set(collection.name, {
      client,
      collectionName: collection.collectionName,
      info: collection
    });

    return client;
  }

  async storeFileEmbedding(filePath, embedding, metadata = {}) {
    const collection = this.collections.get(this.defaultCollectionName);
    if (!collection) {
      throw new Error('Default collection not initialized');
    }

    const id = this.generateFileId(filePath);
    
    return await collection.client.upsert(collection.collectionName, {
      wait: true,
      points: [{
        id,
        vector: embedding,
        payload: {
          filepath: filePath,
          ...metadata,
          timestamp: new Date().toISOString(),
          type: 'file'
        }
      }]
    });
  }

  async searchSimilarFiles(queryEmbedding, options = {}) {
    const {
      limit = 10,
      collectionName = this.defaultCollectionName,
      filter = null
    } = options;

    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not initialized`);
    }

    const searchParams = {
      vector: queryEmbedding,
      limit,
      with_payload: true
    };

    if (filter) {
      searchParams.filter = filter;
    }

    return await collection.client.search(collection.collectionName, searchParams);
  }

  async deleteFileEmbedding(filePath) {
    const collection = this.collections.get(this.defaultCollectionName);
    if (!collection) {
      throw new Error('Default collection not initialized');
    }

    const id = this.generateFileId(filePath);
    
    return await collection.client.delete(collection.collectionName, {
      points: [id]
    });
  }

  async getCollectionStats(collectionName = this.defaultCollectionName) {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not initialized`);
    }

    return await collection.client.getCollection(collection.collectionName);
  }

  generateFileId(filePath) {
    // Generate consistent ID for file path
    return Buffer.from(filePath).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  }

  async healthCheck() {
    try {
      const collection = this.collections.get(this.defaultCollectionName);
      if (!collection) {
        return { healthy: false, error: 'Collection not initialized' };
      }

      // Test connection using the management API
      const response = await fetch(`${this.apiUrl}/qdrant/collections/${collection.info._id}/test-connection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      const result = await response.json();
      return {
        healthy: result.success,
        details: result
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}

module.exports = HostedQdrantProvider;
```

#### Integration in Git Contextor

```javascript
// src/services/VectorService.js
const HostedQdrantProvider = require('../providers/HostedQdrantProvider');

class VectorService {
  constructor(config) {
    this.config = config;
    this.provider = null;
  }

  async initialize() {
    if (this.config.vectorDatabase.provider === 'hosted-qdrant') {
      this.provider = new HostedQdrantProvider(this.config.vectorDatabase.hostedQdrant);
    } else {
      // Fallback to local Qdrant or other providers
      this.provider = new LocalQdrantProvider(this.config.vectorDatabase.local);
    }

    await this.provider.initialize();
  }

  async indexFile(filePath, content) {
    try {
      // Generate embedding for file content
      const embedding = await this.generateEmbedding(content);
      
      // Extract metadata
      const metadata = {
        size: Buffer.byteLength(content, 'utf8'),
        language: this.detectLanguage(filePath),
        lastModified: new Date().toISOString(),
        repository: this.config.repository.name || 'unknown'
      };

      // Store in vector database
      await this.provider.storeFileEmbedding(filePath, embedding, metadata);
      
      console.log(`Indexed file: ${filePath}`);
    } catch (error) {
      console.error(`Failed to index file ${filePath}:`, error.message);
      throw error;
    }
  }

  async searchSimilar(query, options = {}) {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      const results = await this.provider.searchSimilarFiles(queryEmbedding, {
        limit: options.limit || 10,
        filter: options.filter
      });

      return results.map(result => ({
        filepath: result.payload.filepath,
        score: result.score,
        metadata: result.payload
      }));
    } catch (error) {
      console.error('Search failed:', error.message);
      throw error;
    }
  }

  async removeFile(filePath) {
    try {
      await this.provider.deleteFileEmbedding(filePath);
      console.log(`Removed file from index: ${filePath}`);
    } catch (error) {
      console.error(`Failed to remove file ${filePath}:`, error.message);
      throw error;
    }
  }

  async getStatus() {
    try {
      const health = await this.provider.healthCheck();
      const stats = await this.provider.getCollectionStats();
      
      return {
        healthy: health.healthy,
        provider: 'hosted-qdrant',
        pointsCount: stats.points_count || 0,
        details: health.details
      };
    } catch (error) {
      return {
        healthy: false,
        provider: 'hosted-qdrant',
        error: error.message
      };
    }
  }

  async generateEmbedding(text) {
    // Your embedding generation logic here
    // This could use OpenAI, Hugging Face, or other embedding models
    throw new Error('Embedding generation not implemented');
  }

  detectLanguage(filePath) {
    const ext = filePath.split('.').pop();
    const languageMap = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'php': 'php',
      'rb': 'ruby'
    };
    return languageMap[ext] || 'unknown';
  }
}

module.exports = VectorService;
```

## Usage Examples

### Basic File Indexing

```javascript
const vectorService = new VectorService(config);
await vectorService.initialize();

// Index a file
const fileContent = fs.readFileSync('src/components/Button.jsx', 'utf8');
await vectorService.indexFile('src/components/Button.jsx', fileContent);

// Search for similar files
const results = await vectorService.searchSimilar('button component with props');
console.log('Similar files:', results);
```

### Batch Processing

```javascript
async function indexRepository(repoPath) {
  const files = await glob('**/*.{js,ts,jsx,tsx}', { cwd: repoPath });
  
  for (const file of files) {
    const content = await fs.readFile(path.join(repoPath, file), 'utf8');
    await vectorService.indexFile(file, content);
  }
  
  console.log(`Indexed ${files.length} files`);
}
```

### Advanced Search with Filters

```javascript
// Search only JavaScript files
const jsResults = await vectorService.searchSimilar('authentication logic', {
  limit: 5,
  filter: {
    must: [
      { key: 'language', match: { value: 'javascript' } }
    ]
  }
});

// Search recent files only
const recentResults = await vectorService.searchSimilar('error handling', {
  limit: 5,
  filter: {
    must: [
      {
        key: 'timestamp',
        range: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      }
    ]
  }
});
```

## Environment Configuration

### Development
```bash
# .env.development
VECTOR_DATABASE_PROVIDER=hosted-qdrant
HOSTED_QDRANT_API_URL=https://tunnel.corrently.cloud/api
HOSTED_QDRANT_API_KEY=your_dev_api_key
HOSTED_QDRANT_COLLECTION=git-contextor-dev
```

### Production
```bash
# .env.production
VECTOR_DATABASE_PROVIDER=hosted-qdrant
HOSTED_QDRANT_API_URL=https://tunnel.corrently.cloud/api
HOSTED_QDRANT_API_KEY=your_prod_api_key
HOSTED_QDRANT_COLLECTION=git-contextor-prod
```

## Migration from Local Qdrant

### 1. Export Existing Data

```javascript
async function exportCollection(localClient, collectionName) {
  const points = [];
  let offset = null;
  
  do {
    const response = await localClient.scroll(collectionName, {
      limit: 100,
      offset,
      with_payload: true,
      with_vector: true
    });
    
    points.push(...response.points);
    offset = response.next_page_offset;
  } while (offset);
  
  return points;
}
```

### 2. Import to Hosted Service

```javascript
async function importToHosted(hostedProvider, points) {
  const batchSize = 100;
  
  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);
    
    await hostedProvider.collections.get('default').client.upsert(
      hostedProvider.collections.get('default').collectionName,
      {
        wait: true,
        points: batch
      }
    );
    
    console.log(`Imported batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(points.length/batchSize)}`);
  }
}
```

## Monitoring and Debugging

### Health Monitoring

```javascript
async function monitorHealth() {
  const status = await vectorService.getStatus();
  
  if (!status.healthy) {
    console.error('Vector service unhealthy:', status.error);
    // Implement retry logic or alerts
  }
  
  console.log(`Vector database: ${status.pointsCount} points indexed`);
}

// Run health check every 5 minutes
setInterval(monitorHealth, 5 * 60 * 1000);
```

### Debug Logging

```javascript
const debug = require('debug')('git-contextor:vector');

debug('Initializing hosted Qdrant provider');
debug('Collection info:', collection);
debug('Search results count:', results.length);
```

## Best Practices

1. **Collection Management**:
   - Use separate collections for different repositories
   - Include repository name in collection naming
   - Regularly clean up unused collections

2. **Error Handling**:
   - Implement retry logic for network failures
   - Graceful fallback when vector service is unavailable
   - Log errors for debugging

3. **Performance**:
   - Batch operations when possible
   - Use connection pooling
   - Implement caching for frequent queries

4. **Security**:
   - Store API keys securely
   - Use environment variables for configuration
   - Regularly rotate API keys

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Verify API key and permissions
2. **Collection Not Found**: Check collection name and creation status
3. **Vector Dimension Mismatch**: Ensure embedding size matches collection config
4. **Rate Limiting**: Implement backoff and retry logic

### Debug Commands

```bash
# Test API connectivity
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://tunnel.corrently.cloud/api/qdrant/collections

# Test collection health
curl -X POST -H "Authorization: Bearer YOUR_API_KEY" \
  https://tunnel.corrently.cloud/api/qdrant/collections/COLLECTION_ID/test-connection
```

This integration guide provides everything needed to replace local Qdrant with the hosted service in Git Contextor applications.
