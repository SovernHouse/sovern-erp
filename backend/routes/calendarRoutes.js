/**
 * calendarRoutes.js
 *
 * REST API for CalendarEvent data synced from Google Calendar.
 * All routes are authenticated. Read-only — mutations happen via Google Calendar,
 * not directly here.
 */

const express = require('express');
const router  = express.Router();
const { Op }  = require('sequelize');
const db      = require('../models');
const { requireAuth } = require('../middleware/auth');
const { getSuccessResponse } = require('../utils/helpers');

// ─── GET /calendar/events ─────────────────────────────────────────────────────
// List upcoming events for the authenticated user's connected Google account(s).
// Query params: start, end, limit (default 50), leadId
router.get('/events', requireAuth, async (req, res, next) => {
  try {
    const {
      start  = new Date().toISOString(),
      end,
      limit  = 50,
      leadId,
    } = req.query;

    // Find accounts connected by this user
    const accounts = await db.ConnectedGoogleAccount.findAll({
      where: { connectedByUserId: req.user.id, isActive: true },
      attributes: ['id'],
    });
    const accountIds = accounts.map(a => a.id);

    if (!accountIds.length) {
      return res.json(getSuccessResponse([]));
    }

    const where = {
      connectedAccountId: { [Op.in]: accountIds },
      status: { [Op.ne]: 'cancelled' },
    };

    // Time window filter
    const startDate = new Date(start);
    where[Op.or] = [
      { startAt:   { [Op.gte]: startDate } },
      { startDate: { [Op.gte]: startDate.toISOString().slice(0, 10) } },
    ];
    if (end) {
      const endDate = new Date(end);
      where[Op.and] = [
        {
          [Op.or]: [
            { endAt:   { [Op.lte]: endDate } },
            { endDate: { [Op.lte]: endDate.toISOString().slice(0, 10) } },
          ],
        },
      ];
    }

    if (leadId) {
      where.linkedLeadId = leadId;
    }

    const events = await db.CalendarEvent.findAll({
      where,
      order: [
        ['start_at', 'ASC NULLS LAST'],
        ['start_date', 'ASC NULLS LAST'],
      ],
      limit: Math.min(parseInt(limit, 10) || 50, 200),
    });

    res.json(getSuccessResponse(events));
  } catch (error) {
    next(error);
  }
});

// ─── GET /calendar/events/:id ─────────────────────────────────────────────────
router.get('/events/:id', requireAuth, async (req, res, next) => {
  try {
    const accounts = await db.ConnectedGoogleAccount.findAll({
      where: { connectedByUserId: req.user.id, isActive: true },
      attributes: ['id'],
    });
    const accountIds = accounts.map(a => a.id);

    const event = await db.CalendarEvent.findOne({
      where: {
        id: req.params.id,
        connectedAccountId: { [Op.in]: accountIds },
      },
      include: [{ model: db.Lead, as: 'linkedLead', attributes: ['id', 'companyName', 'contactName'] }],
    });

    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(getSuccessResponse(event));
  } catch (error) {
    next(error);
  }
});

// ─── PATCH /calendar/events/:id/link-lead ─────────────────────────────────────
// Manually link a calendar event to a CRM lead.
router.patch('/events/:id/link-lead', requireAuth, async (req, res, next) => {
  try {
    const { leadId } = req.body;

    const accounts = await db.ConnectedGoogleAccount.findAll({
      where: { connectedByUserId: req.user.id, isActive: true },
      attributes: ['id'],
    });
    const accountIds = accounts.map(a => a.id);

    const event = await db.CalendarEvent.findOne({
      where: { id: req.params.id, connectedAccountId: { [Op.in]: accountIds } },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    await event.update({ linkedLeadId: leadId || null });
    res.json(getSuccessResponse(event, 'Lead linked successfully'));
  } catch (error) {
    next(error);
  }
});

// ─── GET /calendar/today ──────────────────────────────────────────────────────
// Convenience endpoint: today's events (used by dashboard widget / CRM sidebar)
router.get('/today', requireAuth, async (req, res, next) => {
  try {
    const accounts = await db.ConnectedGoogleAccount.findAll({
      where: { connectedByUserId: req.user.id, isActive: true },
      attributes: ['id'],
    });
    const accountIds = accounts.map(a => a.id);

    if (!accountIds.length) return res.json(getSuccessResponse([]));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todayStr = todayStart.toISOString().slice(0, 10);

    const events = await db.CalendarEvent.findAll({
      where: {
        connectedAccountId: { [Op.in]: accountIds },
        status: { [Op.ne]: 'cancelled' },
        [Op.or]: [
          { startAt: { [Op.between]: [todayStart, todayEnd] } },
          { startDate: todayStr },
        ],
      },
      order: [['start_at', 'ASC NULLS LAST']],
      limit: 20,
    });

    res.json(getSuccessResponse(events));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
