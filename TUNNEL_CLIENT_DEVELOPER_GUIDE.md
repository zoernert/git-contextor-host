# Tunnel Client Developer Guide

## Overview

The tunnel client (`tunnel-client.js`) is a Node.js application that creates secure HTTP tunnels to expose local development servers to the internet through the tunnel.corrently.cloud service.

## ✅ Production Tested & Verified

**The tunnel client has been fully tested against the production environment at tunnel.corrently.cloud with 6/6 tests passing.**

See [PRODUCTION_TEST_RESULTS.md](./PRODUCTION_TEST_RESULTS.md) for detailed test results.

## Quick Start

### 1. Prerequisites
- Node.js (v14 or higher)
- npm (for installing dependencies if needed)
- A local development server running on any port

### 2. Installation
```bash
# Clone or download tunnel-client.js
# No additional dependencies required - uses only Node.js built-ins
```

### 3. Register & Create Tunnel
1. Register at https://tunnel.corrently.cloud
2. Get your API key from the dashboard (UUID format)
3. Create a tunnel via the API (see API documentation)
4. Note your connection ID

### 4. Start the Tunnel
```bash
node tunnel-client.js https://tunnel.corrently.cloud <your-connection-id> <local-port>
```

**Example:**
```bash
# Tunnel local server on port 3000
node tunnel-client.js https://tunnel.corrently.cloud 8d2a01fa-4126-432d-9b47-74f5733174cd 3000
```

## Usage Examples

### Web Development
```bash
# React app (typically port 3000)
node tunnel-client.js https://tunnel.corrently.cloud your-connection-id 3000

# Vue.js app (typically port 8080)  
node tunnel-client.js https://tunnel.corrently.cloud your-connection-id 8080

# Express.js server
node tunnel-client.js https://tunnel.corrently.cloud your-connection-id 3001
```

### API Development
```bash
# REST API server
node tunnel-client.js https://tunnel.corrently.cloud your-connection-id 8000

# GraphQL server
node tunnel-client.js https://tunnel.corrently.cloud your-connection-id 4000
```

### Static File Servers
```bash
# Python simple server (python -m http.server 8000)
node tunnel-client.js https://tunnel.corrently.cloud your-connection-id 8000

# Node.js serve package (serve -p 5000)
node tunnel-client.js https://tunnel.corrently.cloud your-connection-id 5000
```

## Features

### ✅ Production-Ready
- **Tested against tunnel.corrently.cloud**
- WebSocket connection with automatic reconnection
- Error handling and recovery
- Request/response forwarding
- Connection state management

### ✅ Developer-Friendly  
- **Zero dependencies** - uses only Node.js built-ins
- Simple command-line interface
- Clear logging and status messages
- Graceful shutdown on Ctrl+C

### ✅ Robust Operation
- Automatic reconnection on connection loss
- Request timeout handling (30 seconds)
- WebSocket connection state validation
- Error responses for failed requests

## Configuration

### Environment Variables
```bash
# Optional: Set custom timeout (default: 30000ms)
TUNNEL_TIMEOUT=60000 node tunnel-client.js https://tunnel.corrently.cloud connection-id 3000
```

### Connection Options
The client supports:
- **HTTP and HTTPS** local servers
- **Any port** number  
- **Multiple concurrent** connections
- **Cross-platform** operation (Windows, macOS, Linux)

## Logging & Monitoring

The client provides detailed logging:

```
[TunnelClient] Connecting to wss://tunnel.corrently.cloud/ws/tunnel/your-id
[TunnelClient] WebSocket connected to tunnel your-id  
[TunnelClient] Forwarding GET / to localhost:3000
[TunnelClient] Response sent: 200 GET /
```

### Log Levels
- **Connection events**: WebSocket connect/disconnect
- **Request forwarding**: HTTP method, path, and status
- **Error handling**: Network errors, timeouts, failures
- **Reconnection**: Automatic retry attempts

## Error Handling

### Common Issues & Solutions

#### Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:3000
```
**Solution**: Ensure your local server is running on the specified port.

#### Invalid Connection ID
```
WebSocket disconnected: 1006
```
**Solution**: Verify your connection ID is correct and the tunnel is active.

#### Network Issues
```
WebSocket error: ENOTFOUND tunnel.corrently.cloud
```
**Solution**: Check your internet connection and DNS resolution.

### Automatic Recovery
The client automatically handles:
- Temporary network disconnections
- Server restarts
- Connection timeouts
- WebSocket errors

## Advanced Usage

### Programmatic Usage
```javascript
const TunnelClient = require('./tunnel-client');

const client = new TunnelClient(
    'https://tunnel.corrently.cloud',
    'your-connection-id', 
    3000
);

client.connect().then(() => {
    console.log('Tunnel established!');
}).catch(err => {
    console.error('Failed to connect:', err);
});

// Graceful shutdown
process.on('SIGINT', () => {
    client.disconnect();
    process.exit(0);
});
```

### Custom Local Servers
```javascript
// Works with any HTTP server
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Hello from tunnel!' }));
});

server.listen(3333, () => {
    console.log('Local server ready for tunneling');
    // Now start tunnel client pointing to port 3333
});
```

## Security Considerations

### Best Practices
- **Use HTTPS** for your local server when possible
- **Limit tunnel lifetime** - close when not needed
- **Monitor tunnel usage** through the dashboard
- **Validate requests** in your local application

### Production Deployment
- The tunnel client is designed for **development use**
- For production, consider dedicated solutions
- Always use authentication in your local application
- Monitor and log all tunnel traffic

## Troubleshooting

### Debug Mode
Add verbose logging:
```javascript
// Modify tunnel-client.js temporarily
console.log('[DEBUG]', ...args);
```

### Connection Testing
Use the production test suite:
```bash
node production-test.js
```

### Manual Testing
```bash
# Test local server directly
curl http://localhost:3000

# Test tunnel connection
node test-websocket.js
```

## Support & Documentation

### Additional Resources
- **Production Test Results**: [PRODUCTION_TEST_RESULTS.md](./PRODUCTION_TEST_RESULTS.md)
- **API Documentation**: Available at tunnel.corrently.cloud
- **Quick Start Script**: Use `quick-start.js` for easy setup

### Getting Help
1. Check the logs for error messages
2. Verify your local server is accessible
3. Confirm your connection ID is valid
4. Test network connectivity to tunnel.corrently.cloud

---

**The tunnel client is production-tested and ready for development use with tunnel.corrently.cloud!**
