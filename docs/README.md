# Git Contextor Host Documentation

This directory contains comprehensive documentation for the Git Contextor Host service, including the Qdrant Collections service and tunnel functionality.

## Documentation Index

### Core Service Documentation

📖 **[Qdrant Collections Integration Guide](./qdrant-collections-integration.md)**
- Complete developer guide for integrating with hosted Qdrant Collections
- API documentation and examples
- Authentication and security
- Best practices and troubleshooting

📋 **[Quick Reference](./qdrant-quick-reference.md)**
- Essential API endpoints and code snippets
- Common patterns and troubleshooting checklist
- Environment setup and configuration

🔗 **[Git Contextor Integration](./git-contextor-integration.md)**
- Specific integration guide for Git Contextor developers
- Migration from local Qdrant to hosted service
- Complete implementation examples
- Performance optimization

### Additional Resources

🏗️ **[Qdrant Collections Guide](./qdrant-collections-guide.md)**
- Detailed guide for collection management
- User interface walkthrough
- Administrative features

## Quick Start

### For Git Contextor Developers

1. **Get API Key**: Visit [tunnel.corrently.cloud](https://tunnel.corrently.cloud) and get your API key
2. **Read Integration Guide**: Start with [Git Contextor Integration](./git-contextor-integration.md)
3. **Follow Examples**: Use the code examples provided
4. **Test Connection**: Use the quick reference for testing

### For General Vector Database Users

1. **Read Full Guide**: Start with [Qdrant Collections Integration](./qdrant-collections-integration.md)
2. **Check Quick Reference**: Use [Quick Reference](./qdrant-quick-reference.md) for fast lookups
3. **Implement**: Follow the API examples and best practices

## Service Overview

### Qdrant Collections Service

The hosted Qdrant Collections service provides:

- **Managed Infrastructure**: No need to run your own Qdrant server
- **User Isolation**: Each user gets isolated collections with secure access
- **Automatic Tunneling**: Secure tunnel endpoints for each collection
- **API Management**: RESTful API for collection lifecycle management
- **Connection Testing**: Built-in health monitoring and testing
- **Dashboard Integration**: Web interface for easy management

### Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Git Contextor │    │  Tunnel Service  │    │ Qdrant Database │
│   Application   │───▶│  + Collections   │───▶│   (Hosted)      │
│                 │    │     API          │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   User Dashboard │
                       │   (Web UI)       │
                       └──────────────────┘
```

## API Quick Reference

### Authentication
```bash
Authorization: Bearer YOUR_API_KEY
```

### Base URL
```
https://tunnel.corrently.cloud/api
```

### Essential Endpoints
- `GET /qdrant/collections` - List collections
- `POST /qdrant/collections` - Create collection
- `POST /qdrant/collections/{id}/test-connection` - Test connection
- `DELETE /qdrant/collections/{id}` - Delete collection

## Code Examples

### JavaScript/Node.js
```javascript
const { QdrantClient } = require('@qdrant/js-client-rest');

// Get collection info
const response = await fetch('https://tunnel.corrently.cloud/api/qdrant/collections', {
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
});
const collections = await response.json();
const collection = collections[0];

// Initialize client
const client = new QdrantClient({
  url: collection.tunnelInfo.url,
  apiKey: collection.tunnelInfo.apiKey,
  checkCompatibility: false
});
```

### Python
```python
import requests
from qdrant_client import QdrantClient

# Get collection info
response = requests.get(
    'https://tunnel.corrently.cloud/api/qdrant/collections',
    headers={'Authorization': 'Bearer YOUR_API_KEY'}
)
collections = response.json()
collection = collections[0]

# Initialize client
client = QdrantClient(
    url=collection['tunnelInfo']['url'],
    api_key=collection['tunnelInfo']['apiKey']
)
```

## Support and Troubleshooting

### Common Issues
1. **Connection Failed**: Check API key and collection status
2. **Version Compatibility**: Use `checkCompatibility: false`
3. **Authentication**: Verify Bearer token format
4. **Tunnel ID Mismatch**: Frontend shows different ID than WebSocket connection

### Tunnel ID Mismatch Debugging

If you get "Bad Gateway: Tunnel client not connected" but your tunnel client connects successfully:

1. **Check WebSocket vs HTTP IDs**: Your service uses different IDs for WebSocket and HTTP
   ```
   WebSocket: wss://tunnel.corrently.cloud/ws/tunnel/WEBSOCKET_CONNECTION_ID
   HTTP: https://tunnel.corrently.cloud/tunnel/HTTP_TUNNEL_PATH
   ```

2. **Get Tunnel Info**: Use the API to get the correct URLs
   ```bash
   # List all tunnels
   curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://tunnel.corrently.cloud/api/tunnels
   
   # Look for the "url" field in the response
   ```

3. **Use Provided URLs**: Don't construct URLs manually - use the `url` field from API response
   ```javascript
   // ✅ CORRECT - Use provided URL
   const response = await fetch('/api/tunnels', {
     headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
   });
   const tunnels = await response.json();
   const tunnelUrl = tunnels[0].url; // Use this URL directly
   
   // ❌ WRONG - Don't use WebSocket connectionId for HTTP
   const wrongUrl = `https://tunnel.corrently.cloud/tunnel/${connectionId}`;
   ```

4. **Check Tunnel Status**: Verify the tunnel is active and not expired
   ```bash
   # Check if tunnel client is actually connected and forwarding requests
   curl -H "api-key: YOUR_API_KEY" \
     https://tunnel.corrently.cloud/tunnel/TUNNEL_PATH/collections
   ```

5. **WebSocket Connection Issues**: If tunnel client connects but keeps disconnecting:
   ```bash
   # Check WebSocket logs for connection issues
   # Common issues:
   # - Code 1006: Abnormal closure (server timeout, protocol error)
   # - Code 1000: Normal closure
   # - Code 1001: Going away (server restart)
   
   # Verify you're using the correct connectionId for WebSocket
   node tunnel-client.js https://tunnel.corrently.cloud CONNECTION_ID LOCAL_PORT
   ```

6. **Test Correct Tunnel Path**: Don't test random tunnel paths
   ```bash
   # ✅ CORRECT - Use tunnelPath from API response
   # From /api/tunnels response: "tunnelPath": "9GWrBx8NLEfQ"
   curl -H "api-key: YOUR_API_KEY" \
     https://tunnel.corrently.cloud/tunnel/9GWrBx8NLEfQ/collections
   
   # ❌ WRONG - Random tunnel path
   curl -H "api-key: YOUR_API_KEY" \
     https://tunnel.corrently.cloud/tunnel/DX_J5-JZOutX/collections
   ```

### Getting Help
- 📖 Check the relevant documentation section
- 🔍 Review troubleshooting guides
- 🌐 Use the web dashboard for collection management
- 💬 Contact support through the dashboard

## Contributing

To contribute to this documentation:

1. Follow the existing format and structure
2. Include practical examples
3. Update the index when adding new documents
4. Test all code examples before committing

## Version History

- **v1.0.0** (2025-07-13): Initial documentation release
  - Qdrant Collections Integration Guide
  - Quick Reference
  - Git Contextor Integration Guide

---

*For the latest updates and additional resources, visit the [Git Contextor Host Dashboard](https://tunnel.corrently.cloud)*
