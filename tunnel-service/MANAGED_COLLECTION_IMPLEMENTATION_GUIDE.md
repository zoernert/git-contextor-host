# Managed Collection Implementation Guide

## 🚀 Getting Started with Managed Collections

### Overview
Managed Collections provide a secure, scalable way to use Qdrant vector databases through our proxy service. All operations are authenticated, user-isolated, and optimized for performance.

### Key Benefits
- ✅ **Security**: No direct database access, full user isolation
- ✅ **Scalability**: Optimized for large datasets with on-disk storage
- ✅ **Simplicity**: RESTful API, no complex database management
- ✅ **Performance**: Optimized configurations for vector operations

## 🔐 Authentication Setup

### 1. Obtain API Key
```javascript
// Your API key is provided by the tunnel service
const API_KEY = 'your-tunnel-service-api-key';
const BASE_URL = 'https://tunnel.corrently.cloud/api/qdrant';

// Set up headers for all requests
const headers = {
    'Api-Key': API_KEY,
    'Content-Type': 'application/json'
};
```

### 2. Alternative Authentication Methods
```javascript
// Option 1: Api-Key header (recommended)
const headers = {
    'Api-Key': 'your-api-key',
    'Content-Type': 'application/json'
};

// Option 2: Authorization Bearer token
const headers = {
    'Authorization': 'Bearer your-api-key',
    'Content-Type': 'application/json'
};
```

## 📋 Collection Management

### 1. List Your Collections
```javascript
const listCollections = async () => {
    try {
        const response = await fetch(`${BASE_URL}/collections`, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const collections = await response.json();
        console.log('Your collections:', collections);
        return collections;
    } catch (error) {
        console.error('Error listing collections:', error);
        throw error;
    }
};
```

### 2. Get Collection Information
```javascript
const getCollectionInfo = async (collectionId) => {
    try {
        const response = await fetch(`${BASE_URL}/collections/${collectionId}`, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const collectionInfo = await response.json();
        console.log('Collection info:', collectionInfo);
        return collectionInfo;
    } catch (error) {
        console.error('Error getting collection info:', error);
        throw error;
    }
};
```

### 3. Collection Identifiers
You can access collections using three different identifiers:

```javascript
// 1. UUID (recommended - stable identifier)
const collectionUUID = '550e8400-e29b-41d4-a716-446655440000';

// 2. Collection name
const collectionName = 'my-documents';

// 3. MongoDB ObjectId (legacy support)
const objectId = '507f1f77bcf86cd799439011';

// All of these work:
await getCollectionInfo(collectionUUID);
await getCollectionInfo(collectionName);
await getCollectionInfo(objectId);
```

## 🔄 Vector Operations

### 1. Upsert Vectors (Add/Update)
```javascript
const upsertVectors = async (collectionId, vectors) => {
    try {
        const upsertData = {
            points: vectors.map(vector => ({
                id: generateUUID(), // IMPORTANT: Use UUID or integer IDs
                vector: vector.embedding,
                payload: {
                    content: vector.content,
                    metadata: vector.metadata
                }
            }))
        };

        const response = await fetch(`${BASE_URL}/collections/${collectionId}/points/upsert`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(upsertData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Upsert result:', result);
        return result;
    } catch (error) {
        console.error('Error upserting vectors:', error);
        throw error;
    }
};

// Helper function to generate UUID
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};
```

### 2. Search Vectors
```javascript
const searchVectors = async (collectionId, queryVector, options = {}) => {
    try {
        const searchData = {
            vector: queryVector,
            limit: options.limit || 10,
            with_payload: options.with_payload !== false,
            with_vector: options.with_vector || false,
            score_threshold: options.score_threshold || 0.0,
            // Optional: Add filters
            filter: options.filter
        };

        const response = await fetch(`${BASE_URL}/collections/${collectionId}/points/search`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(searchData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const results = await response.json();
        console.log('Search results:', results);
        return results;
    } catch (error) {
        console.error('Error searching vectors:', error);
        throw error;
    }
};
```

### 3. Search with Filters
```javascript
const searchWithFilter = async (collectionId, queryVector, filters) => {
    const searchOptions = {
        limit: 20,
        with_payload: true,
        filter: {
            must: [
                {
                    key: 'category',
                    match: { value: 'documentation' }
                },
                {
                    key: 'language',
                    match: { value: 'en' }
                }
            ]
        }
    };

    return await searchVectors(collectionId, queryVector, searchOptions);
};
```

## 📊 Best Practices

### 1. Payload Size Optimization
```javascript
// ✅ Good: Keep payloads under 10KB for optimal performance
const optimizePayload = (data) => {
    return {
        // Essential content only
        content: data.content.substring(0, 5000), // Limit content size
        
        // Structured metadata
        meta: {
            title: data.title,
            type: data.type,
            created: data.timestamp
        },
        
        // Search-optimized fields
        search: {
            category: data.category,
            tags: data.tags.slice(0, 5) // Limit array sizes
        }
    };
};
```

