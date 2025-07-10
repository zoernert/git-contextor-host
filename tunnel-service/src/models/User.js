const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  apiKey: { type: String, required: true, unique: true },
  stripeCustomerId: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  plan: { type: String, enum: ['free', 'basic', 'pro', 'enterprise'], default: 'free' },
  usage: {
    tunnelsUsed: { type: Number, default: 0 },
    dataTransferred: { type: Number, default: 0 },
    resetDate: { type: Date, default: Date.now }
  },
  gitContextorIntegration: {
    enabled: { type: Boolean, default: false },
    qdrantCollections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'QdrantCollection' }]
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
