#!/usr/bin/env node

/**
 * Migration script to add UUIDs to existing QdrantCollection records
 * This ensures backward compatibility with existing collections
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Load environment variables
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tunnel-service', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const QdrantCollection = require('./src/models/QdrantCollection');

async function migrateCollections() {
    try {
        console.log('Starting collection UUID migration...');
        
        // Find all collections without UUIDs
        const collectionsWithoutUuid = await QdrantCollection.find({
            $or: [
                { uuid: { $exists: false } },
                { uuid: null },
                { uuid: '' }
            ]
        });
        
        console.log(`Found ${collectionsWithoutUuid.length} collections without UUIDs`);
        
        // Update each collection with a UUID
        for (const collection of collectionsWithoutUuid) {
            const newUuid = uuidv4();
            await QdrantCollection.findByIdAndUpdate(collection._id, {
                uuid: newUuid
            });
            console.log(`Updated collection ${collection.name} (${collection._id}) with UUID: ${newUuid}`);
        }
        
        console.log('Migration completed successfully!');
        
        // Verify migration
        const totalCollections = await QdrantCollection.countDocuments();
        const collectionsWithUuid = await QdrantCollection.countDocuments({
            uuid: { $exists: true, $ne: null, $ne: '' }
        });
        
        console.log(`Total collections: ${totalCollections}`);
        console.log(`Collections with UUIDs: ${collectionsWithUuid}`);
        
        if (totalCollections === collectionsWithUuid) {
            console.log('✅ All collections now have UUIDs!');
        } else {
            console.log('❌ Some collections still missing UUIDs');
        }
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
    }
}

// Run migration
migrateCollections();
