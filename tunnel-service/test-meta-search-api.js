#!/usr/bin/env node

// Test script to verify Meta Search API endpoint works
const axios = require('axios');

async function testMetaSearchAPI() {
    console.log('Testing Meta Search API endpoint...');
    
    try {
        // Test the collections endpoint first
        const collectionsResponse = await axios.get('http://localhost:5000/api/qdrant/collections', {
            headers: {
                'Authorization': 'Bearer your-jwt-token' // This would need a real token
            }
        });
        
        console.log('Collections found:', collectionsResponse.data.length);
        
        if (collectionsResponse.data.length > 0) {
            const collection = collectionsResponse.data[0];
            console.log('Testing with collection:', collection.name);
            
            // Test meta search
            const searchResponse = await axios.post('http://localhost:5000/api/meta-search/search', {
                query: 'test',
                collections: [collection._id],
                maxResults: 5,
                scoreThreshold: 0.5
            }, {
                headers: {
                    'Authorization': 'Bearer your-jwt-token',
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('✅ Meta search API test successful!');
            console.log('Results:', searchResponse.data);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

testMetaSearchAPI().catch(console.error);
