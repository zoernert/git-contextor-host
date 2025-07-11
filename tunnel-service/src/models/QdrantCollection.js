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
    storageUsed: { type: Number, default: 0 }
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('QdrantCollection', QdrantCollectionSchema);