### 2. Chunking Strategy for Large Content
```javascript
const chunkLargeContent = (content, metadata, chunkSize = 8192) => {
    const chunks = [];
    const words = content.split(' ');
    let currentChunk = '';
    let chunkIndex = 0;

    for (const word of words) {
        if ((currentChunk + word).length > chunkSize) {
            if (currentChunk.trim()) {
                chunks.push({
                    content: currentChunk.trim(),
                    chunk_index: chunkIndex++,
                    metadata: {
                        ...metadata,
                        chunk_info: {
                            index: chunkIndex - 1,
                            total_chunks: -1 // Will be updated later
                        }
                    }
                });
            }
            currentChunk = word + ' ';
        } else {
            currentChunk += word + ' ';
        }
    }

    // Add final chunk
    if (currentChunk.trim()) {
        chunks.push({
            content: currentChunk.trim(),
            chunk_index: chunkIndex++,
            metadata: {
                ...metadata,
                chunk_info: {
                    index: chunkIndex - 1,
                    total_chunks: -1
                }
            }
        });
    }

    // Update total_chunks for all chunks
    chunks.forEach(chunk => {
        chunk.metadata.chunk_info.total_chunks = chunks.length;
    });

    return chunks;
};
```

### 3. Error Handling
```javascript
const robustVectorOperation = async (operation) => {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            if (error.message.includes('401') || error.message.includes('403')) {
                // Authentication error - don't retry
                throw error;
            }
            
            if (error.message.includes('404')) {
                // Collection not found - don't retry
                throw error;
            }
            
            if (attempt < maxRetries) {
                // Exponential backoff
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
};
```

## 🔧 Integration Examples

### 1. Document Indexing System
```javascript
class DocumentIndexer {
    constructor(apiKey, collectionId) {
        this.apiKey = apiKey;
        this.collectionId = collectionId;
        this.baseUrl = 'https://tunnel.corrently.cloud/api/qdrant';
        this.headers = {
            'Api-Key': apiKey,
            'Content-Type': 'application/json'
        };
    }

    async indexDocument(document) {
        try {
            // Generate embedding (you'll need your own embedding service)
            const embedding = await this.generateEmbedding(document.content);
            
            // Optimize payload size
            const payload = {
                content: document.content.substring(0, 5000),
                title: document.title,
                metadata: {
                    author: document.author,
                    created_at: document.created_at,
                    category: document.category,
                    tags: document.tags
                }
            };

            const upsertData = {
                points: [{
                    id: generateUUID(),
                    vector: embedding,
                    payload: payload
                }]
            };

            const response = await fetch(`${this.baseUrl}/collections/${this.collectionId}/points/upsert`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(upsertData)
            });

            return await response.json();
        } catch (error) {
            console.error('Error indexing document:', error);
            throw error;
        }
    }

    async searchDocuments(query, limit = 10) {
        try {
            const queryEmbedding = await this.generateEmbedding(query);
            
            const searchData = {
                vector: queryEmbedding,
                limit: limit,
                with_payload: true,
                with_vector: false
            };

            const response = await fetch(`${this.baseUrl}/collections/${this.collectionId}/points/search`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(searchData)
            });

            return await response.json();
        } catch (error) {
            console.error('Error searching documents:', error);
            throw error;
        }
    }

    async generateEmbedding(text) {
        // Implement your embedding generation logic here
        // This could be OpenAI, Hugging Face, or other embedding services
        throw new Error('Implement embedding generation');
    }
}
```

### 2. Semantic Search Implementation
```javascript
class SemanticSearch {
    constructor(apiKey, collectionId) {
        this.indexer = new DocumentIndexer(apiKey, collectionId);
    }

    async search(query, filters = {}) {
        try {
            const results = await this.indexer.searchDocuments(query, 20);
            
            // Post-process results
            const processedResults = results.result?.map(hit => ({
                id: hit.id,
                score: hit.score,
                title: hit.payload?.title,
                content: hit.payload?.content,
                metadata: hit.payload?.metadata
            })) || [];

            // Apply additional filters if needed
            if (filters.category) {
                return processedResults.filter(r => 
                    r.metadata?.category === filters.category
                );
            }

            return processedResults;
        } catch (error) {
            console.error('Error in semantic search:', error);
            throw error;
        }
    }
}
```

## 🧪 Testing and Validation

### 1. Test Collection Access
```javascript
const testCollectionAccess = async () => {
    try {
        console.log('Testing collection access...');
        
        // List collections
        const collections = await listCollections();
        console.log(`Found ${collections.length} collections`);
        
        if (collections.length > 0) {
            const collectionId = collections[0].uuid;
            
            // Get collection info
            const info = await getCollectionInfo(collectionId);
            console.log('Collection info retrieved successfully');
            
            // Test vector operations
            const testVector = new Array(info.config.vectorSize).fill(0.1);
            const testData = {
                points: [{
                    id: generateUUID(),
                    vector: testVector,
                    payload: { test: 'data' }
                }]
            };
            
            const upsertResult = await upsertVectors(collectionId, [testData.points[0]]);
            console.log('Test vector upserted successfully');
            
            const searchResult = await searchVectors(collectionId, testVector, { limit: 1 });
            console.log('Test search completed successfully');
        }
        
        console.log('✅ All tests passed!');
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
};
```

