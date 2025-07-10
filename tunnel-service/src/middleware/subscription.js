const User = require('../models/User');
const Tunnel = require('../models/Tunnel');
const plans = require('../config/plans');

module.exports = async function(req, res, next) {
    try {
        const user = await User.findById(req.user.id);
        if (!user || !user.isActive) {
            return res.status(401).json({ msg: 'User not found or inactive.' });
        }

        const userPlan = plans[user.plan];
        if (!userPlan) {
            return res.status(403).json({ msg: 'Invalid subscription plan.' });
        }
        
        if (userPlan.limits.maxTunnels === -1) { // -1 means unlimited
            return next();
        }

        const tunnelCount = await Tunnel.countDocuments({ userId: req.user.id, isActive: true });
        if (tunnelCount >= userPlan.limits.maxTunnels) {
            return res.status(403).json({ msg: `Tunnel limit of ${userPlan.limits.maxTunnels} reached for your '${user.plan}' plan.` });
        }
        
        // TODO: check data transfer limits
        next();
    } catch (err) {
        console.error('Subscription middleware error:', err.message);
        res.status(500).send('Server error in subscription middleware.');
    }
};
