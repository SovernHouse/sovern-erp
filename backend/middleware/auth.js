const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth');

const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, authConfig.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Phase 4.9.4: non-throwing variant that attaches req.user when a
// valid bearer token is present but does NOT 401 when absent or
// invalid. Mounted globally BEFORE the rate limiter so authenticated
// traffic can be identified and routed through the per-user limiter
// instead of the IP bucket. Routes that need to enforce auth still
// chain requireAuth as their own gate.
const attachUserIfPresent = (req, _res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next();
  try {
    req.user = jwt.verify(token, authConfig.jwt.secret);
  } catch (_) {
    // Silently ignore. The downstream requireAuth will 401 if the
    // route requires auth. Invalid tokens here just mean the request
    // is treated as anonymous for the rate-limiter bucket.
  }
  next();
};

// super_admin is founder/CEO level and is treated as a strict superset of
// admin: any route that accepts 'admin' implicitly accepts 'super_admin' too.
const SUPER_ADMIN = 'super_admin';

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role === SUPER_ADMIN) return next();

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
};

const requireAny = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role === SUPER_ADMIN) return next();

    const rolePermissions = authConfig.rolePermissions[req.user.role] || [];
    const hasPermission = rolePermissions.includes('*') || permissions.some(p => rolePermissions.includes(p));

    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
};

module.exports = {
  requireAuth,
  attachUserIfPresent,
  requireRole,
  requireAny
};
