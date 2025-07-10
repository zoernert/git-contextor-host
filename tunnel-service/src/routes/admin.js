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
