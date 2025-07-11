const User = require('../models/User');
const Tunnel = require('../models/Tunnel');
const plansConfig = require('../config/plans');
const UsageTracker = require('../services/UsageTracker');

module.exports = async function(req, res, next) {
    try {
        const user = await User.findById(req.user.id);
        if (!user || !user.isActive) {
            return res.status(401).json({ msg: 'User not found or inactive.' });
        }

        const userPlan = plansConfig[user.plan];
        if (!userPlan) {
            return res.status(403).json({ msg: 'Invalid subscription plan.' });
        }
        
        // Check tunnel limit
        if (userPlan.limits.maxTunnels !== -1) {
            const tunnelCount = await Tunnel.countDocuments({ userId: req.user.id, isActive: true });
            if (tunnelCount >= userPlan.limits.maxTunnels) {
                return res.status(403).json({ msg: `Tunnel limit of ${userPlan.limits.maxTunnels} reached for your '${user.plan}' plan.` });
            }
        }
        
        // Check if user is already over their data transfer limit before creating a new tunnel
        const canStillTransfer = await UsageTracker.canTransfer(req.user.id, 0);
        if (!canStillTransfer) {
            return res.status(403).json({ msg: `Your monthly data transfer limit has been reached. Please upgrade your plan or wait for the next billing cycle.` });
        }
        
        next();
    } catch (err) {
        console.error('Subscription middleware error:', err.message);
        res.status(500).send('Server error in subscription middleware.');
    }
};
