const { QdrantClient } = require('@qdrant/js-client-rest');

class QdrantService {
    constructor() {
        if (!process.env.QDRANT_URL) {
            console.warn('[QdrantService] QDRANT_URL not set. Running in mock mode.');
            this.mock = true;
        } else {
            this.client = new QdrantClient({
                url: process.env.QDRANT_URL,
                apiKey: process.env.QDRANT_API_KEY,
            });
        }
    }

    async createCollection(collectionName, config = {}) {
        if (this.mock) {
            console.log(`[QdrantService MOCK] Creating collection ${collectionName}`);
            return true;
        }
        
        const defaultConfig = {
            vectors: {
                size: 1536, // Default for OpenAI text-embedding-ada-002
                distance: 'Cosine',
            },
        };

        const collectionConfig = { ...defaultConfig, ...config };

        try {
            await this.client.createCollection(collectionName, collectionConfig);
            console.log(`[QdrantService] Collection ${collectionName} created with config:`, collectionConfig);
            return true;
        } catch (error) {
            const errorMessage = error.response?.data?.status?.error || error.message;
            throw new Error(`Could not create Qdrant collection. Reason: ${errorMessage}`);
        }
    }
    
    async deleteCollection(collectionName) {
        if (this.mock) {
            console.log(`[QdrantService MOCK] Deleting collection ${collectionName}`);
            return true;
        }
        try {
            const result = await this.client.deleteCollection(collectionName);
            if (result) {
                console.log(`[QdrantService] Collection ${collectionName} deleted.`);
            }
            return result;
        } catch (error) {
            const errorMessage = error.response?.data?.status?.error || error.message;
            throw new Error(`Could not delete Qdrant collection. Reason: ${errorMessage}`);
        }
    }

    async getCollectionInfo(collectionName) {
        if (this.mock) {
            console.log(`[QdrantService MOCK] Getting collection info for ${collectionName}`);
            return {
                status: 'green',
                vectors_count: 0,
                config: {
                    params: {
                        vectors: {
                            size: 1536,
                            distance: 'Cosine'
                        }
                    }
                }
            };
        }
        try {
            return await this.client.getCollection(collectionName);
        } catch (error) {
            const errorMessage = error.response?.data?.status?.error || error.message;
            throw new Error(`Could not get Qdrant collection info. Reason: ${errorMessage}`);
        }
    }

    async listCollections() {
        if (this.mock) {
            console.log('[QdrantService MOCK] Listing collections');
            return { collections: [] };
        }
        try {
            return await this.client.getCollections();
        } catch (error) {
            const errorMessage = error.response?.data?.status?.error || error.message;
            throw new Error(`Could not list Qdrant collections. Reason: ${errorMessage}`);
        }
    }

    async updateCollection(collectionName, config) {
        if (this.mock) {
            console.log(`[QdrantService MOCK] Updating collection ${collectionName}`);
            return true;
        }
        try {
            await this.client.updateCollection(collectionName, config);
            console.log(`[QdrantService] Collection ${collectionName} updated.`);
            return true;
        } catch (error) {
            const errorMessage = error.response?.data?.status?.error || error.message;
            throw new Error(`Could not update Qdrant collection. Reason: ${errorMessage}`);
        }
    }
}

module.exports = new QdrantService();
