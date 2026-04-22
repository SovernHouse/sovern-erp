const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../models');
const authConfig = require('../config/auth');
const { getSuccessResponse } = require('../utils/helpers');
const { NotFoundError, AuthenticationError, ValidationError } = require('../middleware/errorHandler');

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    authConfig.jwt.secret,
    { expiresIn: authConfig.jwt.expiry }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    authConfig.jwtRefresh.secret,
    { expiresIn: authConfig.jwtRefresh.expiry }
  );

  return { accessToken, refreshToken };
};

const register = async (req, res, next) => {
  try {
    // FIX BUG 2: Do not accept role from request body - always default to customer
    const { email, password, firstName, lastName, phone } = req.body;

    const existingUser = await db.User.findOne({ where: { email } });
    if (existingUser) {
      throw new ValidationError('Email already registered');
    }

    const user = await db.User.create({
      id: uuidv4(),
      email,
      password,
      firstName,
      lastName,
      phone,
      role: authConfig.roles.CUSTOMER,
      isActive: true
    });

    const { accessToken, refreshToken } = generateTokens(user);

    res.status(201).json(getSuccessResponse({
      user: user.toJSON(),
      tokens: { accessToken, refreshToken }
    }, 'User registered successfully'));
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await db.User.findOne({ where: { email } });
    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new AuthenticationError('Account is inactive');
    }

    await user.update({ lastLogin: new Date() });

    const { accessToken, refreshToken } = generateTokens(user);

    res.json(getSuccessResponse({
      user: user.toJSON(),
      tokens: { accessToken, refreshToken }
    }, 'Login successful'));
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await db.User.findOne({ where: { email } });
    if (!user) {
      return res.json(getSuccessResponse(null, 'If an account exists, a reset link has been sent'));
    }

    // FIX BUG 3: Use crypto.randomBytes for strong token generation
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await user.update({ resetToken: hashedToken, resetExpiry });

    res.json(getSuccessResponse(null, 'Password reset link sent to your email'));
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    // FIX BUG 3: Hash the incoming token and compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await db.User.findOne({
      where: { resetToken: hashedToken }
    });

    if (!user) {
      throw new NotFoundError('Invalid or expired reset token');
    }

    if (new Date() > user.resetExpiry) {
      throw new NotFoundError('Reset token has expired');
    }

    await user.update({
      password: newPassword,
      resetToken: null,
      resetExpiry: null
    });

    res.json(getSuccessResponse(null, 'Password reset successfully'));
  } catch (error) {
    next(error);
  }
};

const getCurrentUser = async (req, res, next) => {
  try {
    const user = await db.User.findByPk(req.user.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json(getSuccessResponse(user.toJSON()));
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, avatar, preferences } = req.body;
    const user = await db.User.findByPk(req.user.id);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    await user.update({
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      phone: phone || user.phone,
      avatar: avatar || user.avatar,
      preferences: preferences || user.preferences
    });

    res.json(getSuccessResponse(user.toJSON(), 'Profile updated successfully'));
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await db.User.findByPk(req.user.id);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    await user.update({ password: newPassword });

    res.json(getSuccessResponse(null, 'Password changed successfully'));
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    // In a stateless JWT setup, logout is handled client-side by removing tokens
    // Server-side we could blacklist the token if needed in future
    res.json(getSuccessResponse(null, 'Logged out successfully'));
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      throw new AuthenticationError('Refresh token is required');
    }

    const decoded = jwt.verify(token, authConfig.jwtRefresh.secret);
    const user = await db.User.findByPk(decoded.id);

    if (!user || !user.isActive) {
      throw new AuthenticationError('Invalid refresh token');
    }

    const tokens = generateTokens(user);

    res.json(getSuccessResponse({
      user: user.toJSON(),
      tokens
    }, 'Token refreshed successfully'));
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AuthenticationError('Invalid or expired refresh token'));
    }
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  updateProfile,
  changePassword
};
