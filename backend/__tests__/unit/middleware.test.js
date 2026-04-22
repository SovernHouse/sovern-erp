// Set env vars before requiring auth config
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing-12345';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-key';

const jwt = require('jsonwebtoken');
const authConfig = require('../../config/auth');
const { requireAuth, requireRole, requireAny } = require('../../middleware/auth');
const { errorHandler, AppError, ValidationError, NotFoundError, AuthenticationError } = require('../../middleware/errorHandler');

describe('Auth Middleware', () => {
  describe('requireAuth', () => {
    let req, res, next;

    beforeEach(() => {
      req = { headers: {} };
      res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      next = jest.fn();
    });

    it('should return 401 when no token is provided', () => {
      requireAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    });

    it('should set req.user when valid token is provided', () => {
      // Use the actual secret from authConfig (loaded at require time)
      const token = jwt.sign(
        { id: 'user-123', email: 'test@example.com', role: 'admin' },
        authConfig.jwt.secret
      );
      req.headers.authorization = `Bearer ${token}`;

      requireAuth(req, res, next);
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user-123');
      expect(next).toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', () => {
      req.headers.authorization = 'Bearer invalid.token.here';
      requireAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    });
  });

  describe('requireRole', () => {
    let req, res, next;

    beforeEach(() => {
      req = { user: { id: 'user-123', role: 'admin' } };
      res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      next = jest.fn();
    });

    it('should call next when user has required role', () => {
      const middleware = requireRole('admin', 'sales');
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 403 when user lacks required role', () => {
      req.user.role = 'customer';
      const middleware = requireRole('admin', 'sales');
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });

    it('should return 401 when no user', () => {
      req.user = null;
      const middleware = requireRole('admin');
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireAny', () => {
    let req, res, next;

    beforeEach(() => {
      req = { user: { role: 'sales' } };
      res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      next = jest.fn();
    });

    it('should call next when user has permission', () => {
      const middleware = requireAny('inquiries', 'quotations');
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should call next for admin with wildcard permission', () => {
      req.user.role = 'admin';
      const middleware = requireAny('any_permission');
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 403 when user lacks all required permissions', () => {
      req.user.role = 'customer';
      const middleware = requireAny('admin_only_permission', 'sales');
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 401 when no user', () => {
      req.user = null;
      const middleware = requireAny('any_permission');
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});

describe('Error Handler Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('AppError', () => {
    it('should create error with message and status code', () => {
      const error = new AppError('Test error', 400);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with details', () => {
      const details = [{ field: 'email', message: 'Invalid email' }];
      const error = new ValidationError('Validation failed', details);
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual(details);
    });

    it('should use default message', () => {
      const error = new ValidationError();
      expect(error.message).toBe('Validation failed');
    });
  });

  describe('NotFoundError', () => {
    it('should create 404 error', () => {
      const error = new NotFoundError('User not found');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('User not found');
    });
  });

  describe('AuthenticationError', () => {
    it('should create 401 error', () => {
      const error = new AuthenticationError('Invalid credentials');
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Invalid credentials');
    });
  });

  describe('errorHandler middleware', () => {
    it('should handle generic errors', () => {
      const error = new Error('Test error');
      errorHandler(error, req, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Test error',
            statusCode: 500
          })
        })
      );
    });

    it('should handle AppError', () => {
      const error = new AppError('Custom error', 422);
      errorHandler(error, req, res, next);
      expect(res.status).toHaveBeenCalledWith(422);
    });

    it('should handle SequelizeUniqueConstraintError', () => {
      const error = new Error('Unique constraint violation');
      error.name = 'SequelizeUniqueConstraintError';
      error.fields = { email: true };
      errorHandler(error, req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('should handle SequelizeValidationError', () => {
      const error = new Error('Validation error');
      error.name = 'SequelizeValidationError';
      error.errors = [
        { message: 'Email is required' },
        { message: 'Password is required' }
      ];
      errorHandler(error, req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle JsonWebTokenError', () => {
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';
      errorHandler(error, req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Invalid token'
          })
        })
      );
    });

    it('should handle TokenExpiredError', () => {
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      errorHandler(error, req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Token expired'
          })
        })
      );
    });

    it('should include error details when present', () => {
      const details = [{ field: 'email', error: 'Invalid' }];
      const error = new ValidationError('Validation failed', details);
      errorHandler(error, req, res, next);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details
          })
        })
      );
    });

    it('should set default status code to 500', () => {
      const error = {};
      errorHandler(error, req, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
