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
  requireRole,
  requireAny
};
