# 🚨 CRITICAL: Tunnel ID Usage Guide

## ❌ **CURRENT PROBLEM**

Client development team is using the **wrong ID** in tunnel URLs, causing requests to fail.

**What's happening:**
- UI shows: `https://tunnel.corrently.cloud/tunnel/-GUU7qfYbvos` ✅
- Client uses: `https://tunnel.corrently.cloud/tunnel/6874cf82ee9721f75e9307f2/shared/test` ❌

## 🔍 **Understanding the Different IDs**

The tunnel system uses **THREE different identifiers**:

### 1. **Database ID** (`id`)
- **Example**: `6874cf82ee9721f75e9307f2`
- **Use**: Internal database operations only
- **DON'T use in URLs**

### 2. **Tunnel Path** (`tunnelPath`) 
- **Example**: `-GUU7qfYbvos`
- **Use**: HTTP tunnel URLs
- **✅ CORRECT for URLs**

### 3. **Connection ID** (`connectionId`)
- **Example**: `8d2a01fa-4126-432d-9b47-74f5733174cd` 
- **Use**: WebSocket connections
- **✅ CORRECT for WebSocket**

## 📋 **API Response Format (FIXED)**

After creating a tunnel, you'll now receive:

```json
{
  "id": "6874cf82ee9721f75e9307f2",                    // Database ID
  "tunnelPath": "-GUU7qfYbvos",                        // URL identifier  
  "connectionId": "8d2a01fa-4126-432d-9b47-74f5733174cd", // WebSocket ID
  "url": "https://tunnel.corrently.cloud/tunnel/-GUU7qfYbvos", // Complete URL
  "localPort": 3000,
  "isActive": true,
  "expiresAt": "2025-07-14T02:30:00.000Z"
}
```

## ✅ **CORRECT USAGE**

### **For HTTP Requests:**
```javascript
// ✅ CORRECT - Use tunnelPath from response
const tunnelUrl = response.url; // "https://tunnel.corrently.cloud/tunnel/-GUU7qfYbvos"

// ✅ CORRECT - Or build manually
const tunnelUrl = `https://tunnel.corrently.cloud/tunnel/${response.tunnelPath}`;

// ✅ CORRECT - Make requests to sub-paths
fetch(`${tunnelUrl}/shared/test`);  // → /tunnel/-GUU7qfYbvos/shared/test
```

### **For WebSocket Connections:**
```javascript
// ✅ CORRECT - Use connectionId for WebSocket
const ws = new WebSocket(`wss://tunnel.corrently.cloud/ws/tunnel/${response.connectionId}`);
```

## ❌ **INCORRECT USAGE**

```javascript
// ❌ WRONG - Don't use database ID in URLs
const wrongUrl = `https://tunnel.corrently.cloud/tunnel/${response.id}`;

// ❌ WRONG - Don't use tunnelPath for WebSocket
const wrongWs = new WebSocket(`wss://tunnel.corrently.cloud/ws/tunnel/${response.tunnelPath}`);
```

## 🔧 **Client Fix Required**

**Update your code to:**

1. **Extract the correct field from API response:**
```javascript
const response = await createTunnel(3000);
const tunnelUrl = response.url;           // Use the complete URL
const connectionId = response.connectionId; // Use for WebSocket
```

2. **Make HTTP requests to the correct URL:**
```javascript
// ✅ CORRECT
fetch(`${tunnelUrl}/shared/test`);

// ❌ WRONG  
fetch(`https://tunnel.corrently.cloud/tunnel/${response.id}/shared/test`);
```

3. **Connect WebSocket with connectionId:**
```javascript
// ✅ CORRECT
const ws = new WebSocket(`wss://tunnel.corrently.cloud/ws/tunnel/${connectionId}`);
```

## 📋 **Summary**

| Use Case | Field to Use | Example |
|----------|-------------|---------|
| **HTTP URLs** | `url` or `tunnelPath` | `https://tunnel.corrently.cloud/tunnel/-GUU7qfYbvos` |
| **WebSocket** | `connectionId` | `wss://tunnel.corrently.cloud/ws/tunnel/8d2a01fa-...` |
| **Database ops** | `id` | Internal use only |

## 🎯 **Action Required**

1. **Update your tunnel creation code** to use `response.url` for HTTP requests
2. **Use `response.connectionId`** for WebSocket connections  
3. **Test the corrected URLs** to verify path forwarding works

**This will fix the path forwarding issue you're experiencing!**
