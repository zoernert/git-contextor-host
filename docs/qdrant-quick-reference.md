# Qdrant Collections Quick Reference

## Quick Start

### 1. Get Your API Key
Visit `https://tunnel.corrently.cloud` → Login → Copy API key from dashboard

### 2. Create Collection
```bash
curl -X POST https://tunnel.corrently.cloud/api/qdrant/collections \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-collection",
    "description": "My Git Contextor collection",
    "vectorSize": 1536,
    "distance": "Cosine"
  }'
```

### 3. Use with Qdrant Client
```javascript
const { QdrantClient } = require('@qdrant/js-client-rest');

// Get collection info
const collections = await fetch('https://tunnel.corrently.cloud/api/qdrant/collections', {
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
}).then(res => res.json());

const myCollection = collections.find(c => c.name === 'my-collection');

// Initialize client
const client = new QdrantClient({
  url: myCollection.tunnelInfo.url,
  apiKey: myCollection.tunnelInfo.apiKey,
  checkCompatibility: false
});

// Store vector
await client.upsert(myCollection.collectionName, {
  points: [{
    id: 1,
    vector: [0.1, 0.2, 0.3, ...], // Your 1536-dimensional vector
    payload: { filename: 'example.js', content: 'file content' }
  }]
});

// Search
const results = await client.search(myCollection.collectionName, {
  vector: [0.1, 0.2, 0.3, ...], // Query vector
  limit: 10
});
```

## Essential API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/qdrant/collections` | List your collections |
| `POST` | `/api/qdrant/collections` | Create new collection |
| `POST` | `/api/qdrant/collections/{id}/test-connection` | Test collection health |
| `DELETE` | `/api/qdrant/collections/{id}` | Delete collection |

## Common Patterns

### Git Contextor Integration
```javascript
// Store file embedding
await client.upsert(collectionName, {
  points: [{
    id: `file-${Date.now()}`,
    vector: embedding,
    payload: {
      filepath: 'src/components/Button.jsx',
      content: fileContent.substring(0, 1000),
      language: 'javascript',
      repository: 'my-repo',
      timestamp: new Date().toISOString()
    }
  }]
});

// Search similar files
const similar = await client.search(collectionName, {
  vector: queryEmbedding,
  limit: 5,
  filter: {
    must: [
      { key: 'language', match: { value: 'javascript' } }
    ]
  }
});
```

### Error Handling
```javascript
try {
  const result = await client.search(collectionName, searchParams);
} catch (error) {
  if (error.status === 404) {
    console.log('Collection not found - may need to recreate');
  } else if (error.status === 401) {
    console.log('Authentication failed - check API key');
  } else {
    console.log('Unexpected error:', error.message);
  }
}
```

## Environment Variables

```bash
# .env file for your Git Contextor project
QDRANT_SERVICE_URL=https://tunnel.corrently.cloud/api
QDRANT_API_KEY=your_api_key_here
QDRANT_COLLECTION_NAME=your_collection_name
```

## Troubleshooting Checklist

- ✅ API key is valid and not expired
- ✅ Collection exists and is active
- ✅ Using correct collection name (internal name, not display name)
- ✅ Vector dimensions match collection configuration
- ✅ Using `checkCompatibility: false` in client config
- ✅ Proper error handling for network issues

## Support

- 📖 Full documentation: `/docs/qdrant-collections-integration.md`
- 🌐 Dashboard: `https://tunnel.corrently.cloud`
- 🔧 Test connection: Use the dashboard or API endpoint
- 💬 Support: Contact through dashboard
