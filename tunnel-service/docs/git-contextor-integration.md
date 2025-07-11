# Git Contextor Tunneling Service Integration

This document describes how to integrate the tunneling service with Git Contextor.

## Configuration

### Adding Managed Tunneling to Git Contextor

1. **Update Git Contextor Configuration Schema**

Add the following to your Git Contextor configuration:

```json
{
  "tunneling": {
    "provider": "managed",
    "managed": {
      "apiUrl": "https://your-tunnel-service.com",
      "apiKey": "your-api-key",
      "subdomain": "optional-custom-subdomain",
      "gitContextorShare": true
    }
  }
}
```

2. **Environment Variables**

Set these environment variables for Git Contextor:

```bash
TUNNEL_SERVICE_API_URL=https://your-tunnel-service.com
TUNNEL_SERVICE_API_KEY=your-api-key
TUNNEL_SERVICE_SUBDOMAIN=optional-custom-subdomain
```

## Git Contextor Integration Implementation

### 1. Update SharingService.js

```javascript
// In git-contextor/src/core/SharingService.js
class SharingService {
    constructor(config) {
        this.config = config;
        this.tunnelUrl = null;
        this.tunnelStatus = 'stopped';
        this.tunnelId = null;
        this.ws = null;
    }

    async startTunnel(provider = 'managed') {
        if (provider === 'managed') {
            return this.startManagedTunnel();
        }
        // existing logic for localtunnel, ngrok
        return this.startExternalTunnel(provider);
    }

    async startManagedTunnel() {
        try {
            const config = this.getManagedTunnelConfig();
            
            // Create tunnel via API
            const response = await axios.post(`${config.apiUrl}/api/tunnels`, {
                localPort: this.config.services.port,
                subdomain: config.subdomain,
                gitContextorShare: true
            }, {
                headers: { 
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            this.tunnelId = response.data._id;
            this.tunnelUrl = response.data.url;
            this.tunnelStatus = 'running';

            // Establish WebSocket connection for tunnel data
            await this.connectToTunnel(response.data.connectionId);

            console.log(`✅ Managed tunnel started: ${this.tunnelUrl}`);
            return response.data;

        } catch (error) {
            console.error('Failed to start managed tunnel:', error.message);
            throw error;
        }
    }

    async connectToTunnel(connectionId) {
        const config = this.getManagedTunnelConfig();
        const wsUrl = config.apiUrl.replace(/^http/, 'ws');
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            // Send authentication message
            this.ws.send(JSON.stringify({ connectionId }));
            console.log('Connected to managed tunnel');
        };

        this.ws.onmessage = (event) => {
            this.handleTunnelRequest(JSON.parse(event.data));
        };

        this.ws.onclose = () => {
            console.log('Disconnected from managed tunnel');
            this.tunnelStatus = 'stopped';
        };

        this.ws.onerror = (error) => {
            console.error('Tunnel connection error:', error);
        };
    }

    async handleTunnelRequest(requestData) {
        const { requestId, method, url, headers, body } = requestData;
        
        try {
            // Forward request to local server
            const response = await axios({
                method,
                url: `http://localhost:${this.config.services.port}${url}`,
                headers,
                data: body ? Buffer.from(body, 'base64') : undefined,
                responseType: 'arraybuffer'
            });

            // Send response back through tunnel
            this.ws.send(JSON.stringify({
                type: 'http-response',
                requestId,
                status: response.status,
                headers: response.headers,
                body: Buffer.from(response.data).toString('base64')
            }));

        } catch (error) {
            // Send error response
            this.ws.send(JSON.stringify({
                type: 'http-response',
                requestId,
                status: error.response?.status || 500,
                headers: { 'content-type': 'application/json' },
                body: Buffer.from(JSON.stringify({
                    error: error.message
                })).toString('base64')
            }));
        }
    }

    async stopTunnel() {
        if (this.tunnelStatus === 'stopped') return;

        try {
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }

            if (this.tunnelId) {
                const config = this.getManagedTunnelConfig();
                await axios.delete(`${config.apiUrl}/api/tunnels/${this.tunnelId}`, {
                    headers: { 'Authorization': `Bearer ${config.apiKey}` }
                });
            }

            this.tunnelStatus = 'stopped';
            this.tunnelUrl = null;
            this.tunnelId = null;

            console.log('✅ Managed tunnel stopped');

        } catch (error) {
            console.error('Failed to stop managed tunnel:', error.message);
        }
    }

    getManagedTunnelConfig() {
        const config = this.config.tunneling?.managed || {};
        
        return {
            apiUrl: config.apiUrl || process.env.TUNNEL_SERVICE_API_URL,
            apiKey: config.apiKey || process.env.TUNNEL_SERVICE_API_KEY,
            subdomain: config.subdomain || process.env.TUNNEL_SERVICE_SUBDOMAIN
        };
    }

    getTunnelStatus() {
        return {
            status: this.tunnelStatus,
            url: this.tunnelUrl,
            provider: 'managed'
        };
    }
}

