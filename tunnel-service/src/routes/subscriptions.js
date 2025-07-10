const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// Dummy plan data. In a real app, this would come from Stripe.
const plans = [
    { id: 'free', name: 'Free', price: '$0/mo', features: ['1 Tunnel', '1 GB Bandwidth/mo', 'Community Support'] },
    { id: 'basic', name: 'Basic', price: '$5/mo', features: ['5 Tunnels', '10 GB Bandwidth/mo', 'Email Support'] },
    { id: 'pro', name: 'Pro', price: '$15/mo', features: ['Unlimited Tunnels', '50 GB Bandwidth/mo', 'Priority Support'] }
];

// @route   GET api/subscriptions/plans
// @desc    Get available subscription plans
// @access  Private
router.get('/plans', auth, (req, res) => {
    res.json(plans);
});

// @route   GET api/subscriptions/current
// @desc    Get user's current subscription
// @access  Private
router.get('/current', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        res.json({
            plan: user.plan,
            // more subscription details would go here
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
