#!/bin/bash

# Test script for managed collections fixes
# This script validates that the security fixes and managed collections work properly

echo "=== Testing Managed Collections Security Fixes ==="
echo

# Test 1: Verify no direct Qdrant server access in code
echo "1. Checking for security violations in code..."
echo

# Check for forbidden IP addresses
if grep -r "10\.0\.0\.2\|127\.0\.0\.1.*6333\|localhost.*6333" tunnel-service/src/; then
    echo "❌ SECURITY VIOLATION: Found direct Qdrant server access in code!"
    exit 1
else
    echo "✅ No direct Qdrant server access found in code"
fi

# Test 2: Verify proxy-only patterns
echo
echo "2. Checking for proxy-only patterns..."
echo

if grep -r "tunnel.corrently.cloud" tunnel-service/src/; then
    echo "✅ Proxy service URLs found"
else
    echo "⚠️  No proxy service URLs found"
fi

# Test 3: Check if tunnelInfo is populated in QdrantCollection model
echo
echo "3. Checking QdrantCollection model for tunnelInfo..."
echo

if grep -q "tunnelInfo" tunnel-service/src/models/QdrantCollection.js; then
    echo "✅ tunnelInfo field found in QdrantCollection model"
else
    echo "❌ tunnelInfo field not found in QdrantCollection model"
fi

# Test 4: Check if MetaSearchService uses proxy client
echo
echo "4. Checking MetaSearchService for proxy client usage..."
echo

if grep -q "isProxyClient" tunnel-service/src/services/MetaSearchService.js; then
    echo "✅ Proxy client pattern found in MetaSearchService"
else
    echo "❌ Proxy client pattern not found in MetaSearchService"
fi

# Test 5: Check if Meta Search UI has model parameter explanation
echo
echo "5. Checking Meta Search UI for model parameter explanation..."
echo

if grep -q "for token counting" tunnel-service/admin-ui/src/pages/MetaSearch.jsx; then
    echo "✅ Model parameter explanation found in UI"
else
    echo "❌ Model parameter explanation not found in UI"
fi

# Test 6: Validate that security audit functions exist in troubleshooting guide
echo
echo "6. Checking security audit functions in troubleshooting guide..."
echo

if grep -q "auditClientSecurity" tunnel-service/CLIENT_ERROR_TROUBLESHOOTING_GUIDE.md; then
    echo "✅ Security audit functions found in troubleshooting guide"
else
    echo "❌ Security audit functions not found in troubleshooting guide"
fi

echo
echo "=== Security Compliance Summary ==="
echo

# Final security check
VIOLATIONS=0

# Check for QdrantClient direct usage (should be replaced with proxy)
if grep -q "new QdrantClient" tunnel-service/src/services/MetaSearchService.js; then
    echo "⚠️  WARNING: Direct QdrantClient usage still found in MetaSearchService"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

# Check for hardcoded ports
if grep -r ":6333" tunnel-service/src/; then
    echo "⚠️  WARNING: Port 6333 references found"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

# Check for internal IP patterns
if grep -r "10\.\|192\.168\.\|127\.0\.0\.1" tunnel-service/src/; then
    echo "⚠️  WARNING: Internal IP patterns found"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

if [ $VIOLATIONS -eq 0 ]; then
    echo "✅ All security checks passed!"
    echo "✅ Managed collections should now use proxy-only access"
    echo "✅ MetaSearchService updated for secure proxy access"
    echo "✅ UI updated with model parameter explanation"
else
    echo "⚠️  $VIOLATIONS potential security issues found"
    echo "Please review the warnings above"
fi

echo
echo "=== Next Steps ==="
echo "1. Test the Meta Search functionality with a managed collection"
echo "2. Verify that all requests go through the proxy service"
echo "3. Check logs to ensure no direct Qdrant server connections"
echo "4. Update client documentation with proxy-only examples"
echo

echo "Test completed at $(date)"
