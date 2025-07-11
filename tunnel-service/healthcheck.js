#!/usr/bin/env node

const http = require('http');

const options = {
    host: 'localhost',
    port: process.env.PORT || 5000,
    path: '/api/health',
    timeout: 5000,
    method: 'GET'
};

const request = http.request(options, (res) => {
    if (res.statusCode === 200) {
        console.log('Health check passed');
        process.exit(0);
    } else {
        console.log(`Health check failed with status: ${res.statusCode}`);
        process.exit(1);
    }
});

request.on('error', (error) => {
    console.log(`Health check failed with error: ${error.message}`);
    process.exit(1);
});

request.on('timeout', () => {
    console.log('Health check timed out');
    request.destroy();
    process.exit(1);
});

request.end();
