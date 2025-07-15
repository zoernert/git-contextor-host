const axios = require('axios');

// Test configuration
const BASE_URL = 'http://10.0.0.14:5000';
const API_KEY = 'gch-test-key-6870454575345400dd8dbc3b';

// Test helper function
async function testEndpoint(name, config) {
    console.log(`\n=== ${name} ===`);
    try {
        const response = await axios(config);
        console.log('✅ Success:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error) {
        console.log('❌ Error:', error.response?.status, error.response?.statusText);
        console.log('Error details:', error.response?.data || error.message);
        return null;
    }
}

async function runTests() {
    console.log('Testing Vector Operations with Fixed Proxy Middleware');
    console.log('======================================================');

    // Test 1: Test collection info via proxy
    await testEndpoint('Collection Info via Proxy', {
        method: 'GET',
        url: `${BASE_URL}/api/qdrant/collections/test-collection/info`,
        headers: {
            'Api-Key': API_KEY
        }
    });

    // Test 2: Test vector upsert operation
    await testEndpoint('Vector Upsert Operation', {
        method: 'POST',
        url: `${BASE_URL}/api/qdrant/collections/test-collection/points/upsert`,
        headers: {
            'Api-Key': API_KEY,
            'Content-Type': 'application/json'
        },
        data: {
            wait: true,
            points: [
                {
                    id: 'test-point-1',
                    vector: [0.1, 0.2, 0.3, 0.4, 0.5],
                    payload: {
                        text: 'Test document 1',
                        category: 'test'
                    }
                },
                {
                    id: 'test-point-2',
                    vector: [0.2, 0.3, 0.4, 0.5, 0.6],
                    payload: {
                        text: 'Test document 2',
                        category: 'test'
                    }
                }
            ]
        }
    });

    // Test 3: Test vector search operation
    await testEndpoint('Vector Search Operation', {
        method: 'POST',
        url: `${BASE_URL}/api/qdrant/collections/test-collection/points/search`,
        headers: {
            'Api-Key': API_KEY,
            'Content-Type': 'application/json'
        },
        data: {
            vector: [0.1, 0.2, 0.3, 0.4, 0.5],
            limit: 10,
            with_payload: true
        }
    });

    // Test 4: Test using UUID instead of name
    await testEndpoint('Vector Search with UUID', {
        method: 'POST',
        url: `${BASE_URL}/api/qdrant/collections/ca9536d1-3d21-475a-aa4e-c108a676e101/points/search`,
        headers: {
            'Api-Key': API_KEY,
            'Content-Type': 'application/json'
        },
        data: {
            vector: [0.2, 0.3, 0.4, 0.5, 0.6],
            limit: 5,
            with_payload: true
        }
    });

    console.log('\n======================================================');
    console.log('Test completed!');
}

runTests().catch(console.error);
