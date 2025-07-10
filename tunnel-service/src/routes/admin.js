const express = require('express');
const router = express.Router();
const User = require('../models/User');

// @desc    Admin interface API routes

// @route   GET /api/admin/users
// @desc    List all users
// @access  Private/Admin
router.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET /api/admin/analytics - stub
router.get('/analytics', (req, res) => {
    res.json({
        users: 0,
        subscriptions: { active: 0, churn: 0 },
        tunnels: { active: 0 },
        revenue: { monthly: 0 }
    });
});

module.exports = router;
