#!/bin/bash

# Test script for payload size handling
echo "🔍 Testing Payload Size Handling..."

BASE_URL="https://tunnel.corrently.cloud/api/qdrant"
COLLECTION_UUID="8e852a29-7c3a-47bb-9c65-74083c0a3175"
API_KEY="b6403676-186a-4d2b-8983-545b27e6c99e"

# Generate test content of different sizes
echo "📝 Testing different payload sizes..."

# 1. Small payload (< 1KB)
echo -e "\n✅ 1. Testing SMALL payload (< 1KB)..."
SMALL_CONTENT="This is a small test content for vector storage."
SMALL_UUID=$(python3 -c "import uuid; print(str(uuid.uuid4()))")
VECTOR_768=$(python3 -c "import json; print(json.dumps([0.1] * 768))")

SMALL_PAYLOAD="{
    \"points\": [
        {
            \"id\": \"$SMALL_UUID\",
            \"vector\": $VECTOR_768,
            \"payload\": {
                \"content\": \"$SMALL_CONTENT\",
                \"size\": \"small\",
                \"test_type\": \"payload_size_test\"
            }
        }
    ]
}"

curl -X POST "${BASE_URL}/collections/${COLLECTION_UUID}/points/upsert" \
  -H "Api-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$SMALL_PAYLOAD" \
  --max-time 15 \
  --silent | jq . || echo "Small payload test failed"

# 2. Medium payload (5KB)
echo -e "\n✅ 2. Testing MEDIUM payload (~5KB)..."
MEDIUM_CONTENT=$(python3 -c "print('This is a medium-sized test content for vector storage. ' * 100)")
MEDIUM_UUID=$(python3 -c "import uuid; print(str(uuid.uuid4()))")

MEDIUM_PAYLOAD="{
    \"points\": [
        {
            \"id\": \"$MEDIUM_UUID\",
            \"vector\": $VECTOR_768,
            \"payload\": {
                \"content\": \"$MEDIUM_CONTENT\",
                \"size\": \"medium\",
                \"test_type\": \"payload_size_test\",
                \"metadata\": {
                    \"title\": \"Medium Test Document\",
                    \"category\": \"testing\",
                    \"created_at\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\",
                    \"description\": \"Testing medium-sized payload handling\"
                }
            }
        }
    ]
}"

curl -X POST "${BASE_URL}/collections/${COLLECTION_UUID}/points/upsert" \
  -H "Api-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$MEDIUM_PAYLOAD" \
  --max-time 15 \
  --silent | jq . || echo "Medium payload test failed"

# 3. Large payload (20KB)
echo -e "\n⚠️ 3. Testing LARGE payload (~20KB)..."
LARGE_CONTENT=$(python3 -c "print('This is a large test content for vector storage that will be repeated many times to create a larger payload for testing purposes. ' * 200)")
LARGE_UUID=$(python3 -c "import uuid; print(str(uuid.uuid4()))")

LARGE_PAYLOAD="{
    \"points\": [
        {
            \"id\": \"$LARGE_UUID\",
            \"vector\": $VECTOR_768,
            \"payload\": {
                \"content\": \"$LARGE_CONTENT\",
                \"size\": \"large\",
                \"test_type\": \"payload_size_test\",
                \"metadata\": {
                    \"title\": \"Large Test Document\",
                    \"category\": \"testing\",
                    \"created_at\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\",
                    \"description\": \"Testing large payload handling with on-disk storage\",
                    \"tags\": [\"large\", \"test\", \"payload\", \"storage\"],
                    \"stats\": {
                        \"character_count\": $(echo -n "$LARGE_CONTENT" | wc -c),
                        \"word_count\": $(echo -n "$LARGE_CONTENT" | wc -w)
                    }
                }
            }
        }
    ]
}"

curl -X POST "${BASE_URL}/collections/${COLLECTION_UUID}/points/upsert" \
  -H "Api-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$LARGE_PAYLOAD" \
  --max-time 30 \
  --silent | jq . || echo "Large payload test failed"

# 4. Test search with payload filtering
echo -e "\n🔍 4. Testing search with payload filtering..."
SEARCH_PAYLOAD="{
    \"vector\": $VECTOR_768,
    \"limit\": 10,
    \"with_payload\": true,
    \"with_vector\": false,
    \"filter\": {
        \"must\": [
            {
                \"key\": \"test_type\",
                \"match\": {
                    \"value\": \"payload_size_test\"
                }
            }
        ]
    }
}"

curl -X POST "${BASE_URL}/collections/${COLLECTION_UUID}/points/search" \
  -H "Api-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$SEARCH_PAYLOAD" \
  --max-time 15 \
  --silent | jq '.result | length' || echo "Search test failed"

echo -e "\n📊 Payload Size Test Results:"
echo "   ✅ Small payload (< 1KB): Should work fast"
echo "   ✅ Medium payload (~5KB): Should work well"
echo "   ⚠️ Large payload (~20KB): May be slower but should work"
echo "   ✅ Search with filtering: Should return test results"
echo ""
echo "🔧 Configuration: Collections use on-disk storage for better large payload support"
echo "📚 See QDRANT_PAYLOAD_SIZE_GUIDE.md for best practices"
