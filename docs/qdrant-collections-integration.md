# Qdrant Collections Service - Developer Integration Guide

## Overview

The Git Contextor Host provides a managed Qdrant vector database service that allows developers to store and query vector embeddings without managing their own Qdrant infrastructure. This service is designed to work seamlessly with Git Contextor and other applications that need vector search capabilities.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Collection Management](#collection-management)
4. [API Endpoints](#api-endpoints)
5. [Client Integration](#client-integration)
6. [Code Examples](#code-examples)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites

- Active account on the Git Contextor Host service
- API key from your user dashboard
- Basic understanding of vector embeddings and similarity search

### Service Features

- **Hosted Qdrant**: Fully managed Qdrant vector database
- **Collection Management**: Create, update, and delete collections via API
- **Secure Access**: User-isolated collections with API key authentication
- **Tunnel Integration**: Seamless integration with tunnel service for local development
- **Connection Testing**: Built-in connection testing and health monitoring

## Authentication

All API requests require authentication using your API key. Include the API key in the request headers:

```bash
Authorization: Bearer YOUR_API_KEY
```

You can find your API key in your user dashboard at `https://tunnel.corrently.cloud`.

## Collection Management

### Collection Structure

Each collection has the following properties:

```json
{
  "_id": "collection_id",
  "name": "user-friendly-name",
  "collectionName": "user-{userId}-{name}",
  "config": {
    "vectorSize": 1536,
    "distance": "Cosine",
    "description": "Collection description"
  },
  "usage": {
    "vectorCount": 0,
    "storageUsed": 0,
    "lastAccessed": "2025-07-13T00:00:00.000Z"
  },
  "tunnelInfo": {
    "tunnelPath": "qdrant-collection-name-xyz",
    "url": "https://tunnel.corrently.cloud/qdrant/qdrant-collection-name-xyz",
    "apiKey": "generated_api_key"
  }
}
```

### Collection Naming

- User-friendly names: Use lowercase letters, numbers, and hyphens
- Internal names: Automatically prefixed with `user-{userId}-` for isolation
- Tunnel paths: Automatically generated for secure access

## API Endpoints

### Base URL
```
https://tunnel.corrently.cloud/api
```

### Collection Management Endpoints

#### List Collections
```http
GET /api/qdrant/collections
Authorization: Bearer YOUR_API_KEY
```

Response:
```json
[
  {
    "_id": "collection_id",
    "name": "my-collection",
    "collectionName": "user-123-my-collection",
    "config": { ... },
    "usage": { ... },
    "tunnelInfo": { ... }
  }
]
```

#### Create Collection
```http
POST /api/qdrant/collections
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "name": "my-new-collection",
  "description": "Collection for Git Contextor embeddings",
  "vectorSize": 1536,
  "distance": "Cosine"
}
```

#### Get Collection Details
```http
GET /api/qdrant/collections/{collection_id}
Authorization: Bearer YOUR_API_KEY
```

#### Test Connection
```http
POST /api/qdrant/collections/{collection_id}/test-connection
Authorization: Bearer YOUR_API_KEY
```

Response:
```json
{
  "success": true,
  "message": "Connection successful",
  "collectionInfo": {
    "status": "green",
    "points_count": 1000,
    "config": { ... }
  }
}
```

#### Delete Collection
```http
DELETE /api/qdrant/collections/{collection_id}
Authorization: Bearer YOUR_API_KEY
```

## Client Integration

### Using the Qdrant JavaScript Client

Install the official Qdrant client:
```bash
npm install @qdrant/js-client-rest
```

Configure the client to use your hosted collection:

```javascript
const { QdrantClient } = require('@qdrant/js-client-rest');

// Get collection info from the API first
const collectionInfo = await fetch('https://tunnel.corrently.cloud/api/qdrant/collections', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
}).then(res => res.json());

const collection = collectionInfo.find(c => c.name === 'my-collection');

// Initialize client with tunnel URL
const client = new QdrantClient({
  url: collection.tunnelInfo.url,
  apiKey: collection.tunnelInfo.apiKey,
  checkCompatibility: false // Important: disable version checking
});

// Use the internal collection name for operations
const collectionName = collection.collectionName;
```

### Direct HTTP API Access

You can also access the Qdrant API directly through the tunnel:

```javascript
// Using the tunnel proxy URL
const baseUrl = collection.tunnelInfo.url;
const apiKey = collection.tunnelInfo.apiKey;

// List collections
const response = await fetch(`${baseUrl}/collections`, {
  headers: {
    'Api-Key': apiKey,
    'Content-Type': 'application/json'
  }
});
```

## Code Examples

### Complete Git Contextor Integration Example

```javascript
class GitContextorQdrantService {
  constructor(apiKey, baseUrl = 'https://tunnel.corrently.cloud') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.collections = new Map();
  }

  async initializeCollection(name, vectorSize = 1536) {
    // Create collection via management API
    const response = await fetch(`${this.baseUrl}/api/qdrant/collections`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        description: `Git Contextor collection for ${name}`,
        vectorSize,
        distance: 'Cosine'
      })
    });

    const collection = await response.json();
    
    // Initialize Qdrant client
    const { QdrantClient } = require('@qdrant/js-client-rest');
    const client = new QdrantClient({
      url: collection.tunnelInfo.url,
      apiKey: collection.tunnelInfo.apiKey,
      checkCompatibility: false
    });

    this.collections.set(name, {
      client,
      collectionName: collection.collectionName,
      info: collection
    });

    return collection;
  }

  async storeEmbedding(collectionName, id, vector, payload = {}) {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not initialized`);
    }

    return await collection.client.upsert(collection.collectionName, {
      wait: true,
      points: [{
        id,
        vector,
        payload
      }]
    });
  }

  async searchSimilar(collectionName, queryVector, limit = 10) {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not initialized`);
    }

    return await collection.client.search(collection.collectionName, {
      vector: queryVector,
      limit,
      with_payload: true
    });
  }

  async testConnection(collectionName) {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not initialized`);
    }

    const response = await fetch(`${this.baseUrl}/api/qdrant/collections/${collection.info._id}/test-connection`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    return await response.json();
  }
}

