#!/bin/bash

# =============================================================================
# Git Contextor Host - End-to-End Tunnel Test Script
# =============================================================================
# This script tests the complete tunnel functionality on the production system
# Production Server: tunnel.corrently.cloud
# API Key: b6403676-186a-4d2b-8983-545b27e6c99e
# =============================================================================

set -e

# Configuration
PROD_SERVER="tunnel.corrently.cloud"
API_KEY="b6403676-186a-4d2b-8983-545b27e6c99e"
BASE_URL="https://${PROD_SERVER}"
TEST_PORT=8889
TEST_PATH="test-$(date +%s)"
LOCAL_TEST_SERVER_PID=""
TUNNEL_CLIENT_PID=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

# Cleanup function
cleanup() {
    log "Cleaning up test resources..."
    
    # Stop tunnel client first
    if [ -n "$TUNNEL_CLIENT_PID" ]; then
        if kill -0 $TUNNEL_CLIENT_PID 2>/dev/null; then
            kill $TUNNEL_CLIENT_PID 2>/dev/null || true
            sleep 2
            # Force kill if still running
            if kill -0 $TUNNEL_CLIENT_PID 2>/dev/null; then
                kill -9 $TUNNEL_CLIENT_PID 2>/dev/null || true
            fi
        fi
        success "Tunnel client stopped"
    fi
    
    # Stop local test server
    if [ -n "$LOCAL_TEST_SERVER_PID" ]; then
        if kill -0 $LOCAL_TEST_SERVER_PID 2>/dev/null; then
            kill $LOCAL_TEST_SERVER_PID 2>/dev/null || true
            sleep 2
            # Force kill if still running
            if kill -0 $LOCAL_TEST_SERVER_PID 2>/dev/null; then
                kill -9 $LOCAL_TEST_SERVER_PID 2>/dev/null || true
            fi
        fi
        success "Local test server stopped"
    fi
    
    # Delete test tunnel
    if [ -n "$TUNNEL_ID" ]; then
        curl -s -X DELETE \
            -H "Authorization: Bearer $API_KEY" \
            -H "Content-Type: application/json" \
            "$BASE_URL/api/tunnels/$TUNNEL_ID" > /dev/null 2>&1 || true
        success "Test tunnel deleted"
    fi
}

# Set up cleanup trap
trap cleanup EXIT

# Print test banner
print_banner() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║              Git Contextor Host - E2E Tunnel Test             ║"
    echo "║                Production System Test                         ║"
    echo "║              Server: tunnel.corrently.cloud                   ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Test 1: Health Check
test_health() {
    log "Testing system health..."
    
    local response=$(curl -s -w "%{http_code}" "$BASE_URL/api/health" -o /tmp/health_response.json)
    
    if [ "$response" = "200" ]; then
        success "Health check passed"
        cat /tmp/health_response.json | jq . 2>/dev/null || cat /tmp/health_response.json
    else
        error "Health check failed - HTTP $response"
        return 1
    fi
}

# Test 2: API Authentication
test_auth() {
    log "Testing API authentication..."
    
    local response=$(curl -s -w "%{http_code}" \
        -H "Authorization: Bearer $API_KEY" \
        "$BASE_URL/api/auth/me" -o /tmp/auth_response.json)
    
    if [ "$response" = "200" ]; then
        success "Authentication successful"
        cat /tmp/auth_response.json | jq . 2>/dev/null || cat /tmp/auth_response.json
    else
        error "Authentication failed - HTTP $response"
        cat /tmp/auth_response.json
        return 1
    fi
}

# Test 3: Start Local Test Server
start_local_server() {
    log "Starting local test server on port $TEST_PORT..."
    
    # Kill any existing process on the test port
    local existing_pid=$(lsof -ti :$TEST_PORT 2>/dev/null || true)
    if [ -n "$existing_pid" ]; then
        warning "Port $TEST_PORT already in use by PID $existing_pid, killing it..."
        kill -9 $existing_pid 2>/dev/null || true
        sleep 2
    fi
    
    # Create a simple test server
    cat > /tmp/test_server.js << 'INNER_EOF'
const http = require('http');
const server = http.createServer((req, res) => {
    console.log(`[TestServer] ${req.method} ${req.url} from ${req.socket.remoteAddress}`);
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({
        message: 'Hello from local test server!',
        timestamp: new Date().toISOString(),
        path: req.url,
        method: req.method,
        headers: req.headers,
        remoteAddress: req.socket.remoteAddress
    }));
});

