#!/bin/bash

# Test direct connection to Qdrant instance
echo "Testing direct connection to Qdrant instance..."

# Production Qdrant instance
QDRANT_URL="http://10.0.0.2:6333"
QDRANT_API_KEY="str0mda0"

# Collection name from the logs
COLLECTION_NAME="user-6870454575345400dd8dbc3b-test-collection"

# Generate 768-dimension vector (required by the collection)
VECTOR_768=$(python3 -c "import json; print(json.dumps([0.1] * 768))")

# Create a valid vector payload with correct dimensions
VECTOR_DATA="{
    \"points\": [
        {
            \"id\": \"test-point-1\",
            \"vector\": $VECTOR_768,
            \"payload\": {
                \"test\": \"data\",
                \"content\": \"This is a test vector with 768 dimensions\"
            }
        }
    ]
}"

echo "1. Testing collection info..."
curl -X GET "${QDRANT_URL}/collections/${COLLECTION_NAME}" \
  -H "Api-Key: ${QDRANT_API_KEY}" \
  -H "Content-Type: application/json" \
  -v

echo -e "\n\n2. Testing upsert with PUT method (what the logs show)..."
curl -X PUT "${QDRANT_URL}/collections/${COLLECTION_NAME}/points?wait=true" \
  -H "Api-Key: ${QDRANT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$VECTOR_DATA" \
  -v

echo -e "\n\n3. Testing upsert with POST method (alternative)..."
curl -X POST "${QDRANT_URL}/collections/${COLLECTION_NAME}/points/upsert?wait=true" \
  -H "Api-Key: ${QDRANT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$VECTOR_DATA" \
  -v

echo -e "\n\n4. Testing with batch structure..."
BATCH_DATA="{
    \"batch\": {
        \"ids\": [\"test-point-1\"],
        \"vectors\": [$VECTOR_768],
        \"payloads\": [{
            \"test\": \"data\",
            \"content\": \"This is a test vector with 768 dimensions\"
        }]
    }
}"

curl -X PUT "${QDRANT_URL}/collections/${COLLECTION_NAME}/points?wait=true" \
  -H "Api-Key: ${QDRANT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$BATCH_DATA" \
  -v

echo -e "\n\nDone!"
