const mongoose = require('mongoose');

const QdrantCollectionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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

// Qdrant API URL virtual
QdrantCollectionSchema.virtual('apiUrl').get(function() {
    const baseUrl = process.env.TUNNEL_BASE_URL || 'https://tunnel.corrently.cloud';
    return `${baseUrl}/api/qdrant/collections/${this._id}`;
});

// Index for efficient queries
QdrantCollectionSchema.index({ userId: 1, isActive: 1 });
QdrantCollectionSchema.index({ collectionName: 1 });

module.exports = mongoose.model('QdrantCollection', QdrantCollectionSchema);
