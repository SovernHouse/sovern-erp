/**
 * Scheduled Activity Controller
 * Odoo-style mail.activity — tasks assigned to users, attached to ERP records.
 */
const { ScheduledActivity, User } = require('../models');
const { postSystemEvent } = require('./chatterController');
const { getSuccessResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

// ── Allowed entity types (whitelist — must match chatterController) ────────
const ALLOWED_ENTITY_TYPES = new Set([
  'Quotation', 'ProformaInvoice', 'SalesOrder', 'PurchaseOrder',
  'Lead', 'Customer', 'Factory', 'Inquiry', 'Invoice', 'Payment',
  'Shipment', 'Inspection', 'Claim', 'SampleRequest', 'LetterOfCredit',
]);

// ── Activity type labels (for chatter messages) ───────────────────────────
const TYPE_LABELS = {
  follow_up:      'Follow-up',
  check_document: 'Check Document',
  approve:        'Approve',
  send:           'Send',
  call:           'Call',
  meeting:        'Meeting',
  other:          'Task',
};

const userAttrs = ['id', 'firstName', 'lastName', 'email', 'role'];

/**
 * GET /api/scheduled-activities/my
 * Returns all pending activities assigned to the authenticated user,
 * sorted by dueDate ascending (most urgent first).
 */
exports.getMyActivities = async (req, res, next) => {
  try {
    const activities = await ScheduledActivity.findAll({
      where: { assignedToId: req.user.id, status: 'pending' },
      include: [
        { model: User, as: 'assignedBy', attributes: userAttrs },
      ],
      order: [['dueDate', 'ASC'], ['priority', 'DESC']],
    });
    res.json(getSuccessResponse(activities));
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/scheduled-activities/entity/:entityType/:entityId
 * Returns all activities (any status) on a specific record.
 * Used by the chatter panel on detail pages.
 */
exports.getEntityActivities = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
      return res.status(400).json({ success: false, message: `Unknown entity type: ${entityType}` });
    }
    const activities = await ScheduledActivity.findAll({
      where: { entityType, entityId },
      include: [
        { model: User, as: 'assignedTo', attributes: userAttrs },
        { model: User, as: 'assignedBy', attributes: userAttrs },
      ],
      order: [['dueDate', 'ASC'], ['createdAt', 'DESC']],
    });
    res.json(getSuccessResponse(activities));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/scheduled-activities
 * Create a new scheduled activity. Logs a ChatterMessage on the entity.
 *
 * Body: { type, entityType, entityId, entityLabel, assignedToId, dueDate, note, priority }
 */
exports.createActivity = async (req, res, next) => {
  try {
    const { type, entityType, entityId, entityLabel, assignedToId, dueDate, note, priority } = req.body;

    if (!entityType || !entityId || !assignedToId || !dueDate || !type) {
      return res.status(400).json({ success: false, message: 'type, entityType, entityId, assignedToId, and dueDate are required.' });
    }
    if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
      return res.status(400).json({ success: false, message: `Unknown entity type: ${entityType}` });
    }

    const assignee = await User.findByPk(assignedToId, { attributes: userAttrs });
    if (!assignee) {
      return res.status(404).json({ success: false, message: 'Assignee not found.' });
    }

    const activity = await ScheduledActivity.create({
      type,
      entityType,
      entityId,
      entityLabel: entityLabel || null,
      assignedToId,
      assignedById: req.user.id,
      dueDate,
      note: note || null,
      priority: priority || 'normal',
      status: 'pending',
    });

    // Log to chatter thread on the entity
    const assignerName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;
    const assigneeName = `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() || assignee.email;
    const typeLabel = TYPE_LABELS[type] || 'Task';
    const dueFmt = new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const chatterBody = `${assignerName} scheduled a ${typeLabel} for ${assigneeName} — due ${dueFmt}.${note ? `\n\n"${note}"` : ''}`;

    await postSystemEvent(entityType, entityId, 'activity', chatterBody, { activityId: activity.id, type, dueDate }, req.user.id, assignerName);

    const created = await ScheduledActivity.findByPk(activity.id, {
      include: [
        { model: User, as: 'assignedTo', attributes: userAttrs },
        { model: User, as: 'assignedBy', attributes: userAttrs },
      ],
    });

    res.status(201).json(getSuccessResponse(created, 'Activity scheduled.'));
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/scheduled-activities/:id/done
 * Mark an activity as done. Logs completion to chatter.
 *
 * Body: { completedNote? }
 */
exports.markDone = async (req, res, next) => {
  try {
    const activity = await ScheduledActivity.findByPk(req.params.id, {
      include: [{ model: User, as: 'assignedTo', attributes: userAttrs }],
    });
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found.' });
    if (activity.status !== 'pending') {
      return res.status(422).json({ success: false, message: `Activity is already ${activity.status}.` });
    }

    await activity.update({
      status: 'done',
      completedAt: new Date(),
      completedNote: req.body.completedNote || null,
    });

    // Log completion to chatter
    const doerName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;
    const typeLabel = TYPE_LABELS[activity.type] || 'Task';
    const body = `${doerName} marked ${typeLabel} as done.${req.body.completedNote ? `\n\n"${req.body.completedNote}"` : ''}`;
    await postSystemEvent(activity.entityType, activity.entityId, 'activity', body, { activityId: activity.id, action: 'done' }, req.user.id, doerName);

    res.json(getSuccessResponse(activity, 'Activity marked as done.'));
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/scheduled-activities/:id/reschedule
 * Move an activity's due date. Logs to chatter.
 *
 * Body: { dueDate, note? }
 */
exports.reschedule = async (req, res, next) => {
  try {
    const { dueDate, note } = req.body;
    if (!dueDate) return res.status(400).json({ success: false, message: 'dueDate is required.' });

    const activity = await ScheduledActivity.findByPk(req.params.id);
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found.' });
    if (activity.status !== 'pending') {
      return res.status(422).json({ success: false, message: `Cannot reschedule a ${activity.status} activity.` });
    }

    const oldDate = activity.dueDate;
    await activity.update({ dueDate, note: note !== undefined ? note : activity.note });

    const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;
    const oldFmt = new Date(oldDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const newFmt = new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    await postSystemEvent(activity.entityType, activity.entityId, 'activity', `${userName} rescheduled ${TYPE_LABELS[activity.type] || 'task'} from ${oldFmt} to ${newFmt}.`, { activityId: activity.id, oldDate, newDate: dueDate }, req.user.id, userName);

    res.json(getSuccessResponse(activity, 'Activity rescheduled.'));
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/scheduled-activities/:id
 * Cancel an activity. Only the creator, assignee, or admin may cancel.
 */
exports.cancelActivity = async (req, res, next) => {
  try {
    const activity = await ScheduledActivity.findByPk(req.params.id);
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found.' });
    if (activity.status !== 'pending') {
      return res.status(422).json({ success: false, message: `Activity is already ${activity.status}.` });
    }

    const isCreator = activity.assignedById === req.user.id;
    const isAssignee = activity.assignedToId === req.user.id;
    const isPrivileged = ['admin', 'manager'].includes(req.user.role);
    if (!isCreator && !isAssignee && !isPrivileged) {
      return res.status(403).json({ success: false, message: 'Only the creator, assignee, or an admin may cancel this activity.' });
    }

    await activity.update({ status: 'cancelled' });

    const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;
    await postSystemEvent(activity.entityType, activity.entityId, 'activity', `${userName} cancelled ${TYPE_LABELS[activity.type] || 'task'}.`, { activityId: activity.id, action: 'cancelled' }, req.user.id, userName);

    res.json(getSuccessResponse({ message: 'Activity cancelled.' }));
  } catch (err) {
    next(err);
  }
};
