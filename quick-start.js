#!/usr/bin/env node

/**
 * Quick start script for tunnel client
 * This helps users get started quickly with the tunnel client
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Tunnel Client Quick Start');
console.log('============================\n');

// Check if tunnel-client.js exists
const tunnelClientPath = path.join(__dirname, 'tunnel-client.js');
if (!fs.existsSync(tunnelClientPath)) {
    console.error('❌ tunnel-client.js not found in current directory');
    console.log('Please make sure tunnel-client.js is in the same directory as this script.');
    process.exit(1);
}

// Check command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('📖 Usage Instructions:');
    console.log('======================\n');
    
    console.log('1. First, create a tunnel via the API:');
    console.log('   curl -X POST https://tunnel.corrently.cloud/api/tunnels \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -H "Authorization: Bearer YOUR_API_KEY" \\');
    console.log('     -d \'{"localPort": 3000}\'\n');
    
    console.log('2. Then run the tunnel client:');
    console.log('   node quick-start.js <connection-id> <local-port>\n');
    
    console.log('3. Or run the tunnel client directly:');
    console.log('   node tunnel-client.js https://tunnel.corrently.cloud <connection-id> <local-port>\n');
    
    console.log('📋 Examples:');
    console.log('  node quick-start.js abc123def456 3000');
    console.log('  node quick-start.js xyz789uvw012 8080\n');
    
    console.log('🔗 Get your API key at: https://tunnel.corrently.cloud');
    console.log('📚 Full guide: See TUNNEL_CLIENT_GUIDE.md');
    
    process.exit(0);
}

if (args.length < 2) {
    console.error('❌ Missing arguments');
    console.log('Usage: node quick-start.js <connection-id> <local-port>');
    console.log('Example: node quick-start.js abc123def456 3000');
    process.exit(1);
}

const [connectionId, localPort] = args;
const serverUrl = 'https://tunnel.corrently.cloud';

// Validate inputs
if (!connectionId || connectionId.length < 10) {
    console.error('❌ Invalid connection ID. Connection IDs are typically longer than 10 characters.');
    process.exit(1);
}

const port = parseInt(localPort);
if (isNaN(port) || port < 1 || port > 65535) {
    console.error('❌ Invalid port number. Port must be between 1 and 65535.');
    process.exit(1);
}

console.log('🔧 Starting tunnel client...');
console.log(`   Server: ${serverUrl}`);
console.log(`   Connection ID: ${connectionId}`);
console.log(`   Local Port: ${port}\n`);

// Import and start the tunnel client
try {
    const TunnelClient = require('./tunnel-client');
    const client = new TunnelClient(serverUrl, connectionId, port);
    
    client.connect()
        .then(() => {
            console.log('🎉 Tunnel is now active!');
            console.log('   Your local application is now accessible via the tunnel URL.');
            console.log('   Press Ctrl+C to disconnect.\n');
        })
        .catch(err => {
            console.error('❌ Failed to connect tunnel:', err.message);
            console.log('\n🔍 Troubleshooting:');
            console.log('  • Make sure your connection ID is correct');
            console.log('  • Verify the tunnel hasn\'t expired (8-hour limit)');
            console.log('  • Check that your local application is running');
            console.log('  • Ensure no firewall is blocking connections');
            process.exit(1);
        });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down tunnel client...');
        client.disconnect();
        console.log('✅ Tunnel disconnected. Goodbye!');
        process.exit(0);
    });
    
} catch (err) {
    console.error('❌ Failed to start tunnel client:', err.message);
    process.exit(1);
}
