const mongoose = require('mongoose');

const SearchHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  query: { type: String, required: true },
  collections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'QdrantCollection' }],
  tunnels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tunnel' }],
  results: {
    totalResults: Number,
    processedResults: Number,
    finalTokenCount: Number,
    executionTime: Number
  },
  searchConfig: {
    maxResults: Number,
    scoreThreshold: Number,
    maxTokens: Number
  },
  createdAt: { type: Date, default: Date.now }
});

// Index for efficient queries
SearchHistorySchema.index({ userId: 1, createdAt: -1 });
SearchHistorySchema.index({ userId: 1, query: 1 });

module.exports = mongoose.model('SearchHistory', SearchHistorySchema);
