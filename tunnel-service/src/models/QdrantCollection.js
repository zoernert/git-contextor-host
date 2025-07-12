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
  tunnelInfo: {
    tunnelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tunnel' },
    connectionId: String,
    tunnelPath: String,
    url: String,
    apiKey: String,
    lastTunnelUpdate: { type: Date, default: Date.now }
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Index for efficient queries
QdrantCollectionSchema.index({ userId: 1, isActive: 1 });
QdrantCollectionSchema.index({ collectionName: 1 });

module.exports = mongoose.model('QdrantCollection', QdrantCollectionSchema);
