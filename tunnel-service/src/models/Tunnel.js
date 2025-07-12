const mongoose = require('mongoose');

const TunnelSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subdomain: { type: String, required: true, unique: true }, // Keep for backward compatibility
  tunnelPath: { type: String, required: true, unique: true }, // New path-based identifier
  localPort: { type: Number, required: true },
  targetHost: { type: String, default: 'localhost' },
  isActive: { type: Boolean, default: true },
  protocol: { type: String, enum: ['http', 'https'], default: 'https' },
  customDomain: { type: String, default: null },
  connectionId: { type: String, required: true },
  proxyHostId: { type: Number }, // from Nginx Proxy Manager
  description: { type: String, default: '' },
  metadata: {
    userAgent: String,
    clientIp: String,
    gitContextorShare: { type: Boolean, default: false },
    type: { type: String, enum: ['http', 'qdrant'], default: 'http' },
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QdrantCollection' },
    collectionName: String
  },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Path-based URL virtual
TunnelSchema.virtual('url').get(function() {
    const baseUrl = process.env.TUNNEL_BASE_URL || 'https://tunnel.corrently.cloud';
    return `${baseUrl}/tunnel/${this.tunnelPath}`;
});

// Legacy subdomain URL virtual (for backward compatibility)
TunnelSchema.virtual('subdomainUrl').get(function() {
    return `${this.protocol}://${this.subdomain}.${process.env.TUNNEL_DOMAIN || 'localhost.test'}`;
});

// Qdrant URL virtual
TunnelSchema.virtual('qdrantUrl').get(function() {
    const baseUrl = process.env.TUNNEL_BASE_URL || 'https://tunnel.corrently.cloud';
    return `${baseUrl}/qdrant/${this.tunnelPath}`;
});

// Add indexes for efficient queries
TunnelSchema.index({ userId: 1, isActive: 1 });
TunnelSchema.index({ 'metadata.type': 1 });
TunnelSchema.index({ 'metadata.collectionId': 1 });
TunnelSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Tunnel', TunnelSchema);
