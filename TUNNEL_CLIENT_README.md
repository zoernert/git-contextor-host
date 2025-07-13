# Tunnel Client Files

This directory contains the tunnel client and related utilities for connecting to the tunnel service at https://tunnel.corrently.cloud.

## Files Overview

- **`tunnel-client.js`** - Main tunnel client implementation
- **`TUNNEL_CLIENT_GUIDE.md`** - Comprehensive user guide
- **`quick-start.js`** - Easy-to-use wrapper script
- **`test-server.js`** - Simple test server for testing tunnels
- **`create-tunnel-test.js`** - Script to test tunnel creation API
- **`test-tunnel-client.js`** - Unit tests for tunnel client functionality
- **`test-websocket.js`** - WebSocket connection test

## Quick Start

1. **Get your API key** from https://tunnel.corrently.cloud

2. **Create a tunnel** via API:
   ```bash
   curl -X POST https://tunnel.corrently.cloud/api/tunnels \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -d '{"localPort": 3000}'
   ```

3. **Start your local application** on the specified port (e.g., port 3000)

4. **Connect the tunnel client**:
   ```bash
   node quick-start.js <connection-id> <local-port>
   ```

   Or use the tunnel client directly:
   ```bash
   node tunnel-client.js https://tunnel.corrently.cloud <connection-id> <local-port>
   ```

## Testing

To test the tunnel client functionality:

```bash
# Start the test server
node test-server.js

# In another terminal, run the tests
node test-tunnel-client.js
node test-websocket.js
```

## How It Works

1. **Tunnel Creation**: The API creates a tunnel record with a unique connection ID
2. **WebSocket Connection**: The tunnel client connects via WebSocket using the connection ID
3. **Authentication**: The server verifies the connection ID and associates the WebSocket
4. **Request Forwarding**: Incoming HTTP requests are sent to the client via WebSocket
5. **Response Handling**: The client forwards requests to the local server and sends responses back

## Architecture

```
Internet → tunnel.corrently.cloud → WebSocket → tunnel-client.js → localhost:port
                                       ↑
                                 Authenticated with
                                 connection ID
```

## Features

- ✅ **Automatic Reconnection**: Handles connection drops with exponential backoff
- ✅ **Request Forwarding**: Forwards all HTTP methods (GET, POST, PUT, DELETE, etc.)
- ✅ **Header Preservation**: Maintains original request headers
- ✅ **Body Support**: Handles request bodies for POST/PUT operations
- ✅ **Error Handling**: Graceful error handling and reporting
- ✅ **Keep-Alive**: Automatic ping/pong to maintain connection
- ✅ **Timeout Protection**: 30-second timeout for local requests

## Limitations

- Tunnels expire after 8 hours
- WebSocket connection required (no HTTP polling fallback)
- Limited to HTTP traffic (no TCP/UDP tunneling)
- Subject to rate limits based on your plan

## Troubleshooting

### Common Issues

1. **"WebSocket connection failed"**
   - Check internet connection
   - Verify tunnel server is accessible
   - Ensure connection ID is correct

2. **"Invalid or inactive tunnel"**
   - Tunnel may have expired (8-hour limit)
   - Connection ID may be incorrect
   - Create a new tunnel and try again

3. **"Local server error"**
   - Check that your local app is running on the specified port
   - Verify no firewall is blocking localhost connections
   - Test local server directly: `curl http://localhost:PORT`

### Debug Mode

To see detailed request/response logging, the tunnel client already includes verbose logging by default.

## Security Notes

- Tunnel URLs are publicly accessible
- Only use for development and testing
- Never expose production secrets through tunnels
- Regularly rotate your authentication tokens

## Support

- 📚 Full documentation: See `TUNNEL_CLIENT_GUIDE.md`
- 🌐 Dashboard: https://tunnel.corrently.cloud
- 🔧 Issues: Contact support through the dashboard

---

**Ready to tunnel? Start with `node quick-start.js` for the easiest experience!** 🚀
