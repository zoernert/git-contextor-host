# End-to-End Tunnel Test Guide

## Overview
This test script (`test-system.sh`) performs comprehensive end-to-end testing of the Git Contextor Host tunneling service on the production system at `tunnel.corrently.cloud`.

## Prerequisites
- `curl` command available
- `jq` command available (for JSON parsing)
- `node` command available (for local test server)
- `bc` command available (for performance calculations)

## Commands

### 🔍 Full End-to-End Test
```bash
./test-system.sh test
```
This runs all tests in sequence:
1. **Health Check** - Verifies system is responding
2. **Authentication** - Tests API key authentication
3. **Local Server** - Starts a test HTTP server locally
4. **Tunnel Creation** - Creates a tunnel via API
5. **Connectivity Test** - Tests tunnel forwarding
6. **Multiple Requests** - Tests tunnel under load
7. **Tunnel Listing** - Verifies tunnel appears in API
8. **Performance Test** - Basic performance measurement

### 🏥 Health Check Only
```bash
./test-system.sh health
```
Quick test to verify the production system is responding.

### 🔐 Authentication Test Only
```bash
./test-system.sh auth
```
Tests API key authentication without creating tunnels.

### 🚇 Create Persistent Tunnel
```bash
./test-system.sh create
```
Creates a tunnel and keeps it running for manual testing. Press Ctrl+C to stop and cleanup.

## What the Test Does

### 1. **System Health Verification**
- Checks if `https://tunnel.corrently.cloud/api/health` responds
- Verifies basic system functionality

### 2. **API Authentication**
- Tests the API key: `b6403676-186a-4d2b-8983-545b27e6c99e`
- Verifies authentication endpoint works

### 3. **Local Test Server**
- Starts a Node.js HTTP server on port 8888
- Serves JSON responses for testing
- Automatically cleaned up after tests

### 4. **Tunnel Creation**
- Creates a tunnel with path-based URL (e.g., `https://tunnel.corrently.cloud/tunnel/abc123`)
- Uses API to register the tunnel
- Starts WebSocket tunnel client to handle traffic
- Extracts tunnel URL for testing

### 5. **Connectivity Testing**
- Tests if requests to `https://tunnel.corrently.cloud/tunnel/xxx` 
- Forwards correctly to local server on port 8888 via WebSocket tunnel client
- Retries up to 10 times with delays

### 6. **Load Testing**
- Sends 5 sequential requests through the tunnel
- Tests 10 requests for performance measurement
- Measures response times

### 7. **Automatic Cleanup**
- Stops local test server
- Deletes created tunnel via API
- Runs automatically on script exit

## Expected Output

### ✅ Successful Test Run
```
╔═══════════════════════════════════════════════════════════════╗
║              Git Contextor Host - E2E Tunnel Test             ║
║                Production System Test                         ║
║              Server: tunnel.corrently.cloud                   ║
╚═══════════════════════════════════════════════════════════════╝

[2025-07-12 20:19:38] Starting end-to-end tunnel test...
[2025-07-12 20:19:38] Production Server: tunnel.corrently.cloud
[2025-07-12 20:19:38] Test Subdomain: test-1720812345
[2025-07-12 20:19:38] Local Test Port: 8888

[2025-07-12 20:19:38] ✅ Health check passed
[2025-07-12 20:19:38] ✅ Authentication successful
[2025-07-12 20:19:38] ✅ Local test server started successfully
[2025-07-12 20:19:38] ✅ Tunnel created successfully
[2025-07-12 20:19:38] ✅ Tunnel connectivity test passed!
[2025-07-12 20:19:38] ✅ All tests completed successfully!

╔═══════════════════════════════════════════════════════════════╗
║                        Test Summary                           ║
╠═══════════════════════════════════════════════════════════════╣
║ Production Server: tunnel.corrently.cloud                     ║
║ Test Subdomain: test-1720812345                              ║
║ Tunnel URL: https://test-1720812345.tunnel.corrently.cloud   ║
║ Local Server: http://localhost:8888                          ║
║                                                               ║
║ Tests Passed: ✅ All tests successful                        ║
║ Tunnel Status: ✅ Active and functional                      ║
║ Performance: ✅ 10 requests completed                        ║
╚═══════════════════════════════════════════════════════════════╝
```

## Troubleshooting

### Common Issues

1. **"Health check failed"**
   - Check if `tunnel.corrently.cloud` is accessible
   - Verify internet connection
   - Check if production system is running

2. **"Authentication failed"**
   - Verify API key is correct
   - Check if API key has proper permissions
   - Ensure authentication endpoint is working

3. **"Local test server failed to start"**
   - Check if port 8888 is available
   - Verify Node.js is installed
   - Check if another process is using the port

4. **"Tunnel creation failed"**
   - Verify API key has tunnel creation permissions
   - Check if subdomain conflicts exist
   - Review API response for error details

5. **"Tunnel connectivity test failed"**
   - Allow more time for tunnel to become active
   - Check if local server is responding
   - Verify tunnel URL is correct

### Manual Verification

After running the test, you can manually verify the tunnel:

```bash
# Start local server
node -e "require('http').createServer((req,res)=>{res.end('Hello World!')}).listen(8888)"

# In another terminal, run create command
./test-system.sh create

# Test the tunnel URL in browser or with curl
curl https://test-xxx.tunnel.corrently.cloud
```

## Configuration

The test script uses these settings:

```bash
PROD_SERVER="tunnel.corrently.cloud"
API_KEY="b6403676-186a-4d2b-8983-545b27e6c99e"
BASE_URL="https://tunnel.corrently.cloud"
TEST_PORT=8888
```

To modify these settings, edit the script variables at the top of `test-system.sh`.

## Security Note

The API key is included in the script for testing purposes. In a production environment, consider:
- Using environment variables for API keys
- Restricting API key permissions
- Using temporary test keys for automated testing
- Implementing key rotation policies
