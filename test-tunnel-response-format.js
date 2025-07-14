#!/usr/bin/env node

/**
 * Test script to verify tunnel creation API response format
 */

const http = require('http');

// Mock API response test
async function testTunnelResponseFormat() {
    console.log('🧪 Testing Tunnel API Response Format');
    console.log('=====================================\n');

    // Simulate what the client should expect
    const mockApiResponse = {
        id: "6874cf82ee9721f75e9307f2",                    // Database ID
        tunnelPath: "-GUU7qfYbvos",                        // URL identifier  
        connectionId: "8d2a01fa-4126-432d-9b47-74f5733174cd", // WebSocket ID
        url: "https://tunnel.corrently.cloud/tunnel/-GUU7qfYbvos", // Complete URL
        localPort: 3000,
        isActive: true,
        expiresAt: "2025-07-14T02:30:00.000Z"
    };

    console.log('✅ Expected API Response Format:');
    console.log(JSON.stringify(mockApiResponse, null, 2));
    console.log();

    // Test correct usage patterns
    console.log('✅ CORRECT Usage Patterns:');
    console.log('==========================');
    
    console.log('1. HTTP Requests:');
    console.log(`   Base URL: ${mockApiResponse.url}`);
    console.log(`   Sub-path: ${mockApiResponse.url}/shared/test`);
    console.log(`   Sub-path: ${mockApiResponse.url}/api/health`);
    console.log();

    console.log('2. WebSocket Connection:');
    console.log(`   WS URL: wss://tunnel.corrently.cloud/ws/tunnel/${mockApiResponse.connectionId}`);
    console.log();

    console.log('❌ INCORRECT Usage (what client was doing):');
    console.log('===========================================');
    console.log(`   Wrong URL: https://tunnel.corrently.cloud/tunnel/${mockApiResponse.id}/shared/test`);
    console.log(`   ^ Using database ID instead of tunnelPath`);
    console.log();

    // Test path extraction
    console.log('🔍 Path Forwarding Test:');
    console.log('========================');
    
    const testUrls = [
        `${mockApiResponse.url}`,
        `${mockApiResponse.url}/shared/test`,
        `${mockApiResponse.url}/api/health`,
        `${mockApiResponse.url}/nested/path/to/file.txt`
    ];

    testUrls.forEach(url => {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        const tunnelId = pathParts[2]; // /tunnel/{id}/...
        const subPath = '/' + pathParts.slice(3).join('/');
        
        console.log(`   Request: ${url}`);
        console.log(`   → Tunnel ID: ${tunnelId}`);
        console.log(`   → Forward Path: ${subPath === '/' ? '/' : subPath}`);
        console.log();
    });

    console.log('📋 Summary for Client Development Team:');
    console.log('======================================');
    console.log('1. Use response.url for all HTTP requests');
    console.log('2. Use response.connectionId for WebSocket connections');
    console.log('3. Never use response.id in URLs (database ID only)');
    console.log('4. The server will extract the correct path for forwarding');
}

testTunnelResponseFormat().catch(console.error);
