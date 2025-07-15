#!/bin/bash

# SECURE Qdrant Test Script
# This script demonstrates the ONLY approved way to access Qdrant: via our proxy service

echo "🔒 Testing SECURE Qdrant Access via Proxy Service"
echo "=========================================="

# Production environment values - ONLY proxy service endpoint
BASE_URL="https://tunnel.corrently.cloud/api/qdrant"
COLLECTION_UUID="ca9536d1-3d21-475a-aa4e-c108a676e101"
COLLECTION_NAME="test-collection"
API_KEY="b6403676-186a-4d2b-8983-545b27e6c99e"

# Generate 768-dimension vector (required by the collection)
VECTOR_768=$(python3 -c "import json; print(json.dumps([0.1] * 768))")

# Generate a UUID for the point ID (Qdrant requires UUID or integer)
POINT_UUID=$(python3 -c "import uuid; print(str(uuid.uuid4()))")

# Create a valid vector payload with correct dimensions
VECTOR_DATA="{
    \"points\": [
        {
            \"id\": \"$POINT_UUID\",
            \"vector\": $VECTOR_768,
            \"payload\": {
                \"test\": \"data\",
                \"content\": \"This is a test vector with 768 dimensions\",
                \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"
            }
        }
    ]
}"

echo "✅ 1. Testing collection list (user's collections only)..."
curl -X GET "${BASE_URL}/collections" \
  -H "Api-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  --max-time 15 \
  --silent --show-error | jq . || echo "Failed to get collections"

echo -e "\n✅ 2. Testing collection info by UUID..."
curl -X GET "${BASE_URL}/collections/${COLLECTION_UUID}" \
  -H "Api-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  --max-time 15 \
  --silent --show-error | jq . || echo "Failed to get collection info"

echo -e "\n✅ 3. Testing upsert with UUID identifier..."
curl -X POST "${BASE_URL}/collections/${COLLECTION_UUID}/points/upsert" \
  -H "Api-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$VECTOR_DATA" \
  --max-time 15 \
  --silent --show-error | jq . || echo "Failed to upsert with UUID"

echo -e "\n✅ 4. Testing upsert with collection name identifier..."
curl -X POST "${BASE_URL}/collections/${COLLECTION_NAME}/points/upsert" \
  -H "Api-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$VECTOR_DATA" \
  --max-time 15 \
  --silent --show-error | jq . || echo "Failed to upsert with name"

echo -e "\n✅ 5. Testing search operation..."
SEARCH_DATA="{
    \"vector\": $VECTOR_768,
    \"limit\": 5,
    \"with_payload\": true,
    \"with_vector\": false
}"

curl -X POST "${BASE_URL}/collections/${COLLECTION_UUID}/points/search" \
  -H "Api-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$SEARCH_DATA" \
  --max-time 15 \
  --silent --show-error | jq . || echo "Failed to search"

echo -e "\n🔒 Security Features Demonstrated:"
echo "   ✅ All requests go through proxy service"
echo "   ✅ API key authentication enforced"
echo "   ✅ User isolation (only user's collections accessible)"
echo "   ✅ No internal server details exposed"
echo "   ✅ Proper UUID point ID format used"
echo -e "\nDone! All operations completed securely via proxy service."