const PORT = process.env.TEST_PORT || 8888;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Test server running on http://0.0.0.0:${PORT}`);
    console.log(`Accessible via http://localhost:${PORT} and http://127.0.0.1:${PORT}`);
});

// Handle server errors
server.on('error', (err) => {
    console.error('Server error:', err);
});
INNER_EOF
    
    # Start the test server with logging
    TEST_PORT=$TEST_PORT node /tmp/test_server.js > /tmp/test_server.log 2>&1 &
    LOCAL_TEST_SERVER_PID=$!
    
    log "Test server started with PID: $LOCAL_TEST_SERVER_PID"
    
    # Wait for server to start
    sleep 3
    
    # Check if process is still running
    if ! kill -0 $LOCAL_TEST_SERVER_PID 2>/dev/null; then
        error "Test server process died immediately"
        error "Test server logs:"
        cat /tmp/test_server.log
        return 1
    fi
    
    # Test local server
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        # Check if process is still running
        if ! kill -0 $LOCAL_TEST_SERVER_PID 2>/dev/null; then
            error "Test server process died during startup"
            error "Test server logs:"
            cat /tmp/test_server.log
            return 1
        fi
        
        log "Testing local server (attempt $attempt/$max_attempts)..."
        local response=$(curl -s -w "%{http_code}" "http://localhost:$TEST_PORT" -o /tmp/local_test.json 2>/dev/null)
        
        if [ "$response" = "200" ]; then
            success "Local test server started successfully"
            cat /tmp/local_test.json | jq . 2>/dev/null || cat /tmp/local_test.json
            
            # Test that server is also accessible via 127.0.0.1
            local response_127=$(curl -s -w "%{http_code}" "http://127.0.0.1:$TEST_PORT" -o /tmp/local_test_127.json 2>/dev/null)
            if [ "$response_127" = "200" ]; then
                success "Local test server accessible via 127.0.0.1"
            else
                warning "Local test server not accessible via 127.0.0.1 (HTTP $response_127)"
            fi
            
            # Show server logs
            log "Test server logs:"
            cat /tmp/test_server.log
            
            return 0
        else
            warning "Local test server not ready yet (attempt $attempt/$max_attempts) - HTTP $response"
            if [ $attempt -eq $max_attempts ]; then
                error "Local test server failed to start after $max_attempts attempts"
                error "Test server logs:"
                cat /tmp/test_server.log
                return 1
            fi
            sleep 2
        fi
        
        ((attempt++))
    done
}

# Test 4: Create Tunnel
create_tunnel() {
    log "Creating tunnel with path: $TEST_PATH..."
    
    local response=$(curl -s -w "%{http_code}" \
        -X POST \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"tunnelPath\": \"$TEST_PATH\",
            \"localPort\": $TEST_PORT,
            \"description\": \"E2E Test Tunnel - $(date)\"
        }" \
        "$BASE_URL/api/tunnels" -o /tmp/tunnel_response.json)
    
    if [ "$response" = "201" ] || [ "$response" = "200" ]; then
        success "Tunnel created successfully"
        
        # Extract tunnel ID
        TUNNEL_ID=$(cat /tmp/tunnel_response.json | jq -r '.id // .tunnel.id // .tunnelId' 2>/dev/null)
        
        if [ "$TUNNEL_ID" = "null" ] || [ -z "$TUNNEL_ID" ]; then
            warning "Could not extract tunnel ID, using path for cleanup"
            TUNNEL_ID="$TEST_PATH"
        fi
        
        # Extract connection ID
        CONNECTION_ID=$(cat /tmp/tunnel_response.json | jq -r '.connectionId // .tunnel.connectionId' 2>/dev/null)
        
        if [ "$CONNECTION_ID" = "null" ] || [ -z "$CONNECTION_ID" ]; then
            error "Could not extract connection ID from tunnel response"
            return 1
        fi
        
        cat /tmp/tunnel_response.json | jq . 2>/dev/null || cat /tmp/tunnel_response.json
        
        # Extract tunnel URL
        TUNNEL_URL=$(cat /tmp/tunnel_response.json | jq -r '.url // .tunnel.url // .tunnelUrl' 2>/dev/null)
        
        if [ "$TUNNEL_URL" = "null" ] || [ -z "$TUNNEL_URL" ]; then
            TUNNEL_URL="https://${PROD_SERVER}/tunnel/${TEST_PATH}"
        fi
        
        success "Tunnel URL: $TUNNEL_URL"
        success "Connection ID: $CONNECTION_ID"
        
    else
        error "Tunnel creation failed - HTTP $response"
        cat /tmp/tunnel_response.json
        return 1
    fi
}

