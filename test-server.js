const http = require('http');

const server = http.createServer((req, res) => {
    console.log(`[TestServer] ${req.method} ${req.url}`);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', () => {
        const response = {
            message: 'Hello from tunneled server!',
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: body || null
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response, null, 2));
    });
});

const PORT = 3333;
server.listen(PORT, () => {
    console.log(`[TestServer] Running on http://localhost:${PORT}`);
    console.log(`[TestServer] Ready to be tunneled!`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[TestServer] Shutting down...');
    server.close(() => {
        console.log('[TestServer] Server closed.');
        process.exit(0);
    });
});
