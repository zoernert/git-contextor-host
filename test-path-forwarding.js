#!/usr/bin/env node

/**
 * Test script to verify path forwarding functionality
 * This tests the core issue reported by the client development team
 */

const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Configuration
const SERVER_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000';
const CONNECTION_ID = uuidv4();

console.log('🔍 Testing Path Forwarding Functionality');
console.log('========================================\n');

// Create a simple test server to receive forwarded requests
const testServer = http.createServer((req, res) => {
    console.log(`[TestServer] Received: ${req.method} ${req.url}`);
    
    // Log headers and body for debugging
    console.log(`[TestServer] Headers:`, req.headers);
    
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        if (body) {
            console.log(`[TestServer] Body: ${body}`);
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            message: 'Test server response',
            path: req.url,
            method: req.method,
            timestamp: new Date().toISOString()
        }));
    });
});

testServer.listen(3333, () => {
    console.log('✅ Test server started on port 3333');
    runPathForwardingTests();
});

function runPathForwardingTests() {
    console.log('\n📋 Test Cases:');
    console.log('==============');
    
    // Test case 1: Root path
    testPathForwarding('/', 'GET /');
    
    // Test case 2: Simple path
    setTimeout(() => testPathForwarding('/health', 'GET /health'), 1000);
    
    // Test case 3: Nested path
    setTimeout(() => testPathForwarding('/api/status', 'GET /api/status'), 2000);
    
    // Test case 4: Complex path (the original issue)
    setTimeout(() => testPathForwarding('/shared/d46c41885863ca10c557032cba3576cc', 'GET /shared/d46c41885863ca10c557032cba3576cc'), 3000);
    
    // Test case 5: Multiple nested path
    setTimeout(() => testPathForwarding('/nested/path/to/file.txt', 'GET /nested/path/to/file.txt'), 4000);
    
    // Cleanup after tests
    setTimeout(() => {
        testServer.close();
        console.log('\n✅ All tests completed');
        process.exit(0);
    }, 6000);
}

function testPathForwarding(path, expectedForward) {
    console.log(`\n🔄 Test: ${expectedForward}`);
    console.log(`   Path: ${path}`);
    
    // Create WebSocket connection to simulate tunnel client
    const ws = new WebSocket(`${WS_URL}/ws/tunnel/${CONNECTION_ID}`);
    
    ws.on('open', () => {
        console.log(`   ✅ WebSocket connected`);
        
        // Send authentication
        ws.send(JSON.stringify({ connectionId: CONNECTION_ID }));
        
        // Listen for HTTP requests
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                console.log(`   📨 Received message:`, JSON.stringify(data, null, 4));
                
                if (data.type === 'http-request') {
                    const { id, method, path: receivedPath, headers, body } = data.data;
                    
                    console.log(`   📍 Forwarded: ${method} ${receivedPath}`);
                    console.log(`   ✅ Expected: ${expectedForward}`);
                    
                    if (`${method} ${receivedPath}` === expectedForward) {
                        console.log(`   ✅ PATH FORWARDING CORRECT`);
                    } else {
                        console.log(`   ❌ PATH FORWARDING INCORRECT`);
                    }
                    
                    // Send response back
                    const response = {
                        type: 'http-response',
                        data: {
                            id: id,
                            status: 200,
                            statusText: 'OK',
                            headers: { 'Content-Type': 'application/json' },
                            body: Buffer.from(JSON.stringify({ 
                                message: 'Response from test tunnel client',
                                receivedPath: receivedPath,
                                expectedPath: path
                            })).toString('base64')
                        }
                    };
                    
                    ws.send(JSON.stringify(response));
                }
            } catch (err) {
                console.error(`   ❌ Error parsing message:`, err);
            }
        });
        
        // Make HTTP request to tunnel after a short delay
        setTimeout(() => {
            const tunnelUrl = `${SERVER_URL}/tunnel/${CONNECTION_ID}${path}`;
            console.log(`   🌐 Making request to: ${tunnelUrl}`);
            
            const req = http.request(tunnelUrl, { method: 'GET' }, (res) => {
                let responseBody = '';
                res.on('data', chunk => responseBody += chunk);
                res.on('end', () => {
                    console.log(`   📥 Response status: ${res.statusCode}`);
                    console.log(`   📥 Response body: ${responseBody}`);
                    ws.close();
                });
            });
            
            req.on('error', (err) => {
                console.error(`   ❌ HTTP request error:`, err.message);
                ws.close();
            });
            
            req.setTimeout(5000, () => {
                console.log(`   ⏰ Request timeout`);
                req.destroy();
                ws.close();
            });
            
            req.end();
        }, 500);
    });
    
    ws.on('error', (err) => {
        console.error(`   ❌ WebSocket error:`, err.message);
    });
    
    ws.on('close', (code, reason) => {
        console.log(`   🔌 WebSocket closed: ${code} - ${reason}`);
    });
}
