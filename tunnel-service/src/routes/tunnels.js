const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const subscriptionCheck = require('../middleware/subscription');
const Tunnel = require('../models/Tunnel');
const Usage = require('../models/Usage');
const mongoose = require('mongoose');
const TunnelManager = require('../services/TunnelManager');
const { body, validationResult } = require('express-validator');

// @route   POST api/tunnels
// @desc    Create a tunnel
// @access  Private
router.post(
    '/',
    [
        auth,
        subscriptionCheck,
        body('localPort', 'Local port is required and must be a number').isInt({ min: 1, max: 65535 }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { localPort, subdomain, gitContextorShare } = req.body;
            const options = {
                requestedSubdomain: subdomain,
                metadata: {
                    clientIp: req.ip,
                    userAgent: req.get('User-Agent'),
                    gitContextorShare: !!gitContextorShare
                }
            };

            const tunnel = await TunnelManager.createTunnel(req.user.id, localPort, options);
            res.status(201).json(tunnel);
        } catch (error) {
            console.error('Error creating tunnel:', error.message);
            res.status(500).json({ msg: error.message || 'Server error while creating tunnel' });
        }
    }
);

// @route   GET api/tunnels
// @desc    Get user's tunnels
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const tunnels = await Tunnel.find({ userId: req.user.id, isActive: true });
        res.json(tunnels);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE api/tunnels/:id
// @desc    Destroy a tunnel
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const result = await TunnelManager.destroyTunnel(req.params.id, req.user.id);
        res.json(result);
    } catch (error) {
        console.error('Error destroying tunnel:', error.message);
        res.status(500).json({ msg: error.message || 'Server error while destroying tunnel' });
    }
});

// @route   GET api/tunnels/:id/stats
// @desc    Get tunnel statistics
// @access  Private
router.get('/:id/stats', auth, async (req, res) => {
    try {
        const tunnel = await Tunnel.findOne({ _id: req.params.id, userId: req.user.id });
        if (!tunnel) {
            return res.status(404).json({ msg: 'Tunnel not found or permission denied.' });
        }

        const stats = await Usage.aggregate([
            { $match: { tunnelId: new mongoose.Types.ObjectId(tunnel.id) } },
            { $group: {
                _id: '$tunnelId',
                totalDataTransferred: { $sum: '$dataTransferred' }
            }}
        ]);

        const totalData = stats.length > 0 ? stats[0].totalDataTransferred : 0;
        
        res.json({
            tunnelId: tunnel._id,
            totalDataTransferred: totalData, // in bytes
        });

    } catch (err) {
        console.error('Error fetching tunnel stats:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
