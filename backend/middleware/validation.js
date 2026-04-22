const { validationResult, body, param, query } = require('express-validator');
const { ValidationError } = require('./errorHandler');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map(err => ({
      field: err.param,
      message: err.msg
    }));
    throw new ValidationError('Validation failed', details);
  }
  next();
};

const validateEmail = () => body('email').isEmail().normalizeEmail();

const validatePassword = () => body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters');

const validateUUID = (paramName) => param(paramName).isUUID().withMessage(`Invalid ${paramName}`);

const validatePagination = () => [
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100')
];

const validateDateRange = () => [
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date')
];

module.exports = {
  handleValidationErrors,
  validateEmail,
  validatePassword,
  validateUUID,
  validatePagination,
  validateDateRange,
  body,
  param,
  query
};
