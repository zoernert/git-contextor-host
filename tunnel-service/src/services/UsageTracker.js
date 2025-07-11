const Usage = require('../models/Usage');
const User = require('../models/User');

// Usage monitoring service
class UsageTracker {
  async trackData(tunnel, dataAmount) {
    if (!tunnel || !tunnel.userId) return;

    try {
        // This is a simplified implementation. In a real-world scenario, you'd likely
        // batch updates to avoid hitting the database on every small data packet.
        
        // Update total usage on the User model
        await User.findByIdAndUpdate(tunnel.userId, {
            $inc: { 'usage.dataTransferred': dataAmount }
        });

        // Optionally, create a detailed usage record
        await Usage.create({
            userId: tunnel.userId,
            tunnelId: tunnel._id,
            dataTransferred: dataAmount
        });
    } catch (err) {
        console.error(`Error tracking usage for tunnel ${tunnel._id}:`, err.message);
    }
  }
}

module.exports = new UsageTracker();