// Usage example
const qdrantService = new GitContextorQdrantService('your-api-key');

// Initialize collection
await qdrantService.initializeCollection('git-repo-embeddings');

// Store embedding
await qdrantService.storeEmbedding('git-repo-embeddings', 'file-1', 
  new Array(1536).fill(0).map(() => Math.random()), // Your actual embedding
  { 
    filename: 'src/main.js',
    content: 'file content snippet',
    timestamp: new Date().toISOString()
  }
);

// Search similar
const results = await qdrantService.searchSimilar('git-repo-embeddings', queryVector);
```

### Python Integration Example

```python
import requests
import json
from qdrant_client import QdrantClient

class GitContextorQdrantService:
    def __init__(self, api_key, base_url="https://tunnel.corrently.cloud"):
        self.api_key = api_key
        self.base_url = base_url
        self.collections = {}
    
    def initialize_collection(self, name, vector_size=1536):
        # Create collection via management API
        response = requests.post(
            f"{self.base_url}/api/qdrant/collections",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            json={
                "name": name,
                "description": f"Git Contextor collection for {name}",
                "vectorSize": vector_size,
                "distance": "Cosine"
            }
        )
        
        collection_info = response.json()
        
        # Initialize Qdrant client
        client = QdrantClient(
            url=collection_info["tunnelInfo"]["url"],
            api_key=collection_info["tunnelInfo"]["apiKey"]
        )
        
        self.collections[name] = {
            "client": client,
            "collection_name": collection_info["collectionName"],
            "info": collection_info
        }
        
        return collection_info
    
    def store_embedding(self, collection_name, point_id, vector, payload=None):
        collection = self.collections.get(collection_name)
        if not collection:
            raise ValueError(f"Collection {collection_name} not initialized")
        
        return collection["client"].upsert(
            collection_name=collection["collection_name"],
            wait=True,
            points=[{
                "id": point_id,
                "vector": vector,
                "payload": payload or {}
            }]
        )
    
    def search_similar(self, collection_name, query_vector, limit=10):
        collection = self.collections.get(collection_name)
        if not collection:
            raise ValueError(f"Collection {collection_name} not initialized")
        
        return collection["client"].search(
            collection_name=collection["collection_name"],
            query_vector=query_vector,
            limit=limit,
            with_payload=True
        )