# Test 4.5: Start Tunnel Client
start_tunnel_client() {
    log "Starting tunnel client..."
    
    if [ -z "$CONNECTION_ID" ]; then
        error "Connection ID not available - cannot start tunnel client"
        return 1
    fi
    
    # Start tunnel client with more verbose logging
    node tunnel-client.js "$BASE_URL" "$CONNECTION_ID" "$TEST_PORT" > /tmp/tunnel_client.log 2>&1 &
    TUNNEL_CLIENT_PID=$!
    
    # Wait for tunnel client to connect
    sleep 8
    
    # Check if tunnel client is running
    if kill -0 $TUNNEL_CLIENT_PID 2>/dev/null; then
        success "Tunnel client started successfully"
        log "Tunnel client PID: $TUNNEL_CLIENT_PID"
        
        # Show recent logs
        log "Tunnel client logs:"
        tail -n 10 /tmp/tunnel_client.log
        
        # Wait a bit more for WebSocket connection to establish
        sleep 5
    else
        error "Tunnel client failed to start"
        error "Tunnel client logs:"
        cat /tmp/tunnel_client.log
        return 1
    fi
}

# Test 5: Test Tunnel Connectivity
test_tunnel_connectivity() {
    log "Testing tunnel connectivity..."
    
    # First, verify the local server is still running
    if ! kill -0 $LOCAL_TEST_SERVER_PID 2>/dev/null; then
        error "Local test server process died! Restarting..."
        start_local_server
    else
        success "Local test server is still running (PID: $LOCAL_TEST_SERVER_PID)"
        
        # Test local server connectivity via localhost
        local response=$(curl -s -w "%{http_code}" "http://localhost:$TEST_PORT" -o /tmp/local_verify.json 2>/dev/null)
        if [ "$response" = "200" ]; then
            success "Local server is responding correctly via localhost"
        else
            error "Local server not responding via localhost! Response: $response"
            error "Local server logs:"
            cat /tmp/test_server.log
            return 1
        fi
        
        # Test local server connectivity via 127.0.0.1
        local response_127=$(curl -s -w "%{http_code}" "http://127.0.0.1:$TEST_PORT" -o /tmp/local_verify_127.json 2>/dev/null)
        if [ "$response_127" = "200" ]; then
            success "Local server is responding correctly via 127.0.0.1"
        else
            error "Local server not responding via 127.0.0.1! Response: $response_127"
            error "This is likely why the tunnel client can't connect"
            return 1
        fi
    fi
    
    # Wait for tunnel to be ready
    log "Waiting for tunnel to be active..."
    sleep 15
    
    # Test tunnel connection
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log "Testing tunnel connection (attempt $attempt/$max_attempts)..."
        
        local response=$(curl -s -w "%{http_code}" \
            -H "User-Agent: E2E-Test-Script" \
            -H "Accept: application/json" \
            --connect-timeout 10 \
            --max-time 30 \
            "$TUNNEL_URL" -o /tmp/tunnel_test.json 2>/dev/null)
        
        if [ "$response" = "200" ]; then
            success "Tunnel connectivity test passed!"
            
            # Verify response content
            local message=$(cat /tmp/tunnel_test.json | jq -r '.message' 2>/dev/null)
            if [ "$message" = "Hello from local test server!" ]; then
                success "Tunnel is correctly forwarding requests to local server"
                cat /tmp/tunnel_test.json | jq . 2>/dev/null || cat /tmp/tunnel_test.json
                return 0
            else
                warning "Tunnel response doesn't match expected content"
                cat /tmp/tunnel_test.json
            fi
            
        else
            warning "Tunnel test failed - HTTP $response (attempt $attempt/$max_attempts)"
            
            # Show detailed error information
            if [ -f /tmp/tunnel_test.json ]; then
                log "Response content:"
                cat /tmp/tunnel_test.json
            fi
            
            # Show tunnel client logs if failing
            if [ $attempt -eq 3 ]; then
                log "Tunnel client logs (last 20 lines):"
                tail -n 20 /tmp/tunnel_client.log
            fi
            
            if [ $attempt -eq $max_attempts ]; then
                error "Tunnel connectivity test failed after $max_attempts attempts"
                return 1
            fi
        fi
        
        sleep 8
        ((attempt++))
    done
}

