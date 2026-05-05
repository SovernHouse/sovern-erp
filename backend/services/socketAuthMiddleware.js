const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../config/auth');
const db = require('../models');
const logger = require('../utils/logger.js');

/**
 * Socket.IO authentication middleware
 * Validates JWT token from socket handshake auth
 * Attaches user data to socket and auto-joins user room
 */
const socketAuthMiddleware = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication token not provided'));
    }

    // Verify JWT token
    const decoded = jwt.verify(token, jwtConfig.secret);

    // Fetch user from database to get current data
    const user = await db.User.findByPk(decoded.id, {
      attributes: ['id', 'email', 'firstName', 'lastName', 'role']
    });

    if (!user) {
      return next(new Error('User not found'));
    }

    // Attach user data to socket
    socket.userId = user.id;
    socket.userEmail = user.email;
    socket.userRole = user.role;
    socket.userData = user;

    // Auto-join user to their room
    socket.join(`user-${user.id}`);

    // Join user to their role room for role-based broadcasts
    socket.join(`role-${user.role}`);

    logger.info(`Socket authenticated: ${socket.id} (User: ${user.id}, Role: ${user.role})`);

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new Error('Token expired'));
    }
    if (error.name === 'JsonWebTokenError') {
      return next(new Error('Invalid token'));
    }
    logger.error('Socket auth error:', error);
    next(new Error('Authentication failed'));
  }
};

/**
 * Handle socket disconnection and cleanup
 */
const handleSocketDisconnect = (socket) => {
  logger.info(`Socket disconnected: ${socket.id} (User: ${socket.userId})`);
  // Socket.IO automatically removes socket from all rooms
};

/**
 * Get authenticated user from socket
 */
const getSocketUser = (socket) => {
  if (!socket.userId) {
    return null;
  }
  return {
    id: socket.userId,
    email: socket.userEmail,
    role: socket.userRole,
    ...socket.userData
  };
};

module.exports = {
  socketAuthMiddleware,
  handleSocketDisconnect,
  getSocketUser
};
