const db = require('../models');

/**
 * Middleware to enforce customer-level data isolation
 * Customers can only access their own data
 */
const enforceCustomerAccess = (req, res, next) => {
  if (req.user && req.user.role === 'customer' && req.user.customerId) {
    req.customerScope = req.user.customerId;
  }
  next();
};

/**
 * Middleware to enforce factory-level data isolation
 * Factories can only access their own data
 */
const enforceFactoryAccess = (req, res, next) => {
  if (req.user && req.user.role === 'factory' && req.user.factoryId) {
    req.factoryScope = req.user.factoryId;
  }
  next();
};

/**
 * Generic resource ownership check
 * Verifies that the resource being accessed belongs to the user making the request
 *
 * @param {string} model - Sequelize model to query
 * @param {string} ownerField - Field that contains the owner reference (e.g., 'customerId', 'factoryId')
 * @param {string} resourceIdParam - URL parameter name for resource ID (default: 'id')
 * @returns {Function} Express middleware
 */
const checkResourceOwnership = (model, ownerField, resourceIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      // Admin and manager roles bypass ownership checks
      if (req.user.role === 'admin' || req.user.role === 'manager') {
        return next();
      }

      const resourceId = req.params[resourceIdParam];
      if (!resourceId) {
        return res.status(400).json({ error: 'Resource ID not provided' });
      }

      // Determine the scope based on user role
      let scopeField = null;
      let scopeValue = null;

      if (req.user.role === 'customer' && req.user.customerId) {
        scopeField = 'customerId';
        scopeValue = req.user.customerId;
      } else if (req.user.role === 'factory' && req.user.factoryId) {
        scopeField = 'factoryId';
        scopeValue = req.user.factoryId;
      } else {
        // For other roles, allow access
        return next();
      }

      // Query the resource with the ownership check
      const resource = await model.findOne({
        where: {
          id: resourceId,
          [scopeField]: scopeValue,
        },
      });

      if (!resource) {
        return res.status(403).json({
          error: 'Access denied. You do not have permission to access this resource.',
        });
      }

      // Attach the resource to the request for later use
      req.resource = resource;
      next();
    } catch (error) {
      console.error('Resource ownership check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Middleware to filter list queries based on user scope
 * Customers see only their own orders/invoices/etc
 * Factories see only their own POs
 */
const applyScopeFilter = (scopeField) => {
  return (req, res, next) => {
    try {
      // Admin and manager see everything
      if (req.user.role === 'admin' || req.user.role === 'manager') {
        return next();
      }

      // Determine the scope value
      let scopeValue = null;

      if (req.user.role === 'customer' && req.user.customerId) {
        scopeValue = req.user.customerId;
      } else if (req.user.role === 'factory' && req.user.factoryId) {
        scopeValue = req.user.factoryId;
      }

      // If scope is determined, apply it to the query
      if (scopeValue) {
        req.query = req.query || {};
        req.query[scopeField] = scopeValue;
        req.scopeApplied = true;
      }

      next();
    } catch (error) {
      console.error('Scope filter error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Middleware to exclude sensitive customer data from factory-visible data
 * Used in purchase orders and similar endpoints
 */
const excludeCustomerData = (req, res, next) => {
  try {
    // Only apply to factory and warehouse roles
    if (req.user && (req.user.role === 'factory' || req.user.role === 'warehouse')) {
      req.excludeCustomerData = true;
    }
    next();
  } catch (error) {
    console.error('Exclude customer data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  enforceCustomerAccess,
  enforceFactoryAccess,
  checkResourceOwnership,
  applyScopeFilter,
  excludeCustomerData,
};
