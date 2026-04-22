const express = require('express');
const router = express.Router();
const db = require('../models');
const { requireAuth } = require('../middleware/auth');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const notificationService = require('../services/notificationService');

// GET specific routes FIRST (before /:id routes)
router.get('/unread-count', requireAuth, async (req, res, next) => {
  try {
    const unreadCount = await notificationService.getUnreadCount(req.user.id);
    res.json(getSuccessResponse({ unreadCount }));
  } catch (error) {
    next(error);
  }
});

// PATCH all notifications to read
router.patch('/all/mark-read', requireAuth, async (req, res, next) => {
  try {
    await notificationService.markAllNotificationsAsRead(req.user.id);
    res.json(getSuccessResponse(null, 'All notifications marked as read'));
  } catch (error) {
    next(error);
  }
});

// GET list of notifications
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const { offset } = getPagination(page, limit);

    const where = { userId: req.user.id };
    if (unreadOnly === 'true') where.isRead = false;

    const { count, rows } = await db.Notification.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
});

// PATCH single notification to read (after /all/mark-read to avoid conflict)
router.patch('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const notification = await notificationService.markNotificationAsRead(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(getSuccessResponse(notification, 'Notification marked as read'));
  } catch (error) {
    next(error);
  }
});

// DELETE notification
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const notification = await db.Notification.findByPk(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await notification.destroy();
    res.json(getSuccessResponse(null, 'Notification deleted'));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
