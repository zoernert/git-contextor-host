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
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000; // 2 seconds
    }

    connect() {
        return new Promise((resolve, reject) => {
            const wsUrl = this.serverUrl.replace('https://', 'wss://').replace('http://', 'ws://');
            const fullWsUrl = `${wsUrl}/ws/tunnel/${this.connectionId}`;
            console.log(`[TunnelClient] Connecting to ${fullWsUrl}`);
            
            this.ws = new WebSocket(fullWsUrl);
            
            this.ws.on('open', () => {
                console.log(`[TunnelClient] WebSocket connected to tunnel ${this.connectionId}`);
                this.connected = true;
                this.reconnectAttempts = 0; // Reset on successful connection
                resolve();
            });
            
            this.ws.on('message', (message) => {
                this.handleMessage(message);
            });
            
            this.ws.on('close', (code, reason) => {
                console.log(`[TunnelClient] WebSocket disconnected: ${code} - ${reason}`);
                this.connected = false;
                this.attemptReconnect();
            });
            
            this.ws.on('error', (err) => {
                console.error(`[TunnelClient] WebSocket error:`, err);
                this.connected = false;
                reject(err);
            });

            // Send ping every 30 seconds to keep connection alive
            this.pingInterval = setInterval(() => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ type: 'ping' }));
                }
            }, 30000);
        });
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[TunnelClient] Max reconnection attempts reached. Exiting.');
            process.exit(1);
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        console.log(`[TunnelClient] Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
            this.connect();
        }, delay);
    }

    handleMessage(message) {
        try {
            const data = JSON.parse(message);
            console.log(`[TunnelClient] Received message:`, JSON.stringify(data, null, 2));
            
            if (data.type === 'http-request') {
                this.handleHttpRequest(data.data);
            } else if (data.type === 'pong') {
                // Pong received, connection is alive
                console.log(`[TunnelClient] Received pong`);
            } else {
                console.log(`[TunnelClient] Unknown message type: ${data.type}`);
            }
        } catch (err) {
            console.error(`[TunnelClient] Error handling message:`, err);
            console.error(`[TunnelClient] Raw message:`, message.toString());
        }
    }

    handleHttpRequest(data) {
        const { id, method, path, headers, body } = data;
        
        console.log(`[TunnelClient] Forwarding ${method} ${path} to localhost:${this.localPort}`);
        
        const options = {
            hostname: 'localhost',
            port: this.localPort,
            path: path,
            method: method,
            headers: headers
        };
        
        const req = http.request(options, (res) => {
            let responseBody = '';
            
            res.on('data', (chunk) => {
                responseBody += chunk;
            });
            
            res.on('end', () => {
                const response = {
                    type: 'http-response',
                    data: {
                        id: id,
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        headers: res.headers,
                        body: responseBody
                    }
                };
                
                this.ws.send(JSON.stringify(response));
                console.log(`[TunnelClient] Response sent: ${res.statusCode} ${method} ${path}`);
            });
        });
        
        req.on('error', (err) => {
            console.error(`[TunnelClient] Error forwarding request:`, err);
            
            const response = {
                type: 'http-response',
                data: {
                    id: id,
                    status: 502,
                    statusText: 'Bad Gateway',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        error: 'Local server error',
                        message: err.message 
                    })
                }
            };
            
            this.ws.send(JSON.stringify(response));
        });

        req.setTimeout(30000, () => {
            req.destroy();
            console.error(`[TunnelClient] Request timeout for ${method} ${path}`);
        });
        
        // Send request body if present
        if (body) {
            req.write(body);
        }
        
        req.end();
    }

    disconnect() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        if (this.ws) {
            this.ws.close();
        }
        this.connected = false;
    }
}

// CLI usage
if (require.main === module) {
    if (process.argv.length < 5) {
        console.log('Usage: node tunnel-client.js <server-url> <connection-id> <local-port>');
        console.log('Example: node tunnel-client.js https://tunnel.corrently.cloud 8d2a01fa-4126-432d-9b47-74f5733174cd 3333');
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
