#!/usr/bin/env node

// Test script to check MetaSearchService search functionality
const mongoose = require('mongoose');
const MetaSearchService = require('./src/services/MetaSearchService');
const QdrantCollection = require('./src/models/QdrantCollection');

async function testMetaSearch() {
    console.log('Testing Meta Search Service...');
    
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://10.0.0.2:27017/tunnel-service');
        console.log('✅ Connected to MongoDB');
        
        // Get a managed collection
        const collection = await QdrantCollection.findOne({ isActive: true });
        if (!collection) {
            console.log('❌ No active collections found');
            return;
        }
        
        console.log('Found collection:', collection.name);
        console.log('Collection UUID:', collection.uuid);
        console.log('Collection URL:', collection.apiUrl);
        
        // Test the search
        const metaSearchService = new MetaSearchService();
        const userId = collection.userId;
        
        console.log('Testing search with query "test"...');
        const result = await metaSearchService.performMetaSearch(userId, 'test', {
            collections: [collection._id],
            maxResults: 5,
            scoreThreshold: 0.5
        });
        
        console.log('✅ Search completed!');
        console.log('Total results:', result.totalResults);
        console.log('Processed results:', result.processedResults);
        console.log('Token usage:', result.tokenUsage);
        
        if (result.results && result.results.length > 0) {
            console.log('First result:', {
                score: result.results[0].score,
                sourceCollection: result.results[0].sourceCollection,
                content: result.results[0].content.substring(0, 200) + '...'
            });
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        mongoose.connection.close();
    }
}

testMetaSearch().catch(console.error);
