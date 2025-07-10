const mongoose = require('mongoose');

const TunnelSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subdomain: { type: String, required: true, unique: true },
  localPort: { type: Number, required: true },
  targetHost: { type: String, default: 'localhost' },
  isActive: { type: Boolean, default: true },
  protocol: { type: String, enum: ['http', 'https'], default: 'https' },
  customDomain: { type: String, default: null },
  connectionId: { type: String, required: true },
  metadata: {
    userAgent: String,
    clientIp: String,
    gitContextorShare: { type: Boolean, default: false }
  },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
});

module.exports = mongoose.model('Tunnel', TunnelSchema);