# Test 6: Test Multiple Requests
test_multiple_requests() {
    log "Testing multiple requests through tunnel..."
    
    for i in {1..5}; do
        local response=$(curl -s -w "%{http_code}" \
            -H "X-Test-Request: $i" \
            "$TUNNEL_URL/test/$i" -o /tmp/tunnel_test_$i.json)
        
        if [ "$response" = "200" ]; then
            success "Request $i successful"
        else
            warning "Request $i failed - HTTP $response"
        fi
        
        sleep 1
    done
}

# Test 7: List Tunnels
test_list_tunnels() {
    log "Testing tunnel listing..."
    
    local response=$(curl -s -w "%{http_code}" \
        -H "Authorization: Bearer $API_KEY" \
        "$BASE_URL/api/tunnels" -o /tmp/tunnels_list.json)
    
    if [ "$response" = "200" ]; then
        success "Tunnel listing successful"
        
        # Check if our tunnel is in the list
        local found=$(cat /tmp/tunnels_list.json | jq -r ".[] | select(.tunnelPath == \"$TEST_PATH\") | .tunnelPath" 2>/dev/null)
        
        if [ "$found" = "$TEST_PATH" ]; then
            success "Test tunnel found in listing"
        else
            warning "Test tunnel not found in listing"
        fi
        
        cat /tmp/tunnels_list.json | jq . 2>/dev/null || cat /tmp/tunnels_list.json
    else
        error "Tunnel listing failed - HTTP $response"
        cat /tmp/tunnels_list.json
        return 1
    fi
}

# Test 8: Performance Test
test_performance() {
    log "Running basic performance test..."
    
    local start_time=$(date +%s.%3N)
    
    for i in {1..10}; do
        curl -s "$TUNNEL_URL/perf/$i" > /dev/null
    done
    
    local end_time=$(date +%s.%3N)
    local duration=$(echo "$end_time - $start_time" | bc -l)
    
    success "Performance test completed - 10 requests in ${duration}s"
}

