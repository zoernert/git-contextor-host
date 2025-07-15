const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const QdrantCollectionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uuid: { type: String, default: uuidv4, unique: true, index: true }, // Stable UUID identifier
  name: { type: String, required: true },
  collectionName: { type: String, required: true },
  credentials: {
    host: String,
    port: Number,
    apiKey: String
  },
  usage: {
    vectorCount: { type: Number, default: 0 },
    storageUsed: { type: Number, default: 0 },
    lastAccessed: { type: Date, default: Date.now }
  },
  config: {
    vectorSize: { type: Number, default: 1536 },
    distance: { type: String, default: 'Cosine' },
    description: String
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Qdrant API URL virtual - uses stable UUID instead of ObjectId
QdrantCollectionSchema.virtual('apiUrl').get(function() {
    const baseUrl = process.env.TUNNEL_BASE_URL || 'https://tunnel.corrently.cloud';
    return `${baseUrl}/api/qdrant/collections/${this.uuid}`;
});

// Index for efficient queries
QdrantCollectionSchema.index({ userId: 1, isActive: 1 });
QdrantCollectionSchema.index({ collectionName: 1 });
QdrantCollectionSchema.index({ uuid: 1 });
QdrantCollectionSchema.index({ userId: 1, name: 1 });

// Pre-save hook to ensure UUID is set
QdrantCollectionSchema.pre('save', function(next) {
    if (!this.uuid) {
        this.uuid = uuidv4();
    }
    next();
});

// Helper function to find collection by UUID, name, or ObjectId
QdrantCollectionSchema.statics.findByIdentifier = function(identifier, userId, activeOnly = true) {
    const query = { userId };
    if (activeOnly) {
        query.isActive = true;
    }

    // Check if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(identifier)) {
        return this.findOne({ ...query, _id: identifier });
    }
    
    // Check if it's a UUID (36 characters with dashes)
    if (identifier.length === 36 && identifier.includes('-')) {
        return this.findOne({ ...query, uuid: identifier });
    }
    
    // Assume it's a collection name
    return this.findOne({ ...query, name: identifier });
};

module.exports = mongoose.model('QdrantCollection', QdrantCollectionSchema);
