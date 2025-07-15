# Secure Qdrant Client Integration Guide

⚠️ **CRITICAL SECURITY REQUIREMENTS**

## 🔒 Security Model

### ✅ Required: Proxy-Only Access
All Qdrant operations MUST go through our proxy service:
```
https://tunnel.corrently.cloud/api/qdrant/...
```

### ❌ Forbidden: Direct Qdrant Access
- No direct connections to Qdrant server
- Internal server IP addresses are never exposed
- Qdrant credentials are never shared with clients

### 🔐 User Isolation
- Each user only accesses their own collections
- Collection access is validated for every request
- No cross-user data access possible

## 📋 Client Integration Steps

### 1. Authentication
Use your tunnel service API key (not Qdrant credentials):
```javascript
const headers = {
    'Api-Key': 'your-tunnel-service-api-key',
    'Content-Type': 'application/json'
};
```

### 2. Collection Operations
```javascript
// List your collections
const response = await fetch('https://tunnel.corrently.cloud/api/qdrant/collections', {
    headers: headers
});

// Access specific collection (by UUID or name)
const collection = await fetch('https://tunnel.corrently.cloud/api/qdrant/collections/your-collection-uuid', {
    headers: headers
});
```

### 3. Vector Operations
```javascript
// Upsert vectors (use UUID point IDs)
const upsertData = {
    points: [
        {
            id: "550e8400-e29b-41d4-a716-446655440000",  // UUID required
            vector: [0.1, 0.2, 0.3, ...],               // Your vector data
            payload: {                                   // Payload best practices:
                content: "Your content here",           // Keep < 10KB for optimal performance
                metadata: {                             // Use structured data
                    title: "Document Title",
                    category: "documentation",
                    created_at: "2025-07-15T00:00:00Z"
                }
            }
        }
    ]
};

const result = await fetch('https://tunnel.corrently.cloud/api/qdrant/collections/your-collection-uuid/points/upsert', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(upsertData)
});
```

#### 📏 Payload Size Guidelines
- **✅ Optimal**: < 10KB per payload
- **⚠️ Acceptable**: 10KB - 100KB (may impact performance)
- **❌ Avoid**: > 100KB (use external storage + references)

For large content, consider chunking:
```javascript
// Large content chunking strategy
const chunkContent = (content, chunkSize = 8192) => {
    const chunks = [];
    for (let i = 0; i < content.length; i += chunkSize) {
        chunks.push(content.slice(i, i + chunkSize));
    }
    return chunks;
};

const chunks = chunkContent(largeContent);
const points = chunks.map((chunk, index) => ({
    id: `${documentId}-chunk-${index}`,
    vector: generateEmbedding(chunk),
    payload: {
        content: chunk,
        document_id: documentId,
        chunk_index: index,
        total_chunks: chunks.length
    }
}));
```

### 4. Search Operations
```javascript
// Search vectors
const searchData = {
    vector: [0.1, 0.2, 0.3, ...],  // Query vector
    limit: 10,                      // Number of results
    with_payload: true,             // Include metadata
    with_vector: false              // Exclude vectors from response
};

const results = await fetch('https://tunnel.corrently.cloud/api/qdrant/collections/your-collection-uuid/points/search', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(searchData)
});
```

## 🛡️ Security Benefits

1. **No Internal Exposure**: Client never sees internal server details
2. **User Isolation**: Cannot access other users' collections
3. **Authentication**: Every request is authenticated
4. **Rate Limiting**: Built-in protection against abuse
5. **Audit Trail**: All operations are logged
6. **Secure Updates**: Server-side security updates without client changes

## ⚠️ Important Notes

- Never attempt to connect directly to Qdrant servers
- Always use UUID or integer point IDs (not arbitrary strings)
- All requests must include valid API key authentication
- Vector dimensions must match your collection configuration
- Use the proxy service for ALL Qdrant operations

## 🔗 Endpoints

Base URL: `https://tunnel.corrently.cloud/api/qdrant/`

- `GET /collections` - List user's collections
- `GET /collections/{id}` - Get collection info
- `POST /collections/{id}/points/upsert` - Add/update vectors
- `POST /collections/{id}/points/search` - Search vectors
- `DELETE /collections/{id}/points` - Delete vectors

All endpoints require authentication and enforce user isolation.
