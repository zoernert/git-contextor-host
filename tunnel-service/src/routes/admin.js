const express = require('express');
const router = express.Router();
const User = require('../models/User');
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
        res.status(500).send('Server Error');
    }
});

// GET /api/admin/analytics - stub
router.get('/analytics', [auth, admin], async (req, res) => {
    const userCount = await User.countDocuments();
    res.json({
        users: userCount,
        subscriptions: { active: 0, churn: 0 },
        tunnels: { active: 0 },
        revenue: { monthly: 0 }
    });
});

module.exports = router;
