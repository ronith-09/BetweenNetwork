const AdminAuthService = require('../services/admin-auth.service');

function resolveAdminApiKey(req) {
  return (
    req.headers['x-betweennetwork-admin-key'] ||
    req.headers['x-admin-api-key'] ||
    null
  );
}

function resolveBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice(7).trim();
}

async function requireBetweenNetworkAdmin(req, res, next) {
  const bearerToken = resolveBearerToken(req);

  if (bearerToken) {
    try {
      const adminContext = await AdminAuthService.authenticateBearerToken(bearerToken);
      req.isAdmin = true;
      req.adminId = adminContext.adminId;
      req.adminContext = adminContext;
      return next();
    } catch (error) {
      return res.status(error.statusCode || 401).json({
        success: false,
        message: error.message || 'Unauthorized'
      });
    }
  }

  const expectedKey =
    process.env.BETWEENNETWORK_ADMIN_API_KEY || process.env.ADMIN_API_KEY;
  const providedKey = resolveAdminApiKey(req);

  if (!expectedKey || !providedKey || providedKey !== expectedKey) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: BetweenNetwork admin authorization required'
    });
  }

  const adminId =
    req.headers['x-betweennetwork-admin-id'] ||
    req.headers['x-admin-id'] ||
    'betweennetwork-admin';

  req.isAdmin = true;
  req.adminId = adminId;
  req.adminContext = {
    adminId,
    role: 'BETWEENNETWORK_ADMIN'
  };

  next();
}

module.exports = requireBetweenNetworkAdmin;
