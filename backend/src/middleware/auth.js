const requireBetweenNetworkAdmin = require('../admin/middleware/requireBetweenNetworkAdmin');

/**
 * Admin-only authorization middleware
 * Checks if the request is made by an authorized BetweenNetwork admin
 */
const adminAuthMiddleware = requireBetweenNetworkAdmin;

/**
 * Optional: JWT-based admin authorization
 */
const jwtAdminAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing or invalid Authorization header'
    });
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT token (simplified - implement proper JWT verification)
    const decoded = verifyJWT(token);
    
    if (!decoded.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Admin role required'
      });
    }

    req.adminId = decoded.userId;
    req.isAdmin = true;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid token'
    });
  }
};

/**
 * Error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message: message,
    ...(process.env.NODE_ENV === 'development' && {
      error: err instanceof Error
        ? err.stack || err.message
        : JSON.stringify(err)
    })
  });
};

/**
 * Request logging middleware
 */
const requestLoggerMiddleware = (req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
};

module.exports = {
  adminAuthMiddleware,
  jwtAdminAuthMiddleware,
  errorHandler,
  requestLoggerMiddleware
};
