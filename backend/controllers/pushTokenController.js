/**
 * Expo Push Token Controller
 *
 * Mobile app registers/unregisters the device's Expo push token here so
 * the backend can fire push notifications via exp.host. Used by the
 * dev-mode notifier; safe for any authenticated user to call.
 */

const db = require('../models');
const { ValidationError } = require('../middleware/errorHandler');
const logger = require('../utils/logger.js');

exports.registerToken = async (req, res) => {
  const { token, deviceId, platform } = req.body;

  if (!token || typeof token !== 'string') {
    throw new ValidationError('token is required');
  }
  if (platform && !['ios', 'android', 'web'].includes(platform)) {
    throw new ValidationError('platform must be ios, android, or web');
  }

  // Upsert by token: if the token already exists, re-attach to this user
  // and reactivate (handles device re-login as a different user).
  const existing = await db.ExpoPushToken.findOne({ where: { token } });
  if (existing) {
    await existing.update({
      userId: req.user.id,
      deviceId: deviceId || existing.deviceId,
      platform: platform || existing.platform,
      isActive: true,
      lastSeenAt: new Date(),
    });
    return res.json({ success: true, data: existing });
  }

  const created = await db.ExpoPushToken.create({
    userId: req.user.id,
    token,
    deviceId: deviceId || null,
    platform: platform || null,
    isActive: true,
    lastSeenAt: new Date(),
  });

  logger.info(`[push] Registered token for user ${req.user.id} (${platform || 'unknown'})`);
  return res.status(201).json({ success: true, data: created });
};

exports.unregisterToken = async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    throw new ValidationError('token is required');
  }

  const existing = await db.ExpoPushToken.findOne({ where: { token } });
  if (!existing) {
    return res.json({ success: true, message: 'Token not found (already gone).' });
  }
  await existing.update({ isActive: false });
  return res.json({ success: true, message: 'Token deactivated.' });
};

exports.listMyTokens = async (req, res) => {
  const tokens = await db.ExpoPushToken.findAll({
    where: { userId: req.user.id },
    order: [['lastSeenAt', 'DESC']],
    attributes: ['id', 'deviceId', 'platform', 'isActive', 'lastSeenAt', 'createdAt'],
  });
  return res.json({ success: true, data: tokens });
};