```

## Best Practices

### 1. Collection Management

- **Use descriptive names**: Choose collection names that reflect their purpose
- **One collection per project**: Keep different projects in separate collections
- **Regular cleanup**: Delete unused collections to optimize resources

### 2. Vector Operations

- **Batch operations**: Use batch upsert for better performance
- **Consistent vector sizes**: Ensure all vectors in a collection have the same size
- **Meaningful payloads**: Include relevant metadata in payloads for filtering

### 3. Error Handling

```javascript
async function safeQdrantOperation(operation) {
  try {
    return await operation();
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('Authentication failed. Check your API key.');
    } else if (error.response?.status === 404) {
      throw new Error('Collection not found or deleted.');
    } else if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please retry later.');
    }
    throw error;
  }
}
```

### 4. Performance Optimization

- **Connection pooling**: Reuse Qdrant client instances
- **Async operations**: Use async/await for better concurrency
- **Batch processing**: Process multiple vectors in batches

## Troubleshooting

### Common Issues

#### 1. Connection Failed
```json
{
  "success": false,
  "message": "Connection failed"
}
```

**Solutions:**
- Check your API key validity
- Verify the collection exists and is active
- Test connection using the test endpoint

#### 2. Version Compatibility
```
Client version 1.14.1 is incompatible with server version 1.11.4
```

**Solution:**
```javascript
const client = new QdrantClient({
  url: collection.tunnelInfo.url,
  apiKey: collection.tunnelInfo.apiKey,
  checkCompatibility: false // Add this line
});
```

#### 3. Collection Not Found
```json
{
  "msg": "Collection not found"
}
```

**Solutions:**
- Verify collection ID is correct
- Check if collection was deleted
- Ensure you're using the correct API key

#### 4. Authentication Errors
```json
{
  "msg": "Access denied"
}
```

**Solutions:**
- Verify API key is included in headers
- Check API key format: `Bearer YOUR_API_KEY`
- Ensure API key is active and not expired

### Debug Mode

Enable debug logging in your application:

```javascript
const debug = require('debug')('qdrant-service');

debug('Initializing collection:', collectionName);
debug('Using tunnel URL:', collection.tunnelInfo.url);
debug('Collection info:', collection);
```

### Health Check

Always test your connection before performing operations:

```javascript
const healthCheck = await fetch(`${baseUrl}/api/qdrant/collections/${collectionId}/test-connection`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`
  }
});

const result = await healthCheck.json();
if (!result.success) {
  throw new Error(`Health check failed: ${result.message}`);
}
```

## Rate Limits and Quotas

The service includes the following limits based on your subscription plan:

- **Free Plan**: 1 collection, 10,000 vectors
- **Pro Plan**: 10 collections, 1,000,000 vectors
- **Enterprise Plan**: Unlimited collections and vectors

Monitor your usage through the dashboard to avoid hitting limits.

## Support

For technical support or questions:

1. Check the [troubleshooting section](#troubleshooting) above
2. Review the API documentation
3. Contact support through the dashboard
4. Join our developer community

## Migration Guide

### From Local Qdrant to Hosted Service

1. **Export your data** from local Qdrant:
```bash
# Export collection data
curl -X GET "http://localhost:6333/collections/my-collection/points" \
  -H "Content-Type: application/json" > collection-data.json
```

2. **Create hosted collection**:
```javascript
const collection = await qdrantService.initializeCollection('my-collection');
```

3. **Import data**:
```javascript
const data = JSON.parse(fs.readFileSync('collection-data.json'));
await qdrantService.storeEmbedding('my-collection', data.points);
```

4. **Update your application** to use the hosted service URLs.

## Changelog

### v1.0.0 (2025-07-13)
- Initial release of Qdrant Collections service
- Collection management API
- Tunnel integration
- Connection testing
- User dashboard integration

---

*This documentation is maintained by the Git Contextor Host team. For updates and contributions, please visit our repository.*
