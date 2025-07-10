const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const plansConfig = require('../config/plans');

// Dummy plan data. In a real app, this would come from Stripe.
const plans = Object.keys(plansConfig).map(key => ({
    id: key,
    name: plansConfig[key].name,
    price: plansConfig[key].price,
    features: plansConfig[key].features
}));

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

// @route   POST /api/subscriptions/change
// @desc    Change user's subscription plan
// @access  Private
router.post('/change', auth, async (req, res) => {
    const { planId } = req.body;
    if (!plansConfig[planId]) {
        return res.status(400).json({ msg: 'Invalid plan ID' });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        user.plan = planId;
        await user.save();
        res.json({ plan: user.plan });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
