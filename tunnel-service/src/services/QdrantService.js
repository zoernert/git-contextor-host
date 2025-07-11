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

    async createCollection(collectionName) {
        if (this.mock) {
            console.log(`[QdrantService MOCK] Creating collection ${collectionName}`);
            return true;
        }
        try {
            await this.client.createCollection(collectionName, {
                vectors: {
                    size: 1536, // Default for OpenAI text-embedding-ada-002
                    distance: 'Cosine',
                },
            });
            console.log(`[QdrantService] Collection ${collectionName} created.`);
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
}

module.exports = new QdrantService();
