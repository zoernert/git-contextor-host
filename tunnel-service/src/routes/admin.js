const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Tunnel = require('../models/Tunnel');
const StripeService = require('../services/StripeService');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// @desc    Admin interface API routes

// @route   GET /api/admin/users
// @desc    List all users
// @access  Private/Admin
router.get('/users', [auth, admin], async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/admin/users/:id
// @desc    Get user by ID
// @access  Private/Admin
router.get('/users/:id', [auth, admin], async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/admin/users/:id
// @desc    Update a user
// @access  Private/Admin
router.put('/users/:id', [auth, admin], async (req, res) => {
    const { plan, isActive } = req.body;

    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        if (plan) user.plan = plan;
        if (typeof isActive === 'boolean') user.isActive = isActive;

        await user.save();
        const updatedUser = await User.findById(req.params.id).select('-password');
        res.json(updatedUser);
    } catch (err) {
        console.error(err.message);
        // Check if it's a validation error
        if (err.name === 'ValidationError') {
            return res.status(400).json({ msg: 'Invalid input data' });
        }
        res.status(500).send('Server Error');
    }
});

// GET /api/admin/analytics
router.get('/analytics', [auth, admin], async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const activeTunnels = await Tunnel.countDocuments({ isActive: true });
        const totalTunnels = await Tunnel.countDocuments();
        const activeSubscriptions = await User.countDocuments({ plan: { $ne: 'free' } });
        const monthlyRevenue = await StripeService.calculateMRR();

        // Get plan distribution
        const planDistribution = await User.aggregate([
            { $group: { _id: '$plan', count: { $sum: 1 } } },
            { $project: { plan: '$_id', count: 1, _id: 0 } }
        ]);

        const plans = {};
        planDistribution.forEach(item => {
            plans[item.plan] = item.count;
        });

        res.json({
            users: userCount,
            subscriptions: { active: activeSubscriptions, churn: 0 },
            tunnels: { active: activeTunnels, total: totalTunnels },
            revenue: { monthly: monthlyRevenue },
            plans: plans
        });
    } catch (err) {
        console.error('Error fetching analytics:', err.message);
        res.status(500).json({ msg: 'Server error while fetching analytics' });
    }
});

// @route   GET /api/admin/tunnels
// @desc    List all active tunnels
// @access  Private/Admin
router.get('/tunnels', [auth, admin], async (req, res) => {
    try {
        const tunnels = await Tunnel.find({ isActive: true }).populate('userId', 'email plan');
        res.json(tunnels);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
