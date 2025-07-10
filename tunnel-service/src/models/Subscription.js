const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  stripeSubscriptionId: { type: String, required: true },
  status: { type: String, required: true },
  plan: { type: String, required: true },
  limits: {
    maxTunnels: { type: Number, required: true },
    maxDataTransfer: { type: Number, required: true }, // in GB
    maxQdrantCollections: { type: Number, default: 0 }
  },
  currentPeriodStart: { type: Date, required: true },
  currentPeriodEnd: { type: Date, required: true }
});

module.exports = mongoose.model('Subscription', SubscriptionSchema);
