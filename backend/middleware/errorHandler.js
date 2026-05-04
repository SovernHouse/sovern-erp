class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = []) {
    super(message, 400);
    this.details = details;
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
  }
}

const errorHandler = (err, req, res, next) => {
  // If a response has already been sent (e.g. controller succeeded and
  // a downstream timeout/middleware later called next(err)), do NOT try
  // to send a second one. Express's default handler will swallow it.
  // This was the source of repeated 'Cannot set headers after they are
  // sent to the client' fatals in Sentry.
  if (res.headersSent) {
    return next(err);
  }

  err.statusCode = err.statusCode || 500;
  err.message = err.message || 'Internal Server Error';

  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = Object.keys(err.fields)[0];
    err.statusCode = 409;
    err.message = `${field} must be unique`;
  }

  if (err.name === 'SequelizeValidationError') {
    err.statusCode = 400;
    err.message = err.errors.map(e => e.message).join(', ');
  }

  if (err.name === 'JsonWebTokenError') {
    err.statusCode = 401;
    err.message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    err.statusCode = 401;
    err.message = 'Token expired';
  }

  // Structured error object — message + statusCode always present
  const errorObj = {
    message: err.message,
    statusCode: err.statusCode
  };

  // Include validation details inside the error object
  if (err.details) {
    errorObj.details = err.details;
  }

  // In non-production environments expose the stack for debugging
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    errorObj.stack = err.stack;
  }

  const response = {
    success: false,
    error: errorObj
  };

  res.status(err.statusCode).json(response);
};

module.exports = {
  errorHandler,
  AppError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ConflictError
};
