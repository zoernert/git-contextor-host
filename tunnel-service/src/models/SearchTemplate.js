const mongoose = require('mongoose');

const SearchTemplateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: String,
  collections: [{
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QdrantCollection' },
    tunnelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tunnel' },
    weight: { type: Number, default: 1.0 }, // Collection importance weight
    enabled: { type: Boolean, default: true }
  }],
  searchConfig: {
    maxResults: { type: Number, default: 50 },
    scoreThreshold: { type: Number, default: 0.7 },
    maxTokens: { type: Number, default: 4000 },
    includeMetadata: { type: Boolean, default: true }
  },
  createdAt: { type: Date, default: Date.now },
  lastUsed: { type: Date, default: Date.now }
});

// Index for efficient queries
SearchTemplateSchema.index({ userId: 1, name: 1 });

module.exports = mongoose.model('SearchTemplate', SearchTemplateSchema);
