#!/usr/bin/env node

const https = require('https');

// Test script to create a tunnel on production
async function createTunnel() {
    const data = JSON.stringify({
        localPort: 3333
    });

    const options = {
        hostname: 'tunnel.corrently.cloud',
        port: 443,
        path: '/api/tunnels',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
            // You'll need to provide a valid API key here
            'Authorization': `Bearer ${process.env.API_KEY || ''}`
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            
            res.on('data', (chunk) => {
                body += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 201 || res.statusCode === 200) {
                    resolve(JSON.parse(body));
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.write(data);
        req.end();
    });
}

// Test creating a tunnel
createTunnel()
    .then(tunnel => {
        console.log('Tunnel created successfully:');
        console.log(`  Connection ID: ${tunnel.connectionId}`);
        console.log(`  Tunnel URL: ${tunnel.url}`);
        console.log(`  Expires At: ${tunnel.expiresAt}`);
        console.log('');
        console.log('Now run the tunnel client:');
        console.log(`  node tunnel-client.js https://tunnel.corrently.cloud ${tunnel.connectionId} 3333`);
    })
    .catch(err => {
        console.error('Failed to create tunnel:', err.message);
        console.log('');
        console.log('To test with production, you need:');
        console.log('1. Register at https://tunnel.corrently.cloud');
        console.log('2. Get your API key from the dashboard');
        console.log('3. Set it as environment variable: export API_KEY=your_api_key_here');
        console.log('4. Run this script again');
    });
