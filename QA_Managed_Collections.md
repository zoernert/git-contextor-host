# Managed Qdrant Collections API - Questions and Answers

Based on the analysis of the tunnel.corrently.cloud codebase, here are comprehensive answers to the questions about implementing the managed Qdrant Collections API:

## Authentication & API Structure Questions

### 1. **Authentication Methods**

**ANSWER:** The authentication method is **`Api-Key`** header.

- **For all operations** (management and Qdrant operations): Use `Api-Key: {your-api-key}` header
- The system also accepts `Authorization: Bearer {your-api-key}` as an alternative
- Your API key can be retrieved from the user profile in the admin UI
- **Both management and Qdrant operations use the same authentication method**

### 2. **API Endpoint Structure**

**ANSWER:** There's a **critical missing route** in the current implementation.

**The Problem:** The proxy route `/api/qdrant/collections/:collectionId/*` is not mounted in the server, causing 404 errors.

**Current Status:**
- Management endpoints work: `/api/qdrant/collections` (handled by routes/qdrant.js)
- Proxy endpoints missing: `/api/qdrant/collections/{collection_id}/*` (should be handled by qdrantProxy middleware)

**The correct endpoints should be:**
- `/api/qdrant/collections/{collection_id}/collections/{collection_name}/points/upsert`
- `/api/qdrant/collections/{collection_id}/collections/{collection_name}/points/search`
- `/api/qdrant/collections/{collection_id}/collections/{collection_name}/points/delete`

**Fix Required:** Add this route to `/tunnel-service/src/index.js`:
```javascript
app.use('/api/qdrant/collections/:collectionId/*', qdrantProxy.proxyRequest.bind(qdrantProxy));
```

## Connection Information Questions

### 3. **Connection URL Usage**

**ANSWER:** The connection URL should work with standard Qdrant client once the proxy route is fixed.

- **URL Format:** `https://tunnel.corrently.cloud/api/qdrant/collections/{collection_id}`
- **IP Resolution:** The IP `85.25.197.105:6333` suggests the client is trying to resolve the hostname directly instead of using the proxy
- **Standard Client:** Yes, `@qdrant/js-client-rest` should work directly with the managed API

**Usage Pattern:**
```javascript
const { QdrantClient } = require('@qdrant/js-client-rest');

const client = new QdrantClient({
    url: 'https://tunnel.corrently.cloud/api/qdrant/collections/{collection_id}',
    apiKey: 'your-api-key'
});
```

### 4. **Collection Names**

**ANSWER:** Use `collectionName` (the user-friendly name) for client operations.

- **For client operations:** Use `collectionName` (e.g., `gctx-git-contextor-b439f03ebe67`)
- **Internal processing:** The proxy automatically maps to `internalCollectionName` (e.g., `user-6870454575345400dd8dbc3b-gctx-git-contextor-b439f03ebe67`)
- **The proxy handles the name mapping internally**

## API Documentation Questions

### 5. **Endpoint Documentation**

**ANSWER:** Complete endpoint reference (after proxy route fix):

**Management Endpoints:**
- `GET /api/qdrant/collections` - List user's collections
- `POST /api/qdrant/collections` - Create new collection
- `GET /api/qdrant/collections/{id}/connection` - Get connection info
- `POST /api/qdrant/collections/{id}/test-connection` - Test connection
- `DELETE /api/qdrant/collections/{id}` - Delete collection

**Qdrant Operation Endpoints (proxied):**
- `POST /api/qdrant/collections/{id}/collections/{name}/points/upsert` - Add vectors
- `POST /api/qdrant/collections/{id}/collections/{name}/points/search` - Search vectors
- `POST /api/qdrant/collections/{id}/collections/{name}/points/delete` - Delete vectors
- `GET /api/qdrant/collections/{id}/collections/{name}` - Get collection info

**Limits & Recommendations:**
- **Batch size:** No hard limit set in code, but recommend 100-1000 vectors per upsert
- **Rate limits:** Based on user's subscription plan (configured in plans.js)
- **Vector dimensions:** Must match collection's configured vectorSize (default 1536)

### 6. **Error Responses**

**ANSWER:** Common error status codes:

- **401 Unauthorized:** Invalid or missing API key
- **404 Not Found:** Collection not found or proxy route missing
- **403 Forbidden:** Collection limit exceeded for user's plan
- **400 Bad Request:** Invalid collection name or malformed request
- **500 Internal Server Error:** Database or Qdrant service error

**Error Response Format:**
```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

## Technical Implementation Questions

### 7. **Client Library Compatibility**

**ANSWER:** Yes, fully compatible with standard Qdrant client libraries after proxy route fix.

**Supported Libraries:**
- **Node.js:** `@qdrant/js-client-rest` ✅
- **Python:** `qdrant-client` ✅
- **Custom HTTP:** Direct REST API calls ✅

**Usage with Standard Client:**
```javascript
const { QdrantClient } = require('@qdrant/js-client-rest');

const client = new QdrantClient({
    url: 'https://tunnel.corrently.cloud/api/qdrant/collections/{collection_id}',
    apiKey: 'your-api-key'
});

// Use the user-friendly collection name
await client.upsert('my-collection', { points: [...] });
```

### 8. **Vector Operations**

**ANSWER:** Operation specifications:

**Upsert Operations:**
- **Max batch size:** No enforced limit, recommend 100-1000 vectors
- **Vector dimensions:** Must match collection's vectorSize configuration
- **Payload structure:** Any JSON object allowed
- **Point ID:** Can be integer or string

**Search Operations:**
- **Pagination:** Use `limit` and `offset` parameters
- **Filters:** Standard Qdrant filter syntax supported
- **Return format:** Standard Qdrant response format

**Example Vector Format:**
```json
{
  "points": [
    {
      "id": 1,
      "vector": [0.1, 0.2, 0.3, ...],
      "payload": {
        "text": "example content",
        "metadata": "additional info"
      }
    }
  ]
}
```

## Debugging Questions

### 9. **Testing Endpoints**

**ANSWER:** Use the test connection endpoint:

```bash
curl -X POST "https://tunnel.corrently.cloud/api/qdrant/collections/{collection_id}/test-connection" \
  -H "Api-Key: your-api-key"
```

**Response:**
```json
{
  "success": true,
  "message": "Connection successful",
  "collectionInfo": {
    "status": "green",
    "vectors_count": 0
  },
  "timestamp": "2025-07-15T10:30:00.000Z"
}
```

**Troubleshooting Steps:**
1. Verify API key is valid
2. Check collection exists via management API
3. Ensure proxy route is mounted (the fix provided)
4. Test with curl before using client libraries

### 10. **Collection Management**

**ANSWER:** Collection persistence and management:

**Collection ID Stability:**
- Collection IDs are MongoDB ObjectIds - they don't change
- If IDs appear to change, check if collections are being recreated

**Persistence:**
- Collections persist until manually deleted
- No automatic cleanup unless user is deleted
- Marked as `isActive: false` when soft-deleted

**Lifecycle:**
- Created via management API
- Accessed via proxy API
- Deleted via management API (also removes from Qdrant)
````