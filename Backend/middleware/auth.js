const jwt = require('jsonwebtoken');
require('dotenv').config(); // Ensure env variables are loaded

module.exports = function(req, res, next) {
  // Get token from header (standard: 'x-auth-token')
  const token = req.header('x-auth-token');

  // Check if no token
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // Verify token
  try {
    // Verify token using the secret from environment variables
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Attach user payload (contains id) to request object for use in protected routes
    // Ensure your JWT payload includes { user: { id: userId } } when signing
    if (!decoded.user || !decoded.user.id) {
        console.error('JWT payload missing user.id');
        return res.status(401).json({ msg: 'Token payload invalid' });
    }
    req.user = decoded.user;
    next(); // Proceed to the next middleware or route handler
  } catch (err) {
    console.error('Token verification failed:', err.message);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};