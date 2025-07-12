# Qdrant Collections User Guide

## Overview
This guide explains how to use Qdrant collections through the tunnel service at `tunnel.corrently.cloud`. The service allows you to create and manage vector databases with direct access using standard Qdrant clients.

## Getting Started

### 1. Prerequisites
- Active account at tunnel.corrently.cloud
- Valid API key
- Subscription plan that includes Qdrant collections (Basic, Pro, or Enterprise)

### 2. Plan Limits
- **Free Plan**: 0 collections
- **Basic Plan**: 1 collection
- **Pro Plan**: 5 collections
- **Enterprise Plan**: Unlimited collections

## Creating Collections

### Via Web Interface
1. Log in to your dashboard at tunnel.corrently.cloud
2. Navigate to "Qdrant Collections" in the sidebar
3. Click "Create New Collection"
4. Fill in the collection details:
   - **Name**: Lowercase letters, numbers, and hyphens only
   - **Description**: Optional description
   - **Vector Size**: Dimension of your vectors (default: 1536)
   - **Distance Metric**: Cosine, Euclidean, or Dot Product

### Via API
```bash
curl -X POST https://tunnel.corrently.cloud/api/qdrant/collections \
  -H "x-auth-token: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-collection",
    "description": "My vector collection",
    "vectorSize": 1536,
    "distance": "Cosine"
  }'
```

## Connecting to Your Collections

### Getting Connection Information
1. In the web interface, click "Connect" on your collection
2. Copy the connection URL and API key
3. Use these credentials with standard Qdrant clients

### Connection Details
- **URL**: `https://tunnel.corrently.cloud/qdrant/your-tunnel-path`
- **API Key**: Generated unique key for your collection
- **Protocol**: HTTPS
- **Port**: 443

## Using Standard Qdrant Clients

### Node.js
```javascript
const { QdrantClient } = require('@qdrant/js-client-rest');

const client = new QdrantClient({
    url: 'https://tunnel.corrently.cloud/qdrant/your-tunnel-path',
    apiKey: 'your-collection-api-key'
});

// Use your collection name (not the internal prefixed name)
const collectionName = 'my-collection';

// Example: Insert points
await client.upsert(collectionName, {
    wait: true,
    points: [
        {
            id: 1,
            vector: [0.1, 0.2, 0.3, /* ... more values ... */],
            payload: { name: "Document 1" }
        }
    ]
});

// Example: Search vectors
const searchResult = await client.search(collectionName, {
    vector: [0.1, 0.2, 0.3, /* ... query vector ... */],
    limit: 5
});
```

### Python
```python
from qdrant_client import QdrantClient

client = QdrantClient(
    url="https://tunnel.corrently.cloud/qdrant/your-tunnel-path",
    api_key="your-collection-api-key"
)

# Use your collection name (not the internal prefixed name)
collection_name = "my-collection"

# Example: Insert points
client.upsert(
    collection_name=collection_name,
    points=[
        {
            "id": 1,
            "vector": [0.1, 0.2, 0.3],  # Your vector here
            "payload": {"name": "Document 1"}
        }
    ]
)

# Example: Search vectors
search_result = client.search(
    collection_name=collection_name,
    query_vector=[0.1, 0.2, 0.3],  # Your query vector
    limit=5
)
```

### cURL
```bash
# Insert points
curl -X POST "https://tunnel.corrently.cloud/qdrant/your-tunnel-path/collections/my-collection/points" \
  -H "Api-Key: your-collection-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "points": [
      {
        "id": 1,
        "vector": [0.1, 0.2, 0.3],
        "payload": {"name": "Document 1"}
      }
    ]
  }'

# Search vectors
curl -X POST "https://tunnel.corrently.cloud/qdrant/your-tunnel-path/collections/my-collection/points/search" \
  -H "Api-Key: your-collection-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "vector": [0.1, 0.2, 0.3],
    "limit": 5
  }'
```

## Key Features

### Collection Name Mapping
- **User Name**: `my-collection` (what you use in your code)
- **Internal Name**: `user-{userId}-my-collection` (handled automatically)
- Always use your collection name in API calls, not the internal name

### Authentication
- Each collection has a unique API key
- Use the `Api-Key` header for authentication
- Keys are automatically generated when creating tunnels

### Data Isolation
- Collections are isolated by user
- You can only access your own collections
- Collection names are prefixed internally for security

## Managing Collections

### List Collections
```bash
curl -X GET https://tunnel.corrently.cloud/api/qdrant/collections \
  -H "x-auth-token: YOUR_API_KEY"
```

### Get Connection Information
```bash
curl -X GET https://tunnel.corrently.cloud/api/qdrant/collections/{collection-id}/connection \
  -H "x-auth-token: YOUR_API_KEY"
```

### Test Connection
```bash
curl -X POST https://tunnel.corrently.cloud/api/qdrant/collections/{collection-id}/test-connection \
  -H "x-auth-token: YOUR_API_KEY"
```

### Delete Collection
```bash
curl -X DELETE https://tunnel.corrently.cloud/api/qdrant/collections/{collection-id} \
  -H "x-auth-token: YOUR_API_KEY"
```

## Usage Tracking

### Monitored Metrics
- Number of vectors stored
- Storage used
- API requests made
- Data transfer

### Viewing Usage
1. Go to your collection in the web interface
2. Click on usage statistics
3. View detailed metrics and limits

## Common Operations

### Creating a Collection for OpenAI Embeddings
```javascript
// OpenAI text-embedding-ada-002 uses 1536 dimensions
const client = new QdrantClient({
    url: 'https://tunnel.corrently.cloud/qdrant/your-tunnel-path',
    apiKey: 'your-collection-api-key'
});

// Collection is already created through the web interface
const collectionName = 'openai-embeddings';
```

### Storing Document Embeddings
```javascript
// Store document with embedding
await client.upsert(collectionName, {
    points: [
        {
            id: "doc-1",
            vector: embedding_vector, // From OpenAI API
            payload: {
                text: "Original document text",
                url: "https://example.com/doc1",
                metadata: { category: "documentation" }
            }
        }
    ]
});
```

### Semantic Search
```javascript
// Search for similar documents
const results = await client.search(collectionName, {
    vector: query_embedding, // From OpenAI API
    limit: 10,
    with_payload: true,
    score_threshold: 0.7
});
```

## Best Practices

### 1. Collection Design
- Use descriptive collection names
- Choose appropriate vector dimensions
- Select the right distance metric for your use case

### 2. Data Management
- Batch insert operations for better performance
- Use meaningful payload data
- Implement proper error handling

### 3. Security
- Keep API keys secure
- Rotate keys regularly if needed
- Use HTTPS for all connections

### 4. Performance
- Use appropriate batch sizes (100-1000 points)
- Implement connection pooling for high-traffic applications
- Monitor usage and optimize queries

## Troubleshooting

### Common Issues

#### Connection Failed
- Verify the tunnel URL and API key
- Check that the collection exists and is active
- Ensure your subscription plan supports Qdrant collections

#### Authentication Error
- Verify API key is correct
- Check that the collection hasn't been deleted
- Ensure you're using the collection API key, not your account API key

#### Collection Not Found
- Verify you're using the correct collection name
- Check that the collection is active
- Ensure the tunnel is properly created

### Testing Your Connection
Use the built-in connection test feature in the web interface or API to verify your setup.

## Support

For additional help:
1. Check the web interface for connection examples
2. Use the built-in connection testing tools
3. Contact support through the tunnel service

---

*This guide covers the enhanced Qdrant collection functionality available with the tunnel service integration.*
