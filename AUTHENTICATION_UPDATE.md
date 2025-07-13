# Authentication Method Update

## Summary

**Updated the tunnel service to use UUID API keys instead of JWT tokens for API authentication.**

## Changes Made

### 1. Documentation Updates ✅

- **`quick-start.js`** - Updated to show `Authorization: Bearer API_KEY` instead of `x-auth-token`
- **`TUNNEL_CLIENT_GUIDE.md`** - Updated all API examples to use UUID API keys
- **`TUNNEL_CLIENT_README.md`** - Updated authentication method
- **`TUNNEL_CLIENT_DEVELOPER_GUIDE.md`** - Updated documentation
- **`create-tunnel-test.js`** - Updated test script to use API keys

### 2. Backend Already Supports UUID API Keys ✅

The backend authentication middleware (`tunnel-service/src/middleware/auth.js`) already supports UUID API keys via:

```javascript
const authHeader = req.header('Authorization');
if (authHeader && authHeader.startsWith('Bearer ')) {
    const apiKey = authHeader.substring(7, authHeader.length);
    try {
        const user = await User.findOne({ apiKey });
        if (!user) {
            return res.status(401).json({ msg: 'Invalid API Key' });
        }
        // ... rest of authentication logic
    }
}
```

### 3. User Model Already Has API Keys ✅

The User model includes UUID API keys:

```javascript
const UserSchema = new mongoose.Schema({
  // ... other fields
  apiKey: { type: String, required: true, unique: true },
  // ... other fields
});
```

## Current Authentication Method

### For Tunnel API (Production Ready)

**Method:** UUID API Key via Authorization header

```bash
curl -X POST https://tunnel.corrently.cloud/api/tunnels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"localPort": 3000}'
```

### For Dashboard/Admin UI (Internal)

**Method:** JWT Token via x-auth-token header (for web UI sessions)

```bash
curl -X GET https://tunnel.corrently.cloud/api/admin/users \
  -H "x-auth-token: YOUR_JWT_TOKEN"
```

## Developer Integration

Developers should use the **UUID API key method** which is what the frontend dashboard provides:

1. **Register** at https://tunnel.corrently.cloud
2. **Get API key** from dashboard (UUID format like: `a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d`)
3. **Use in API calls** with `Authorization: Bearer <api-key>`

## Files to Provide to Developers

The essential files for developers now correctly show UUID API key authentication:

1. **`tunnel-client.js`** - Main tunnel client (unchanged, handles WebSocket)
2. **`quick-start.js`** - Easy wrapper with correct API documentation
3. **`TUNNEL_CLIENT_GUIDE.md`** - Complete usage guide with API key examples
4. **`TUNNEL_CLIENT_README.md`** - Quick reference with correct auth
5. **`create-tunnel-test.js`** - Test script using API keys

## Test Results

All existing tests still pass because the backend already supported both authentication methods. The change was primarily in documentation to match what the frontend provides.

## Status: COMPLETE ✅

The authentication inconsistency has been resolved. Developers can now use the UUID API keys from the frontend dashboard directly with the tunnel API, and all documentation reflects this correctly.
