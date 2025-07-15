# Qdrant Point ID Format - Quick Reference

⚠️ **IMPORTANT SECURITY NOTE**: All Qdrant access must go through our proxy service at `tunnel.corrently.cloud`. Direct access to the Qdrant server is not allowed and internal server details are never exposed.

## ✅ Valid Point ID Formats

### UUID (Recommended)
```javascript
import { v4 as uuidv4 } from 'uuid';

const pointId = uuidv4(); // "550e8400-e29b-41d4-a716-446655440000"
```

### Integer
```javascript
const pointId = 12345; // Number, not string
```

## ❌ Invalid Point ID Formats

```javascript
// These will cause "Bad Request" errors:
const pointId = "test-point-1";     // ❌ Arbitrary string
const pointId = "my-document";      // ❌ Arbitrary string
const pointId = "point_123";        // ❌ Arbitrary string
```

## Working Upsert Example

```javascript
const upsertData = {
  points: [
    {
      id: uuidv4(),                    // ✅ UUID point ID
      vector: [0.1, 0.2, 0.3, ...],   // Your vector data
      payload: {                      // Optional metadata
        content: "Your content here",
        category: "example"
      }
    }
  ]
};

// Send to proxy service (ONLY way to access Qdrant)
fetch('https://tunnel.corrently.cloud/api/qdrant/collections/your-collection-uuid/points/upsert', {
  method: 'POST',
  headers: {
    'Api-Key': 'your-api-key',        // Your tunnel service API key
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(upsertData)
});
```

## Key Points

1. **Always use UUID or integer point IDs**
2. **ALL access must go through our proxy service** - No direct Qdrant access
3. **Users only see their own collections** - Automatic isolation enforced
4. **Vector dimensions must match collection configuration** (768 in production)
5. **Use proper authentication headers** (`Api-Key` or `Authorization: Bearer`)
6. **Internal server details are never exposed** - Full security boundary

## Security Model

- ✅ **Proxy Service**: `https://tunnel.corrently.cloud/api/qdrant/...`
- ❌ **Direct Qdrant Access**: Not allowed, internal server details hidden
- ✅ **User Isolation**: Users only access their own collections
- ✅ **Authentication**: All requests authenticated through our service