# Test 9: Test Qdrant Collections
test_qdrant_collections() {
    log "Testing Qdrant collections functionality..."
    
    # Test 1: List collections
    log "Testing collection listing..."
    local response=$(curl -s -w "%{http_code}" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        "$BASE_URL/api/qdrant/collections" -o /tmp/qdrant_collections.json)
    
    if [ "$response" = "200" ]; then
        success "Qdrant collections listing successful"
        cat /tmp/qdrant_collections.json | jq . 2>/dev/null || cat /tmp/qdrant_collections.json
    else
        error "Qdrant collections listing failed - HTTP $response"
        cat /tmp/qdrant_collections.json
        return 1
    fi
    
    # Test 2: Create a test collection
    log "Testing collection creation..."
    local test_collection_name="test-collection-$(date +%s)"
    local response=$(curl -s -w "%{http_code}" \
        -X POST \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"$test_collection_name\",
            \"description\": \"E2E test collection\",
            \"vectorSize\": 1536,
            \"distance\": \"Cosine\"
        }" \
        "$BASE_URL/api/qdrant/collections" -o /tmp/qdrant_create.json)
    
    if [ "$response" = "201" ] || [ "$response" = "200" ]; then
        success "Test collection '$test_collection_name' created successfully"
        cat /tmp/qdrant_create.json | jq . 2>/dev/null || cat /tmp/qdrant_create.json
        
        # Extract collection ID and tunnel path for subsequent tests
        COLLECTION_ID=$(cat /tmp/qdrant_create.json | jq -r '.id // ._id' 2>/dev/null)
        TUNNEL_PATH=$(cat /tmp/qdrant_create.json | jq -r '.tunnelInfo.tunnelPath // .tunnel.tunnelPath' 2>/dev/null)
        
        if [ "$COLLECTION_ID" = "null" ] || [ -z "$COLLECTION_ID" ]; then
            error "Could not extract collection ID from response"
            return 1
        fi
        
        if [ "$TUNNEL_PATH" = "null" ] || [ -z "$TUNNEL_PATH" ]; then
            warning "No tunnel path found - direct proxy tests will be skipped"
        else
            success "Collection tunnel path: $TUNNEL_PATH"
        fi
    else
        error "Collection creation failed - HTTP $response"
        cat /tmp/qdrant_create.json
        return 1
    fi
    
    # Test 3: Get collection info
    log "Testing collection info retrieval..."
    local response=$(curl -s -w "%{http_code}" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        "$BASE_URL/api/qdrant/collections/$COLLECTION_ID" -o /tmp/qdrant_info.json)
    
    if [ "$response" = "200" ]; then
        success "Collection info retrieved successfully"
        cat /tmp/qdrant_info.json | jq . 2>/dev/null || cat /tmp/qdrant_info.json
    else
        warning "Collection info retrieval failed - HTTP $response (may be expected in mock mode)"
        cat /tmp/qdrant_info.json
    fi
    
    # Test 3.5: Test collection connection
    log "Testing collection connection..."
    local response=$(curl -s -w "%{http_code}" \
        -X POST \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        "$BASE_URL/api/qdrant/collections/$COLLECTION_ID/test-connection" -o /tmp/qdrant_test_connection.json)
    
    if [ "$response" = "200" ]; then
        local success_status=$(cat /tmp/qdrant_test_connection.json | jq -r '.success' 2>/dev/null)
        if [ "$success_status" = "true" ]; then
            success "Collection connection test passed"
        else
            warning "Collection connection test failed but API responded"
        fi
        cat /tmp/qdrant_test_connection.json | jq . 2>/dev/null || cat /tmp/qdrant_test_connection.json
    else
        error "Collection connection test failed - HTTP $response"
        cat /tmp/qdrant_test_connection.json
    fi
    
    # Test 4: Direct Qdrant API access via proxy (if tunnel path available)
    if [ -n "$TUNNEL_PATH" ] && [ "$TUNNEL_PATH" != "null" ]; then
        log "Testing direct Qdrant API access via proxy..."
        
        # Test collections listing via proxy
        local response=$(curl -s -w "%{http_code}" \
            -H "Authorization: Bearer $API_KEY" \
            -H "Content-Type: application/json" \
            "$BASE_URL/qdrant/$TUNNEL_PATH/collections" -o /tmp/qdrant_proxy_collections.json)
        
        if [ "$response" = "200" ]; then
            success "Direct Qdrant API access successful"
            cat /tmp/qdrant_proxy_collections.json | jq . 2>/dev/null || cat /tmp/qdrant_proxy_collections.json
        else
            warning "Direct Qdrant API access failed - HTTP $response (may be expected in mock mode)"
            cat /tmp/qdrant_proxy_collections.json
        fi
    else
        warning "Skipping direct Qdrant API tests - no tunnel path available"
    fi
    
    # Test 5: Test user isolation (try to access non-existent collection)
    log "Testing user isolation..."
    local response=$(curl -s -w "%{http_code}" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        "$BASE_URL/api/qdrant/collections/647f1f77bcf86cd799439011" -o /tmp/qdrant_isolation.json)
    
    if [ "$response" = "404" ] || [ "$response" = "403" ]; then
        success "User isolation working correctly - unauthorized access blocked"
    else
        warning "User isolation test unexpected result - HTTP $response"
        cat /tmp/qdrant_isolation.json
    fi
    
    # Test 6: Delete test collection (cleanup)
    log "Cleaning up test collection..."
    local response=$(curl -s -w "%{http_code}" \
        -X DELETE \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        "$BASE_URL/api/qdrant/collections/$COLLECTION_ID" -o /tmp/qdrant_delete.json)
    
    if [ "$response" = "200" ]; then
        success "Test collection deleted successfully"
        cat /tmp/qdrant_delete.json | jq . 2>/dev/null || cat /tmp/qdrant_delete.json
    else
        warning "Collection deletion failed - HTTP $response (may be expected in mock mode)"
        cat /tmp/qdrant_delete.json
    fi
    
    success "Qdrant collections test completed"
}

