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
            payload: { content: "Your data" }           // Optional metadata
        }
    ]
};

const result = await fetch('https://tunnel.corrently.cloud/api/qdrant/collections/your-collection-uuid/points/upsert', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(upsertData)
});
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