module.exports = SharingService;
```

### 2. Update Configuration Schema

```javascript
// In git-contextor/src/config/schema.js
const configSchema = {
    // ... existing schema
    tunneling: {
        type: 'object',
        properties: {
            provider: {
                type: 'string',
                enum: ['managed', 'localtunnel', 'ngrok'],
                default: 'managed'
            },
            managed: {
                type: 'object',
                properties: {
                    apiUrl: {
                        type: 'string',
                        format: 'uri',
                        description: 'URL of the managed tunneling service'
                    },
                    apiKey: {
                        type: 'string',
                        description: 'API key for the managed tunneling service'
                    },
                    subdomain: {
                        type: 'string',
                        pattern: '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$',
                        description: 'Optional custom subdomain'
                    },
                    gitContextorShare: {
                        type: 'boolean',
                        default: true,
                        description: 'Enable Git Contextor sharing features'
                    }
                },
                required: ['apiUrl', 'apiKey']
            }
        }
    }
};
```

### 3. Update CLI Commands

```javascript
// In git-contextor/src/cli/commands/share.js
const ShareCommand = {
    name: 'share',
    description: 'Share your Git repository context via tunnel',
    options: [
        {
            name: '--provider',
            description: 'Tunneling provider (managed, localtunnel, ngrok)',
            default: 'managed'
        },
        {
            name: '--subdomain',
            description: 'Custom subdomain (managed provider only)'
        }
    ],
    
    async execute(args, config) {
        const sharingService = new SharingService(config);
        
        try {
            const tunnel = await sharingService.startTunnel(args.provider);
            
            console.log(`🚀 Git Contextor is now accessible at: ${tunnel.url}`);
            console.log(`📋 Share this URL with your team or AI assistants`);
            
            if (args.provider === 'managed') {
                console.log(`🔗 Provider: Managed Tunneling Service`);
                console.log(`📊 Usage tracking: Enabled`);
            }
            
            // Keep the process running
            process.on('SIGINT', async () => {
                console.log('\n🛑 Stopping tunnel...');
                await sharingService.stopTunnel();
                process.exit(0);
            });
            
        } catch (error) {
            console.error('❌ Failed to start tunnel:', error.message);
            process.exit(1);
        }
    }
};

module.exports = ShareCommand;
```

## Usage Examples

### 1. Start Git Contextor with Managed Tunneling

```bash
# Using configuration file
git-contextor share --provider managed

# Using environment variables
export TUNNEL_SERVICE_API_URL=https://your-tunnel-service.com
export TUNNEL_SERVICE_API_KEY=your-api-key
git-contextor share

# With custom subdomain
git-contextor share --provider managed --subdomain my-project
```

### 2. Integration with AI Assistants

```javascript
// Example integration with AI assistant
const response = await fetch('https://my-project.tunnel-service.com/api/context', {
    headers: {
        'Authorization': 'Bearer your-git-contextor-token'
    }
});

const contextData = await response.json();
console.log('Repository context:', contextData);
```

## Benefits of Managed Tunneling

1. **Reliability**: Professional-grade infrastructure with monitoring
2. **Security**: Built-in authentication and rate limiting
3. **Analytics**: Usage tracking and performance metrics
4. **Scalability**: Handles multiple concurrent connections
5. **Support**: Professional support and SLA
6. **Integration**: Native Git Contextor features and optimizations

## Migration from Other Providers

### From localtunnel:
```bash
# Old way
git-contextor share --provider localtunnel

# New way
git-contextor share --provider managed
```

### From ngrok:
```bash
# Old way  
git-contextor share --provider ngrok

# New way
git-contextor share --provider managed
```

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify API key is correct
   - Check API URL is accessible
   - Ensure account has valid subscription

2. **Connection Timeout**
   - Check firewall settings
   - Verify local port is accessible
   - Try different port number

3. **Subdomain Not Available**
   - Try different subdomain
   - Use auto-generated subdomain
   - Check subdomain format requirements

### Debug Mode

Enable debug logging:
```bash
DEBUG=git-contextor:* git-contextor share --provider managed
```

## Security Considerations

1. **API Key Management**
   - Store API keys securely
   - Use environment variables
   - Rotate keys regularly

2. **Network Security**
   - Use HTTPS endpoints only
   - Validate SSL certificates
   - Monitor for suspicious activity

3. **Access Control**
   - Limit tunnel access by IP
   - Use authentication tokens
   - Set appropriate timeouts
