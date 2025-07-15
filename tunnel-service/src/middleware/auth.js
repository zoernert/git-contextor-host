const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function (req, res, next) {
  // Check for API Key first (for client integrations like Git Contextor)
  const authHeader = req.header('Authorization');
  const apiKeyHeader = req.header('Api-Key');
  
  let apiKey = null;
  
  // Check Authorization: Bearer format
  if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7, authHeader.length);
  }
  // Check Api-Key header format  
  else if (apiKeyHeader) {
      apiKey = apiKeyHeader;
  }
  
  if (apiKey) {
      try {
          const user = await User.findOne({ apiKey });
          if (!user) {
              return res.status(401).json({ msg: 'Invalid API Key' });
          }
          if (!user.isActive) {
              return res.status(403).json({ msg: 'User account is inactive' });
          }
          req.user = { id: user.id }; // Set user context for subsequent middleware/routes
          return next();
      } catch (err) {
          console.error(err.message);
          return res.status(500).send('Server Error');
      }
  }

  // Fallback to JWT for UI sessions
  const token = req.header('x-auth-token');
  if (!token) {
      return res.status(401).json({ msg: 'No token or API Key, authorization denied' });
  }

  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded.user;
      next();
  } catch (err) {
      res.status(401).json({ msg: 'Token is not valid' });
  }
};
