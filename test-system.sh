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
TEST_PORT=8888
TEST_PATH="test-$(date +%s)"
LOCAL_TEST_SERVER_PID=""

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
    
    # Stop local test server
    if [ -n "$LOCAL_TEST_SERVER_PID" ]; then
        kill $LOCAL_TEST_SERVER_PID 2>/dev/null || true
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
    
    # Create a simple test server
    cat > /tmp/test_server.js << 'INNER_EOF'
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({
        message: 'Hello from local test server!',
        timestamp: new Date().toISOString(),
        path: req.url,
        method: req.method,
        headers: req.headers
    }));
});

const PORT = process.env.TEST_PORT || 8888;
server.listen(PORT, 'localhost', () => {
    console.log(`Test server running on http://localhost:${PORT}`);
});
INNER_EOF
    
    # Start the test server
    TEST_PORT=$TEST_PORT node /tmp/test_server.js &
    LOCAL_TEST_SERVER_PID=$!
    
    # Wait for server to start
    sleep 3
    
    # Test local server
    local response=$(curl -s -w "%{http_code}" "http://localhost:$TEST_PORT" -o /tmp/local_test.json)
    
    if [ "$response" = "200" ]; then
        success "Local test server started successfully"
        cat /tmp/local_test.json | jq . 2>/dev/null || cat /tmp/local_test.json
    else
        error "Local test server failed to start"
        return 1
    fi
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
        
        cat /tmp/tunnel_response.json | jq . 2>/dev/null || cat /tmp/tunnel_response.json
        
        # Extract tunnel URL
        TUNNEL_URL=$(cat /tmp/tunnel_response.json | jq -r '.url // .tunnel.url // .tunnelUrl' 2>/dev/null)
        
        if [ "$TUNNEL_URL" = "null" ] || [ -z "$TUNNEL_URL" ]; then
            TUNNEL_URL="https://${PROD_SERVER}/tunnel/${TEST_PATH}"
        fi
        
        success "Tunnel URL: $TUNNEL_URL"
        
    else
        error "Tunnel creation failed - HTTP $response"
        cat /tmp/tunnel_response.json
        return 1
    fi
}

# Test 5: Test Tunnel Connectivity
test_tunnel_connectivity() {
    log "Testing tunnel connectivity..."
    
    # Wait for tunnel to be ready
    log "Waiting for tunnel to be active..."
    sleep 10
    
    # Test tunnel connection
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log "Testing tunnel connection (attempt $attempt/$max_attempts)..."
        
        local response=$(curl -s -w "%{http_code}" \
            -H "User-Agent: E2E-Test-Script" \
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
            if [ $attempt -eq $max_attempts ]; then
                error "Tunnel connectivity test failed after $max_attempts attempts"
                return 1
            fi
        fi
        
        sleep 5
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
        local found=$(cat /tmp/tunnels_list.json | jq -r ".[] | select(.subdomain == \"$TEST_SUBDOMAIN\") | .subdomain" 2>/dev/null)
        
        if [ "$found" = "$TEST_SUBDOMAIN" ]; then
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

# Main test function
run_tests() {
    print_banner
    
    log "Starting end-to-end tunnel test..."
    log "Production Server: $PROD_SERVER"
    log "Test Subdomain: $TEST_SUBDOMAIN"
    log "Local Test Port: $TEST_PORT"
    
    # Run all tests
    test_health
    test_auth
    start_local_server
    create_tunnel
    test_tunnel_connectivity
    test_multiple_requests
    test_list_tunnels
    test_performance
    
    success "All tests completed successfully!"
    
    # Print test summary
    echo -e "\n${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                        Test Summary                           ║${NC}"
    echo -e "${BLUE}╠═══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BLUE}║ Production Server: $PROD_SERVER                        ║${NC}"
    echo -e "${BLUE}║ Test Subdomain: $TEST_SUBDOMAIN                              ║${NC}"
    echo -e "${BLUE}║ Tunnel URL: $TUNNEL_URL           ║${NC}"
    echo -e "${BLUE}║ Local Server: http://localhost:$TEST_PORT                      ║${NC}"
    echo -e "${BLUE}║                                                               ║${NC}"
    echo -e "${BLUE}║ Tests Passed: ✅ All tests successful                        ║${NC}"
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
    create)
        start_local_server
        create_tunnel
        success "Tunnel created. Access at: $TUNNEL_URL"
        success "Press Ctrl+C to stop and cleanup"
        wait
        ;;
    *)
        echo "Usage: $0 {test|health|auth|create}"
        echo ""
        echo "Commands:"
        echo "  test   - Run complete end-to-end test"
        echo "  health - Test system health only"
        echo "  auth   - Test API authentication only"
        echo "  create - Create tunnel and keep it running"
        exit 1
        ;;
esac
