const User = require('../models/User');

module.exports = async function (req, res, next) {
    try {
        // req.user.id is set from auth middleware
        const user = await User.findById(req.user.id);

        // Check if user has admin role OR if their email matches ADMIN_EMAIL
        const isAdmin = user && (
            user.role === 'admin' || 
            (process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL)
        );

        if (isAdmin) {
            next();
        } else {
            res.status(403).json({ msg: 'Access denied. Admin role required.' });
        }
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};
