#!/bin/bash

# Client Request Validation Test Script
echo "🔍 Testing Client Request Validation..."

BASE_URL="https://tunnel.corrently.cloud/api/qdrant"
COLLECTION_UUID="8e852a29-7c3a-47bb-9c65-74083c0a3175"
API_KEY="b6403676-186a-4d2b-8983-545b27e6c99e"

echo "📋 Testing different request scenarios..."

# Test 1: Valid request with UUID point ID
echo -e "\n✅ Test 1: Valid request with UUID point ID"
VALID_UUID=$(python3 -c "import uuid; print(str(uuid.uuid4()))")
VECTOR_768=$(python3 -c "import json; print(json.dumps([0.1] * 768))")

VALID_REQUEST="{
    \"points\": [
        {
            \"id\": \"$VALID_UUID\",
            \"vector\": $VECTOR_768,
            \"payload\": {
                \"content\": \"Test content\",
                \"test_type\": \"valid_uuid\"
            }
        }
    ]
}"

curl -X POST "${BASE_URL}/collections/${COLLECTION_UUID}/points/upsert" \
  -H "Api-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$VALID_REQUEST" \
  --max-time 15 \
  --silent | jq . || echo "Valid UUID request failed"

# Test 2: Valid request with integer point ID
echo -e "\n✅ Test 2: Valid request with integer point ID"
VALID_INTEGER=$((RANDOM + 1000))

VALID_INT_REQUEST="{
    \"points\": [
        {
            \"id\": $VALID_INTEGER,
            \"vector\": $VECTOR_768,
            \"payload\": {
                \"content\": \"Test content\",
                \"test_type\": \"valid_integer\"
            }
        }
    ]
}"

curl -X POST "${BASE_URL}/collections/${COLLECTION_UUID}/points/upsert" \
  -H "Api-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$VALID_INT_REQUEST" \
  --max-time 15 \
  --silent | jq . || echo "Valid integer request failed"

# Test 3: Invalid request - missing points array
echo -e "\n❌ Test 3: Invalid request - missing points array"
INVALID_REQUEST1="{
    \"data\": \"invalid\"
}"

curl -X POST "${BASE_URL}/collections/${COLLECTION_UUID}/points/upsert" \
  -H "Api-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$INVALID_REQUEST1" \
  --max-time 15 \
  --silent | jq . || echo "Expected failure: missing points array"

# Test 4: Invalid request - empty points array
echo -e "\n❌ Test 4: Invalid request - empty points array"
INVALID_REQUEST2="{
    \"points\": []
}"

curl -X POST "${BASE_URL}/collections/${COLLECTION_UUID}/points/upsert" \
  -H "Api-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$INVALID_REQUEST2" \
  --max-time 15 \
  --silent | jq . || echo "Expected failure: empty points array"

# Test 5: Invalid request - string point ID (not UUID)
echo -e "\n❌ Test 5: Invalid request - string point ID (not UUID)"
INVALID_REQUEST3="{
    \"points\": [
        {
            \"id\": \"invalid-string-id\",
            \"vector\": $VECTOR_768,
            \"payload\": {
                \"content\": \"Test content\"
            }
        }
    ]
}"

curl -X POST "${BASE_URL}/collections/${COLLECTION_UUID}/points/upsert" \
  -H "Api-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$INVALID_REQUEST3" \
  --max-time 15 \
  --silent | jq . || echo "Expected failure: invalid point ID format"

# Test 6: Invalid request - wrong vector dimensions
echo -e "\n❌ Test 6: Invalid request - wrong vector dimensions"
WRONG_VECTOR=$(python3 -c "import json; print(json.dumps([0.1] * 10))")  # Only 10 dimensions instead of 768
INVALID_UUID=$(python3 -c "import uuid; print(str(uuid.uuid4()))")

INVALID_REQUEST4="{
    \"points\": [
        {
            \"id\": \"$INVALID_UUID\",
            \"vector\": $WRONG_VECTOR,
            \"payload\": {
                \"content\": \"Test content\"
            }
        }
    ]
}"

curl -X POST "${BASE_URL}/collections/${COLLECTION_UUID}/points/upsert" \
  -H "Api-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$INVALID_REQUEST4" \
  --max-time 15 \
  --silent | jq . || echo "Expected failure: wrong vector dimensions"

# Test 7: Invalid request - missing required fields
echo -e "\n❌ Test 7: Invalid request - missing required fields"
INVALID_REQUEST5="{
    \"points\": [
        {
            \"vector\": $VECTOR_768,
            \"payload\": {
                \"content\": \"Test content\"
            }
        }
    ]
}"

curl -X POST "${BASE_URL}/collections/${COLLECTION_UUID}/points/upsert" \
  -H "Api-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$INVALID_REQUEST5" \
  --max-time 15 \
  --silent | jq . || echo "Expected failure: missing id field"

echo -e "\n📊 Test Summary:"
echo "✅ Valid UUID point ID: Should succeed"
echo "✅ Valid integer point ID: Should succeed"
echo "❌ Missing points array: Should fail"
echo "❌ Empty points array: Should fail"
echo "❌ Invalid point ID format: Should fail"
echo "❌ Wrong vector dimensions: Should fail"
echo "❌ Missing required fields: Should fail"
echo ""
echo "📚 For more details, see CLIENT_ERROR_TROUBLESHOOTING_GUIDE.md"
echo "🔧 Use these examples to validate your client implementation"