### 2. Performance Testing
```javascript
const performanceTest = async (collectionId) => {
    const startTime = Date.now();
    
    try {
        // Test batch upsert
        const batchSize = 100;
        const testVectors = Array.from({ length: batchSize }, (_, i) => ({
            id: generateUUID(),
            vector: new Array(768).fill(Math.random()),
            payload: { test_batch: i }
        }));
        
        console.log(`Upserting ${batchSize} vectors...`);
        const upsertStart = Date.now();
        await upsertVectors(collectionId, testVectors);
        const upsertTime = Date.now() - upsertStart;
        
        // Test search performance
        console.log('Testing search performance...');
        const searchStart = Date.now();
        const searchResults = await searchVectors(collectionId, testVectors[0].vector, { limit: 10 });
        const searchTime = Date.now() - searchStart;
        
        console.log(`Performance Results:
        - Upsert ${batchSize} vectors: ${upsertTime}ms
        - Search query: ${searchTime}ms
        - Total test time: ${Date.now() - startTime}ms`);
        
        return {
            upsertTime,
            searchTime,
            totalTime: Date.now() - startTime
        };
    } catch (error) {
        console.error('Performance test failed:', error);
        throw error;
    }
};
```

## 📚 Common Use Cases

### 1. Document Search System
```javascript
// For searching through documents, articles, or knowledge bases
const documentSearch = {
    indexDocument: async (document) => {
        const chunks = chunkLargeContent(document.content, document.metadata);
        const vectors = await Promise.all(chunks.map(async (chunk) => ({
            id: generateUUID(),
            vector: await generateEmbedding(chunk.content),
            payload: {
                content: chunk.content,
                document_id: document.id,
                chunk_index: chunk.chunk_index,
                metadata: chunk.metadata
            }
        })));
        
        return await upsertVectors(collectionId, vectors);
    },
    
    searchDocuments: async (query) => {
        const queryVector = await generateEmbedding(query);
        return await searchVectors(collectionId, queryVector, {
            limit: 20,
            with_payload: true
        });
    }
};
```

### 2. Product Recommendation System
```javascript
// For e-commerce or content recommendation
const productRecommendation = {
    indexProduct: async (product) => {
        const productDescription = `${product.title} ${product.description} ${product.category}`;
        const embedding = await generateEmbedding(productDescription);
        
        const vector = {
            id: generateUUID(),
            vector: embedding,
            payload: {
                product_id: product.id,
                title: product.title,
                category: product.category,
                price: product.price,
                tags: product.tags
            }
        };
        
        return await upsertVectors(collectionId, [vector]);
    },
    
    findSimilarProducts: async (productId, limit = 10) => {
        // First, find the product vector
        const productVector = await getProductVector(productId);
        
        // Search for similar products
        const results = await searchVectors(collectionId, productVector, {
            limit: limit + 1, // +1 to exclude the original product
            with_payload: true,
            filter: {
                must_not: [
                    { key: 'product_id', match: { value: productId } }
                ]
            }
        });
        
        return results.result?.slice(0, limit);
    }
};
```

## 🔗 Additional Resources

### API Endpoints Reference
```
Base URL: https://tunnel.corrently.cloud/api/qdrant

GET    /collections              - List your collections
GET    /collections/{id}         - Get collection information
POST   /collections/{id}/points/upsert  - Add/update vectors
POST   /collections/{id}/points/search  - Search vectors
DELETE /collections/{id}/points  - Delete vectors
```

### Configuration Files
- `QDRANT_PAYLOAD_SIZE_GUIDE.md` - Payload optimization guidelines
- `SECURE_CLIENT_INTEGRATION_GUIDE.md` - Security and authentication
- `PAYLOAD_SIZE_RESOLUTION_SUMMARY.md` - Payload size issue resolution
- `CLIENT_ERROR_TROUBLESHOOTING_GUIDE.md` - Common client errors and fixes

### Support
For technical support or questions:
1. Check the documentation files
2. Test with the provided examples
3. Review the troubleshooting guide for common errors
4. Contact the development team with specific error messages

---

## 🎯 Quick Start Checklist

- [ ] Obtain API key from tunnel service
- [ ] Set up authentication headers
- [ ] List your collections to verify access
- [ ] Test basic vector operations (upsert, search)
- [ ] Implement error handling
- [ ] Optimize payload sizes for your use case
- [ ] Set up monitoring and logging
- [ ] Deploy to production

**🚀 You're ready to build with Managed Collections!**
