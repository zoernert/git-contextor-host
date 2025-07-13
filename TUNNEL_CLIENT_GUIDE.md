# Tunnel Client User Guide

The tunnel client allows you to expose your local development server to the internet through a secure tunnel. This is perfect for:
- Testing webhooks from external services
- Sharing your local development with team members or clients
- Testing mobile apps against your local backend
- Debugging API integrations

## Prerequisites

- Node.js (v14 or later)
- A registered account at https://tunnel.corrently.cloud
- Your API key (UUID format from the dashboard)

## Quick Start

### 1. Register and Get Your API Key

1. Go to https://tunnel.corrently.cloud
2. Register for an account or log in
3. From the dashboard, copy your API key (UUID format)

### 2. Create a Tunnel

Use the tunnel service API to create a tunnel:

```bash
# Using curl with API key
curl -X POST https://tunnel.corrently.cloud/api/tunnels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"localPort": 3000}'
```

The response will include:
- `connectionId`: Unique identifier for your tunnel
- `url`: The public URL where your tunnel will be accessible
- `expiresAt`: When the tunnel expires (8 hours from creation)

Example response:
```json
{
  "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
  "connectionId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "url": "https://tunnel.corrently.cloud/tunnel/abc123def456",
  "localPort": 3000,
  "expiresAt": "2025-07-13T18:00:00.000Z",
  "isActive": true
}
```

### 3. Start Your Local Application

Make sure your local application is running on the port you specified:

```bash
# Example: Start a simple Node.js server
node your-app.js

# Example: Start a React development server
npm start

# Example: Start a Python Flask app
python app.py
```

### 4. Connect the Tunnel Client

Download or copy the `tunnel-client.js` file, then run:

```bash
node tunnel-client.js https://tunnel.corrently.cloud <connection-id> <local-port>
```

Example:
```bash
node tunnel-client.js https://tunnel.corrently.cloud a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d 3000
```

You should see output like:
```
[TunnelClient] Connecting to wss://tunnel.corrently.cloud/ws/tunnel/a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d
[TunnelClient] WebSocket connected to tunnel a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d
[TunnelClient] Tunnel active! Local port 3000 is now accessible via the tunnel.
[TunnelClient] Press Ctrl+C to disconnect.
```

### 5. Test Your Tunnel

Your local application is now accessible at the public URL provided when you created the tunnel:

```bash
curl https://tunnel.corrently.cloud/tunnel/abc123def456
```

## Advanced Usage

### Using the Tunnel Client Programmatically

You can also use the tunnel client as a module in your Node.js applications:

```javascript
const TunnelClient = require('./tunnel-client');

const client = new TunnelClient(
    'https://tunnel.corrently.cloud',
    'your-connection-id',
    3000
);

client.connect()
    .then(() => {
        console.log('Tunnel connected successfully!');
    })
    .catch(err => {
        console.error('Failed to connect tunnel:', err);
    });

// Disconnect when done
// client.disconnect();
```

### Environment Variables

You can set environment variables for easier usage:

```bash
export TUNNEL_SERVER=https://tunnel.corrently.cloud
export JWT_TOKEN=your_jwt_token_here
export API_KEY=your_api_key_here
```

### Creating Tunnels with Custom Subdomains

If you have a paid plan, you can request custom subdomains:

```bash
curl -X POST https://tunnel.corrently.cloud/api/tunnels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "localPort": 3000,
    "subdomain": "my-custom-name"
  }'
```

### Git Contextor Integration

If you're using Git Contextor, you can enable sharing:

```bash
curl -X POST https://tunnel.corrently.cloud/api/tunnels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "localPort": 3000,
    "gitContextorShare": true
  }'
```

## Troubleshooting

### Connection Issues

1. **"WebSocket connection failed"**
   - Check that the tunnel server is reachable
   - Verify your connection ID is correct
   - Ensure the tunnel hasn't expired

2. **"Invalid or inactive tunnel"**
   - The tunnel may have expired (8-hour limit)
   - Create a new tunnel and try again
   - Verify the connection ID is correct

3. **"Local server error"**
   - Check that your local application is running
   - Verify the port number is correct
   - Ensure no firewall is blocking local connections

### Performance Tips

1. **Use HTTPS for your local server** when possible for better compatibility
2. **Set appropriate timeouts** in your application (tunnel client has 30-second timeout)
3. **Monitor tunnel expiration** - tunnels expire after 8 hours

### Security Considerations

1. **Never expose sensitive data** through tunnels in production
2. **Use tunnels only for development and testing**
3. **Rotate your tokens regularly**
4. **Be aware that tunnel URLs are publicly accessible**

## API Reference

### Creating a Tunnel

**Endpoint:** `POST /api/tunnels`

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <api-key>`

**Body:**
```json
{
  "localPort": 3000,                    // Required: Port of your local application
  "subdomain": "custom-name",           // Optional: Custom subdomain (paid plans)
  "gitContextorShare": true,            // Optional: Enable Git Contextor sharing
  "description": "My development server" // Optional: Description for organization
}
```

**Response:**
```json
{
  "_id": "tunnel-document-id",
  "connectionId": "unique-connection-id",
  "url": "https://tunnel.corrently.cloud/tunnel/path",
  "localPort": 3000,
  "isActive": true,
  "expiresAt": "2025-07-13T18:00:00.000Z",
  "createdAt": "2025-07-13T10:00:00.000Z"
}
```

### Listing Your Tunnels

**Endpoint:** `GET /api/tunnels`

**Headers:**
- `Authorization: Bearer <api-key>`

### Deleting a Tunnel

**Endpoint:** `DELETE /api/tunnels/:id`

**Headers:**
- `Authorization: Bearer <api-key>`

## Examples

### Example 1: Express.js Server

```javascript
// server.js
const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.json({ message: 'Hello from my local server!' });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
```

```bash
# Terminal 1: Start your server
node server.js

# Terminal 2: Create tunnel and start client
# (First create tunnel via API, then run:)
node tunnel-client.js https://tunnel.corrently.cloud your-connection-id 3000
```

### Example 2: React Development Server

```bash
# Terminal 1: Start React dev server
npm start  # Usually runs on port 3000

# Terminal 2: Create tunnel and start client
node tunnel-client.js https://tunnel.corrently.cloud your-connection-id 3000
```

### Example 3: Testing Webhooks

```javascript
// webhook-server.js
const express = require('express');
const app = express();

app.use(express.json());

app.post('/webhook', (req, res) => {
    console.log('Webhook received:', req.body);
    res.json({ status: 'received' });
});

app.listen(3000, () => {
    console.log('Webhook server running on port 3000');
});
```

Now you can use the tunnel URL as your webhook endpoint in external services!

## Support

- Documentation: Visit the dashboard at https://tunnel.corrently.cloud
- Issues: Contact support through the dashboard
- Limits: Check your plan limits in the dashboard

---

Happy tunneling! 🚀
