#!/usr/bin/env node

const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const url = require('url');

class TunnelClient {
    constructor(serverUrl, connectionId, localPort) {
        this.serverUrl = serverUrl;
        this.connectionId = connectionId;
        this.localPort = localPort;
        this.ws = null;
        this.connected = false;
    }

    connect() {
        return new Promise((resolve, reject) => {
            const wsUrl = this.serverUrl.replace('https://', 'wss://').replace('http://', 'ws://');
            console.log(`[TunnelClient] Connecting to ${wsUrl}`);
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.on('open', () => {
                console.log(`[TunnelClient] WebSocket connected`);
                
                // Send authentication message with connectionId
                const authMessage = {
                    connectionId: this.connectionId
                };
                
                this.ws.send(JSON.stringify(authMessage));
                this.connected = true;
                
                console.log(`[TunnelClient] Authenticated with connectionId: ${this.connectionId}`);
                resolve();
            });
            
            this.ws.on('message', (message) => {
                this.handleMessage(message);
            });
            
            this.ws.on('close', () => {
                console.log(`[TunnelClient] WebSocket disconnected`);
                this.connected = false;
            });
            
            this.ws.on('error', (err) => {
                console.error(`[TunnelClient] WebSocket error:`, err);
                this.connected = false;
                reject(err);
            });
        });
    }

    handleMessage(message) {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'http-request') {
                this.handleHttpRequest(data);
            }
        } catch (err) {
            console.error(`[TunnelClient] Error handling message:`, err);
        }
    }

    handleHttpRequest(data) {
        const { requestId, method, url: reqUrl, headers, body } = data;
        
        // Strip tunnel path prefix from the URL
        // URLs come in as /tunnel/tunnelPath/actual/path, we need to extract /actual/path
        let localPath = reqUrl;
        const tunnelMatch = reqUrl.match(/^\/tunnel\/[^\/]+(.*)$/);
        if (tunnelMatch) {
            localPath = tunnelMatch[1] || '/';
        }
        
        console.log(`[TunnelClient] Forwarding ${method} ${reqUrl} -> ${localPath} to localhost:${this.localPort}`);
        
        const options = {
            hostname: 'localhost',
            port: this.localPort,
            path: localPath,
            method: method,
            headers: headers
        };
        
        const req = http.request(options, (res) => {
            let responseBody = Buffer.alloc(0);
            
            res.on('data', (chunk) => {
                responseBody = Buffer.concat([responseBody, chunk]);
            });
            
            res.on('end', () => {
                const response = {
                    type: 'http-response',
                    requestId: requestId,
                    status: res.statusCode,
                    headers: res.headers,
                    body: responseBody.toString('base64')
                };
                
                this.ws.send(JSON.stringify(response));
            });
        });
        
        req.on('error', (err) => {
            console.error(`[TunnelClient] Error forwarding request:`, err);
            
            const response = {
                type: 'http-response',
                requestId: requestId,
                status: 502,
                headers: { 'content-type': 'text/plain' },
                body: Buffer.from('Bad Gateway: Local server error').toString('base64')
            };
            
            this.ws.send(JSON.stringify(response));
        });
        
        // Send request body if present
        if (body) {
            req.write(Buffer.from(body, 'base64'));
        }
        
        req.end();
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// CLI usage
if (require.main === module) {
    if (process.argv.length < 5) {
        console.log('Usage: node tunnel-client.js <server-url> <connection-id> <local-port>');
        console.log('Example: node tunnel-client.js wss://tunnel.corrently.cloud abc123 8888');
        process.exit(1);
    }
    
    const serverUrl = process.argv[2];
    const connectionId = process.argv[3];
    const localPort = parseInt(process.argv[4]);
    
    const client = new TunnelClient(serverUrl, connectionId, localPort);
    
    client.connect().then(() => {
        console.log(`[TunnelClient] Tunnel active! Local port ${localPort} is now accessible via the tunnel.`);
        console.log(`[TunnelClient] Press Ctrl+C to disconnect.`);
    }).catch((err) => {
        console.error(`[TunnelClient] Failed to connect:`, err);
        process.exit(1);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log(`\n[TunnelClient] Shutting down...`);
        client.disconnect();
        process.exit(0);
    });
}

module.exports = TunnelClient;
