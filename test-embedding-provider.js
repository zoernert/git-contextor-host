#!/usr/bin/env node

// Test script to check embedding provider configuration
const EmbeddingProvider = require('./tunnel-service/src/services/EmbeddingProvider');

async function testEmbeddingProvider() {
    console.log('Testing Embedding Provider...');
    
    const provider = new EmbeddingProvider();
    console.log('Provider:', provider.provider);
    console.log('Gemini API Key:', provider.geminiApiKey ? 'Set' : 'Not set');
    console.log('OpenAI API Key:', provider.openaiApiKey ? 'Set' : 'Not set');
    
    try {
        console.log('Testing embedding generation with text "test"...');
        const embedding = await provider.generateEmbedding('test');
        console.log('✅ Success! Embedding generated with', embedding.length, 'dimensions');
        console.log('First 5 values:', embedding.slice(0, 5));
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testEmbeddingProvider().catch(console.error);
