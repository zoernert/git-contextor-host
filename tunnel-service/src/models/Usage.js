const mongoose = require('mongoose');

const UsageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tunnelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tunnel' },
  dataTransferred: { type: Number, required: true, default: 0 }, // in bytes
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Usage', UsageSchema);
