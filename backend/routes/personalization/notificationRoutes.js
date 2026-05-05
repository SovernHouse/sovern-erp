const express = require('express');
const router = express.Router();
const db = require('../../models');
const { requireAuth } = require('../../middleware/auth');
const { getSuccessResponse } = require('../../utils/helpers');

router.get('/notification-preferences/:userId', requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Users can only access their own preferences, unless admin
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Unauthorized', statusCode: 403 }
      });
    }

    let prefs = await db.NotificationPreference.findOne({
      where: { userId }
    });

    if (!prefs) {
      prefs = await db.NotificationPreference.create({ userId });
    }

    // Don't expose unsubscribe token to client
    const data = prefs.toJSON();
    delete data.unsubscribeToken;

    res.json(getSuccessResponse(data));
  } catch (error) {
    next(error);
  }
});

/**
 * Update user's notification preferences
 * @route PUT /api/personalization/notification-preferences/:userId
 * @body {Object} preferences - Notification preferences
 * @body {String} digestFrequency - Digest frequency
 * @body {String} digestTime - Digest time
 */
router.put('/notification-preferences/:userId', requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { preferences, digestFrequency, digestTime } = req.body;

    // Users can only update their own preferences, unless admin
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Unauthorized', statusCode: 403 }
      });
    }

    let prefs = await db.NotificationPreference.findOne({
      where: { userId }
    });

    if (!prefs) {
      prefs = await db.NotificationPreference.create({
        userId,
        preferences: preferences || {},
        digestFrequency: digestFrequency || 'real-time',
        digestTime
      });
    } else {
      await prefs.update({
        preferences: preferences || prefs.preferences,
        digestFrequency: digestFrequency || prefs.digestFrequency,
        digestTime: digestTime || prefs.digestTime
      });
    }

    const data = prefs.toJSON();
    delete data.unsubscribeToken;

    res.json(getSuccessResponse({
      message: 'Notification preferences updated successfully',
      data
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get commission rules
 * @route GET /api/personalization/commissions/rules
 */

module.exports = router;
