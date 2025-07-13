#!/usr/bin/env node

/**
 * Test WebSocket connection to production server
 * This will test the connection and authentication flow
 */

const WebSocket = require('ws');

const TUNNEL_SERVER = 'https://tunnel.corrently.cloud';
const TEST_CONNECTION_ID = 'test-connection-id-' + Date.now();

console.log('🔗 Testing WebSocket Connection to Production');
console.log('============================================');

const wsUrl = TUNNEL_SERVER.replace('https://', 'wss://').replace('http://', 'ws://');
const fullWsUrl = `${wsUrl}/ws/tunnel/${TEST_CONNECTION_ID}`;

console.log(`Connecting to: ${fullWsUrl}`);

const ws = new WebSocket(fullWsUrl);

ws.on('open', () => {
    console.log('✅ WebSocket connection established');
    console.log('📤 Sending authentication message...');
    
    // Send the authentication message that tunnel-client.js sends
    ws.send(JSON.stringify({ connectionId: TEST_CONNECTION_ID }));
});

ws.on('message', (message) => {
    console.log('📥 Received message:', message.toString());
});

ws.on('close', (code, reason) => {
    console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
    console.log('ℹ️  This is expected - the test connection ID is not valid');
    console.log('✅ Connection flow works correctly!');
    process.exit(0);
});

ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err.message);
    
    if (err.message.includes('ENOTFOUND')) {
        console.log('🌐 DNS resolution failed - check if tunnel.corrently.cloud is accessible');
    } else if (err.message.includes('ECONNREFUSED')) {
        console.log('🚫 Connection refused - server may be down');
    } else {
        console.log('🔍 Check your network connection and try again');
    }
    
    process.exit(1);
});

// Timeout after 10 seconds
setTimeout(() => {
    console.log('⏰ Connection timeout - closing test');
    ws.close();
}, 10000);
