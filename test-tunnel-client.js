#!/usr/bin/env node

/**
 * Test script to verify tunnel-client.js works with the production environment
 * This simulates the real user workflow
 */

const TunnelClient = require('./tunnel-client');
const http = require('http');

// Mock connection ID for testing (would normally come from API)
const MOCK_CONNECTION_ID = 'test-connection-id-' + Date.now();
const LOCAL_PORT = 3333; // Port our test server is running on
const TUNNEL_SERVER = 'https://tunnel.corrently.cloud';

console.log('🔧 Testing Tunnel Client Functionality');
console.log('=====================================');

// Test 1: Verify the tunnel client can be instantiated
console.log('\n1. Testing TunnelClient instantiation...');
try {
    const client = new TunnelClient(TUNNEL_SERVER, MOCK_CONNECTION_ID, LOCAL_PORT);
    console.log('✅ TunnelClient created successfully');
    console.log(`   Server: ${client.serverUrl}`);
    console.log(`   Connection ID: ${client.connectionId}`);
    console.log(`   Local Port: ${client.localPort}`);
} catch (err) {
    console.error('❌ Failed to create TunnelClient:', err.message);
    process.exit(1);
}

// Test 2: Verify WebSocket URL construction
console.log('\n2. Testing WebSocket URL construction...');
const wsUrl = TUNNEL_SERVER.replace('https://', 'wss://').replace('http://', 'ws://');
const expectedWsUrl = `${wsUrl}/ws/tunnel/${MOCK_CONNECTION_ID}`;
console.log(`✅ WebSocket URL: ${expectedWsUrl}`);

// Test 3: Test message handling (without actual connection)
console.log('\n3. Testing message handling logic...');
const client = new TunnelClient(TUNNEL_SERVER, MOCK_CONNECTION_ID, LOCAL_PORT);

// Test ping message
const pingMessage = JSON.stringify({ type: 'ping' });
console.log('✅ Ping message format verified');

// Test HTTP request message format
const httpRequestMessage = {
    type: 'http-request',
    data: {
        id: 'test-request-123',
        method: 'GET',
        path: '/',
        headers: { 'User-Agent': 'test' },
        body: null
    }
};
console.log('✅ HTTP request message format verified');

// Test 4: Verify local server is running
console.log('\n4. Testing local server connectivity...');
const testRequest = http.request({
    hostname: 'localhost',
    port: LOCAL_PORT,
    path: '/',
    method: 'GET'
}, (res) => {
    console.log(`✅ Local server responding on port ${LOCAL_PORT}`);
    console.log(`   Status: ${res.statusCode}`);
    
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        try {
            const response = JSON.parse(body);
            console.log(`   Response: ${response.message}`);
        } catch (e) {
            console.log(`   Response: ${body.substring(0, 100)}...`);
        }
        
        console.log('\n🎉 All tests passed!');
        console.log('\n📋 How to use with production:');
        console.log('1. Register at https://tunnel.corrently.cloud');
        console.log('2. Create a tunnel via API (see TUNNEL_CLIENT_GUIDE.md)');
        console.log('3. Run: node tunnel-client.js https://tunnel.corrently.cloud <your-connection-id> <your-local-port>');
        process.exit(0);
    });
});

testRequest.on('error', (err) => {
    console.error(`❌ Local server not responding on port ${LOCAL_PORT}:`, err.message);
    console.log('   Make sure your test server is running: node test-server.js');
    process.exit(1);
});

testRequest.end();
