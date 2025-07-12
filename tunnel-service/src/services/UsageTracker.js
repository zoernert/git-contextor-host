const Usage = require('../models/Usage');
const User = require('../models/User');
const plansConfig = require('../config/plans');
const mongoose = require('mongoose');

class UsageTracker {
    /**
     * Checks if a user is allowed to transfer a certain amount of data.
     * This method also handles the monthly reset of the data usage counter.
     * @param {string} userId - The ID of the user.
     * @param {number} dataAmount - The amount of data in bytes to be transferred.
     * @returns {Promise<boolean>} - True if transfer is allowed, false otherwise.
     */
    async canTransfer(userId, dataAmount) {
        try {
            let user = await User.findById(userId);
            if (!user) return false;

            // Check if usage needs to be reset (monthly cycle)
            const now = new Date();
            const resetDate = new Date(user.usage.resetDate);
            const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

            if (now.getTime() - resetDate.getTime() > THIRTY_DAYS_MS) {
                user.usage.dataTransferred = 0;
                user.usage.resetDate = now;
                await user.save();
            }

            const userPlan = plansConfig[user.plan];
            if (!userPlan) return false; // Invalid plan
            if (userPlan.limits.maxDataTransfer === -1) return true; // Unlimited

            const limitInBytes = userPlan.limits.maxDataTransfer * 1024 * 1024 * 1024;
            
            return (user.usage.dataTransferred + dataAmount) <= limitInBytes;
        } catch (err) {
            console.error(`[UsageTracker] Error in canTransfer for user ${userId}:`, err.message);
            return false;
        }
    }

    /**
     * Tracks data usage for a given tunnel and user.
     * @param {object} tunnel - The tunnel object from the database.
     * @param {number} dataAmount - The amount of data in bytes that was transferred.
     */
    async trackData(tunnel, dataAmount) {
        if (!tunnel || !tunnel.userId || typeof dataAmount !== 'number' || dataAmount < 0) return;

        try {
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

    /**
     * Gets the current usage for a user from the Usage collection.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<number>} - The total data transferred in bytes.
     */
    async getCurrentUsage(userId) {
        try {
            const userObjectId = new mongoose.Types.ObjectId(userId);
            const result = await Usage.aggregate([
                { $match: { userId: userObjectId } },
                { $group: { _id: null, totalDataTransferred: { $sum: '$dataTransferred' } } }
            ]);
            
            return result.length > 0 ? result[0].totalDataTransferred : 0;
        } catch (err) {
            console.error(`Error getting current usage for user ${userId}:`, err.message);
            return 0;
        }
    }

    /**
     * Resets usage for a user by deleting all Usage records.
     * @param {string} userId - The ID of the user.
     */
    async resetUsage(userId) {
        try {
            const userObjectId = new mongoose.Types.ObjectId(userId);
            await Usage.deleteMany({ userId: userObjectId });
            
            // Also reset the user's usage counter
            await User.findByIdAndUpdate(userId, {
                'usage.dataTransferred': 0,
                'usage.resetDate': new Date()
            });
        } catch (err) {
            console.error(`Error resetting usage for user ${userId}:`, err.message);
        }
    }

    /**
     * Gets usage statistics for a user within a date range.
     * @param {string} userId - The ID of the user.
     * @param {Date} startDate - The start date for the period.
     * @param {Date} endDate - The end date for the period.
     * @returns {Promise<object>} - Object containing totalDataTransferred and totalRequests.
     */
    async getUsageStats(userId, startDate, endDate) {
        try {
            const userObjectId = new mongoose.Types.ObjectId(userId);
            const result = await Usage.aggregate([
                { 
                    $match: { 
                        userId: userObjectId,
                        createdAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalDataTransferred: { $sum: '$dataTransferred' },
                        totalRequests: { $sum: 1 }
                    }
                }
            ]);
            
            return result.length > 0 ? {
                totalDataTransferred: result[0].totalDataTransferred,
                totalRequests: result[0].totalRequests
            } : {
                totalDataTransferred: 0,
                totalRequests: 0
            };
        } catch (err) {
            console.error(`Error getting usage stats for user ${userId}:`, err.message);
            return {
                totalDataTransferred: 0,
                totalRequests: 0
            };
        }
    }
}

module.exports = new UsageTracker();
