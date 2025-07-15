#!/bin/bash

# SECURE Qdrant Test Script - Proxy Service Access Only
# This demonstrates the ONLY approved way to access Qdrant: via our proxy service

echo "🔒 Testing SECURE vector upsert operation via proxy..."

# Production environment values - ONLY proxy service endpoint
COLLECTION_UUID="ca9536d1-3d21-475a-aa4e-c108a676e101"
COLLECTION_NAME="test-collection"
API_KEY="b6403676-186a-4d2b-8983-545b27e6c99e"
BASE_URL="https://tunnel.corrently.cloud/api/qdrant"

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
                \"content\": \"This is a test vector with 768 dimensions\"
            }
        }
    ],
    \"wait\": true
}"

echo "Testing upsert with UUID identifier..."
curl -X POST "${BASE_URL}/collections/${COLLECTION_UUID}/points/upsert" \
  -H "Api-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$VECTOR_DATA" \
  --max-time 15

echo -e "\n\nTesting upsert with collection name identifier..."
curl -X POST "${BASE_URL}/collections/${COLLECTION_NAME}/points/upsert" \
  -H "Api-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$VECTOR_DATA" \
  --max-time 15

echo -e "\n\n🔒 Security: All operations via proxy service (tunnel.corrently.cloud)"
echo -e "Done!"
