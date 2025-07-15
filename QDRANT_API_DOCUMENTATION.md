# Qdrant Collections API Documentation

## Overview

This documentation covers the Qdrant Collections API for the tunnel service hosted at `https://tunnel.corrently.cloud`. The service provides managed Qdrant vector database collections with secure access control and seamless integration with your applications.

## Table of Contents

1. [Authentication](#authentication)
2. [Collection Management](#collection-management)
3. [Document Operations](#document-operations)
4. [Semantic Search](#semantic-search)
5. [Error Handling](#error-handling)
6. [Rate Limits](#rate-limits)
7. [Code Examples](#code-examples)
8. [Troubleshooting](#troubleshooting)

## Authentication

All API requests require authentication using your API key. You can obtain your API key from the dashboard at `https://tunnel.corrently.cloud`.

### Authentication Methods

**Bearer Token (Recommended)**
```http
Authorization: Bearer YOUR_API_KEY
```

**Header-based Authentication**
```http
x-auth-token: YOUR_API_KEY
```

## Collection Management

### Create a Collection

Creates a new Qdrant collection with the specified configuration.

**Endpoint:** `POST /api/qdrant/collections`

**Request Body:**
```json
{
  "name": "my-collection",
  "description": "My vector collection for embeddings",
  "vectorSize": 1536,
  "distance": "Cosine"
}
```

**Request Parameters:**
- `name` (required): Collection name (lowercase letters, numbers, hyphens only)
- `description` (optional): Human-readable description
- `vectorSize` (optional): Vector dimension (default: 1536)
- `distance` (optional): Distance metric - "Cosine", "Euclidean", or "Dot" (default: "Cosine")

**Response:**
```json
{
  "_id": "collection_id_here",
  "name": "my-collection",
  "collectionName": "user-123-my-collection",
  "config": {
    "vectorSize": 1536,
    "distance": "Cosine",
    "description": "My vector collection for embeddings"
  },
  "usage": {
    "vectorCount": 0,
    "storageUsed": 0,
    "lastAccessed": "2025-07-14T00:00:00.000Z"
  },
  "isActive": true,
  "createdAt": "2025-07-14T00:00:00.000Z"
}
```

**Example:**
```bash
curl -X POST https://tunnel.corrently.cloud/api/qdrant/collections \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-collection",
    "description": "My vector collection for embeddings",
    "vectorSize": 1536,
    "distance": "Cosine"
  }'
```

### List Collections

Retrieves all collections belonging to the authenticated user.

**Endpoint:** `GET /api/qdrant/collections`

**Response:**
```json
[
  {
    "_id": "collection_id_here",
    "name": "my-collection",
    "collectionName": "user-123-my-collection",
    "config": {
      "vectorSize": 1536,
      "distance": "Cosine",
      "description": "My vector collection for embeddings"
    },
    "usage": {
      "vectorCount": 100,
      "storageUsed": 1024,
      "lastAccessed": "2025-07-14T00:00:00.000Z"
    },
    "isActive": true,
    "createdAt": "2025-07-14T00:00:00.000Z"
  }
]
```

**Example:**
```bash
curl -X GET https://tunnel.corrently.cloud/api/qdrant/collections \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Get Collection Connection Information

Retrieves connection details and usage examples for a specific collection.

**Endpoint:** `GET /api/qdrant/collections/{collection_id}/connection`

**Response:**
```json
{
  "connectionInfo": {
    "url": "https://tunnel.corrently.cloud/api/qdrant/collections/collection_id_here",
    "apiKey": "YOUR_API_KEY",
    "collectionName": "my-collection",
    "internalCollectionName": "user-123-my-collection"
  },
  "examples": {
    "nodeJs": {
      "install": "npm install @qdrant/js-client-rest",
      "code": "const { QdrantClient } = require('@qdrant/js-client-rest');\n\nconst client = new QdrantClient({\n    url: 'https://tunnel.corrently.cloud/api/qdrant/collections/collection_id_here',\n    apiKey: 'YOUR_API_KEY'\n});\n\n// Use your collection name (not the internal name)\nconst collectionName = 'my-collection';\n\n// Example: Search vectors\nconst searchResult = await client.search(collectionName, {\n    vector: [/* your vector here */],\n    limit: 5\n});"
    }
  }
}
```

### Delete Collection

Permanently deletes a collection and all its data.

**Endpoint:** `DELETE /api/qdrant/collections/{collection_id}`

**Response:**
```json
{
  "msg": "Collection deleted"
}
```

**Example:**
```bash
curl -X DELETE https://tunnel.corrently.cloud/api/qdrant/collections/collection_id_here \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Document Operations

### Index (Add) Documents

To add documents to your collection, you'll need to use the Qdrant client libraries directly. First, get your collection connection information, then use the standard Qdrant upsert operation.

**Step 1: Get Collection Connection Info**
```javascript
const response = await fetch('https://tunnel.corrently.cloud/api/qdrant/collections', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});

const collections = await response.json();
const myCollection = collections.find(c => c.name === 'my-collection');
```

**Step 2: Initialize Qdrant Client**
```javascript
const { QdrantClient } = require('@qdrant/js-client-rest');

const client = new QdrantClient({
  url: myCollection.connectionInfo.url,
  apiKey: myCollection.connectionInfo.apiKey,
  checkCompatibility: false // Important: disable version checking
});
```

**Step 3: Add Documents**
```javascript
// Single document
await client.upsert(myCollection.collectionName, {
  wait: true,
  points: [
    {
      id: 1,
      vector: [0.1, 0.2, 0.3, /* ... 1536 dimensions ... */],
      payload: {
        filename: "document.txt",
        content: "Document content here",
        metadata: {
          author: "John Doe",
          created: "2025-07-14T00:00:00.000Z"
        }
      }
    }
  ]
});

// Batch documents
await client.upsert(myCollection.collectionName, {
  wait: true,
  points: [
    {
      id: 1,
      vector: [/* vector 1 */],
      payload: { content: "Document 1" }
    },
    {
      id: 2,
      vector: [/* vector 2 */],
      payload: { content: "Document 2" }
    },
    // ... more documents
  ]
});
```



## Semantic Search

Perform semantic search operations on your collection to find similar documents.

### Basic Search

**JavaScript Example:**
```javascript
const searchResult = await client.search(myCollection.collectionName, {
  vector: [0.1, 0.2, 0.3, /* ... query vector ... */],
  limit: 10,
  with_payload: true,
  score_threshold: 0.7
});

console.log('Search results:', searchResult);
```



### Advanced Search with Filters

**JavaScript Example:**
```javascript
const searchResult = await client.search(myCollection.collectionName, {
  vector: [0.1, 0.2, 0.3, /* ... query vector ... */],
  limit: 10,
  with_payload: true,
  filter: {
    must: [
      {
        key: "metadata.author",
        match: {
          value: "John Doe"
        }
      }
    ]
  }
});
```



### Search with Maximum Character Return

To limit the amount of text returned in search results, you can use the `with_payload` parameter with specific field selection:

**JavaScript Example:**
```javascript
const searchResult = await client.search(myCollection.collectionName, {
  vector: [0.1, 0.2, 0.3, /* ... query vector ... */],
  limit: 10,
  with_payload: ["filename", "metadata"],  // Only return specific fields
  score_threshold: 0.7
});

// Or truncate content in post-processing
const truncatedResults = searchResult.map(result => ({
  ...result,
  payload: {
    ...result.payload,
    content: result.payload.content?.substring(0, 500) + '...' // Limit to 500 characters
  }
}));
```



## Error Handling

### Common Error Responses

**Authentication Error (401)**
```json
{
  "error": "Unauthorized",
  "message": "Invalid API key"
}
```

**Collection Not Found (404)**
```json
{
  "msg": "Collection not found"
}
```

**Invalid Request (400)**
```json
{
  "msg": "Invalid collection name. Use lowercase letters, numbers, and hyphens."
}
```

**Rate Limited (429)**
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later."
}
```

**Plan Limit Exceeded (403)**
```json
{
  "msg": "Collection limit of 1 reached for your plan."
}
```

### Error Handling Best Practices

**JavaScript:**
```javascript
try {
  const result = await client.search(collectionName, searchParams);
  return result;
} catch (error) {
  if (error.status === 404) {
    console.log('Collection not found - may need to recreate');
  } else if (error.status === 401) {
    console.log('Authentication failed - check API key');
  } else if (error.status === 429) {
    console.log('Rate limited - retry with exponential backoff');
  } else {
    console.log('Unexpected error:', error.message);
  }
  throw error;
}
```



## Rate Limits

Rate limits are enforced based on your subscription plan:

- **Free Plan**: 100 requests/hour
- **Basic Plan**: 1,000 requests/hour
- **Pro Plan**: 10,000 requests/hour
- **Enterprise Plan**: 100,000 requests/hour

### Rate Limit Headers

Response headers include rate limit information:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642678800
```

## Code Examples

### Complete Integration Example

**JavaScript/Node.js:**
```javascript
const { QdrantClient } = require('@qdrant/js-client-rest');

class QdrantService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://tunnel.corrently.cloud/api';
  }

  async getCollections() {
    const response = await fetch(`${this.baseUrl}/qdrant/collections`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    return await response.json();
  }

  async getClient(collectionName) {
    const collections = await this.getCollections();
    const collection = collections.find(c => c.name === collectionName);
    
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    const connectionInfo = await this.getConnectionInfo(collection._id);
    
    return new QdrantClient({
      url: connectionInfo.connectionInfo.url,
      apiKey: connectionInfo.connectionInfo.apiKey,
      checkCompatibility: false
    });
  }

  async getConnectionInfo(collectionId) {
    const response = await fetch(`${this.baseUrl}/qdrant/collections/${collectionId}/connection`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    return await response.json();
  }

  async addDocuments(collectionName, documents) {
    const client = await this.getClient(collectionName);
    
    const points = documents.map((doc, index) => ({
      id: doc.id || index + 1,
      vector: doc.vector,
      payload: doc.payload
    }));

    return await client.upsert(collectionName, {
      wait: true,
      points: points
    });
  }

  async searchDocuments(collectionName, queryVector, limit = 10, maxContentLength = 500) {
    const client = await this.getClient(collectionName);
    
    const results = await client.search(collectionName, {
      vector: queryVector,
      limit: limit,
      with_payload: true,
      score_threshold: 0.7
    });

    // Truncate content if specified
    if (maxContentLength > 0) {
      results.forEach(result => {
        if (result.payload && result.payload.content) {
          result.payload.content = result.payload.content.substring(0, maxContentLength);
          if (result.payload.content.length === maxContentLength) {
            result.payload.content += '...';
          }
        }
      });
    }

    return results;
  }
}

// Usage
const qdrantService = new QdrantService('YOUR_API_KEY');

// Add documents
await qdrantService.addDocuments('my-collection', [
  {
    id: 1,
    vector: [0.1, 0.2, 0.3, /* ... */],
    payload: {
      filename: 'doc1.txt',
      content: 'Document content here',
      metadata: { author: 'John Doe' }
    }
  }
]);

// Search with character limit
const results = await qdrantService.searchDocuments(
  'my-collection',
  [0.1, 0.2, 0.3, /* query vector */],
  10,
  500 // Maximum 500 characters returned
);
```



## Troubleshooting

### Common Issues

1. **"Collection not found" Error**
   - Verify collection exists by listing collections
   - Check collection ID is correct
   - Ensure using the right API key

2. **"Authentication failed" Error**
   - Verify API key is valid
   - Check API key format in headers
   - Ensure API key is not expired

3. **"Invalid collection name" Error**
   - Use only lowercase letters, numbers, and hyphens
   - Name must be between 1-63 characters
   - Cannot start or end with hyphens

4. **Version Compatibility Issues**
   - Always use `checkCompatibility: false` in client config
   - Use the latest official Qdrant client libraries

### Testing Your Setup

```javascript
// Test collection connection
const response = await fetch('https://tunnel.corrently.cloud/api/qdrant/collections/collection_id/test-connection', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});

const result = await response.json();
console.log('Connection test:', result);
```

### Support

For additional support:
- Check the full documentation at `/docs/qdrant-collections-integration.md`
- Visit the dashboard at `https://tunnel.corrently.cloud`
- Use the built-in connection testing tools
- Contact support through the dashboard

---

*This documentation covers the Qdrant Collections API for the tunnel service. For the latest updates and examples, visit the service dashboard.*