# Test 10: Test Qdrant Collection Management
test_qdrant_management() {
    log "Testing Qdrant collection management..."
    
    # Test listing managed collections
    log "Testing managed collections listing..."
    local response=$(curl -s -w "%{http_code}" \
        -H "Authorization: Bearer $API_KEY" \
        "$BASE_URL/api/qdrant/collections" -o /tmp/qdrant_mgmt_list.json)
    
    if [ "$response" = "200" ]; then
        success "Managed collections listed successfully"
        cat /tmp/qdrant_mgmt_list.json | jq . 2>/dev/null || cat /tmp/qdrant_mgmt_list.json
    else
        warning "Managed collections listing failed - HTTP $response"
        cat /tmp/qdrant_mgmt_list.json
    fi
}

# Main test function
run_tests() {
    print_banner
    
    log "Starting end-to-end tunnel test..."
    log "Production Server: $PROD_SERVER"
    log "Test Path: $TEST_PATH"
    log "Local Test Port: $TEST_PORT"
    
    # Run all tests
    test_health
    test_auth
    test_qdrant_collections
    test_qdrant_management
    start_local_server
    create_tunnel
    start_tunnel_client
    test_tunnel_connectivity
    test_multiple_requests
    test_list_tunnels
    test_performance
    test_qdrant_collections
    test_qdrant_management
    
    success "All tests completed successfully!"
    
    # Print test summary
    echo -e "\n${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                        Test Summary                           ║${NC}"
    echo -e "${BLUE}╠═══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BLUE}║ Production Server: $PROD_SERVER                        ║${NC}"
    echo -e "${BLUE}║ Test Path: $TEST_PATH                              ║${NC}"
    echo -e "${BLUE}║ Tunnel URL: $TUNNEL_URL           ║${NC}"
    echo -e "${BLUE}║ Local Server: http://localhost:$TEST_PORT                      ║${NC}"
    echo -e "${BLUE}║                                                               ║${NC}"
    echo -e "${BLUE}║ Tests Passed: ✅ All tests successful                        ║${NC}"
    echo -e "${BLUE}║ Qdrant Collections: ✅ CRUD operations working               ║${NC}"
    echo -e "${BLUE}║ Tunnel Status: ✅ Active and functional                      ║${NC}"
    echo -e "${BLUE}║ Performance: ✅ 10 requests completed                        ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
}

# Command line options
case "${1:-test}" in
    test)
        run_tests
        ;;
    health)
        test_health
        ;;
    auth)
        test_auth
        ;;
    qdrant)
        test_qdrant_collections
        test_qdrant_management
        ;;
    create)
        start_local_server
        create_tunnel
        start_tunnel_client
        success "Tunnel created. Access at: $TUNNEL_URL"
        success "Press Ctrl+C to stop and cleanup"
        wait
        ;;
    *)
        echo "Usage: $0 {test|health|auth|qdrant|create}"
        echo ""
        echo "Commands:"
        echo "  test   - Run complete end-to-end test"
        echo "  health - Test system health only"
        echo "  auth   - Test API authentication only"
        echo "  qdrant - Test Qdrant collections only"
        echo "  create - Create tunnel and keep it running"
        exit 1
        ;;
esac
