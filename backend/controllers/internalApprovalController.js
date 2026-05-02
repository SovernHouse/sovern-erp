/**
 * Internal Approval Controller
 * Manager sign-off on staff-initiated actions.
 */
const { InternalApproval, User, Notification } = require('../models');
const { Op } = require('sequelize');
const { postSystemEvent } = require('./chatterController');

const INCLUDE_USERS = [
  { model: User, as: 'requester',   attributes: ['id','firstName','lastName','email','role'] },
  { model: User, as: 'assignedTo',  attributes: ['id','firstName','lastName','email','role'], required: false },
  { model: User, as: 'decidedBy',   attributes: ['id','firstName','lastName','email','role'], required: false },
];

// ── List approvals (with filters) ─────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const { status, entityType, assignedToMe, page = 1, limit = 50 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (entityType) where.entityType = entityType;
    if (assignedToMe === 'true') {
      where[Op.or] = [
        { assignedToUserId: req.user.id },
        { assignedToUserId: null },
      ];
    }

    const { count, rows } = await InternalApproval.findAndCountAll({
      where,
      include: INCLUDE_USERS,
      order: [
        ['priority', 'DESC'],
        ['createdAt', 'ASC'],
      ],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    return res.json({
      success: true,
      data: rows,
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) {
    console.error('[internalApproval.getAll]', err);
    return res.status(500).json({ success: false, message: 'Failed to load approvals.' });
  }
};

// ── Get single ─────────────────────────────────────────────────────────────
exports.getById = async (req, res) => {
  try {
    const approval = await InternalApproval.findByPk(req.params.id, { include: INCLUDE_USERS });
    if (!approval) return res.status(404).json({ success: false, message: 'Approval not found.' });
    return res.json({ success: true, data: approval });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to load approval.' });
  }
};

// ── Get pending for a specific record ──────────────────────────────────────
exports.getForEntity = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const approvals = await InternalApproval.findAll({
      where: { entityType, entityId },
      include: INCLUDE_USERS,
      order: [['createdAt', 'DESC']],
    });
    return res.json({ success: true, data: approvals });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to load approvals.' });
  }
};

// ── Request approval ───────────────────────────────────────────────────────
exports.request = async (req, res) => {
  try {
    const {
      entityType, entityId, approvalType = 'general',
      requestNote, assignedToUserId, priority = 'normal', dueDate,
    } = req.body;

    if (!entityType || !entityId) {
      return res.status(400).json({ success: false, message: 'entityType and entityId are required.' });
    }

    // Cancel any existing pending approval for the same entity
    await InternalApproval.update(
      { status: 'cancelled' },
      { where: { entityType, entityId, status: 'pending' } }
    );

    const approval = await InternalApproval.create({
      entityType,
      entityId,
      approvalType,
      requestedByUserId: req.user.id,
      assignedToUserId: assignedToUserId || null,
      requestNote: requestNote || null,
      priority,
      dueDate: dueDate || null,
      status: 'pending',
    });

    // Log to chatter
    const requesterName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
    await postSystemEvent(
      entityType, entityId,
      'approval_request',
      `${requesterName} submitted this for manager approval${requestNote ? `: "${requestNote}"` : '.'}`,
      { approvalId: approval.id, approvalType },
      req.user.id,
      requesterName,
    );

    const created = await InternalApproval.findByPk(approval.id, { include: INCLUDE_USERS });
    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('[internalApproval.request]', err);
    return res.status(500).json({ success: false, message: 'Failed to create approval request.' });
  }
};

// ── Approve ────────────────────────────────────────────────────────────────
exports.approve = async (req, res) => {
  try {
    const approval = await InternalApproval.findByPk(req.params.id);
    if (!approval) return res.status(404).json({ success: false, message: 'Approval not found.' });
    if (approval.status !== 'pending') {
      return res.status(409).json({ success: false, message: `Cannot approve — current status is ${approval.status}.` });
    }

    // Only managers/admins can approve
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only managers or admins can approve.' });
    }

    await approval.update({
      status: 'approved',
      decidedByUserId: req.user.id,
      decisionNote: req.body.note || null,
      decidedAt: new Date(),
    });

    const decidedByName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
    await postSystemEvent(
      approval.entityType, approval.entityId,
      'approval_decision',
      `${decidedByName} approved this${req.body.note ? `. Note: "${req.body.note}"` : '.'}`,
      { approvalId: approval.id, decision: 'approved' },
      req.user.id,
      decidedByName,
    );

    const updated = await InternalApproval.findByPk(approval.id, { include: INCLUDE_USERS });
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[internalApproval.approve]', err);
    return res.status(500).json({ success: false, message: 'Failed to approve.' });
  }
};

// ── Reject ─────────────────────────────────────────────────────────────────
exports.reject = async (req, res) => {
  try {
    const approval = await InternalApproval.findByPk(req.params.id);
    if (!approval) return res.status(404).json({ success: false, message: 'Approval not found.' });
    if (approval.status !== 'pending') {
      return res.status(409).json({ success: false, message: `Cannot reject — current status is ${approval.status}.` });
    }
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only managers or admins can reject.' });
    }
    if (!req.body.note) {
      return res.status(400).json({ success: false, message: 'A rejection note is required.' });
    }

    await approval.update({
      status: 'rejected',
      decidedByUserId: req.user.id,
      decisionNote: req.body.note,
      decidedAt: new Date(),
    });

    const decidedByName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
    await postSystemEvent(
      approval.entityType, approval.entityId,
      'approval_decision',
      `${decidedByName} rejected this. Reason: "${req.body.note}"`,
      { approvalId: approval.id, decision: 'rejected', reason: req.body.note },
      req.user.id,
      decidedByName,
    );

    const updated = await InternalApproval.findByPk(approval.id, { include: INCLUDE_USERS });
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[internalApproval.reject]', err);
    return res.status(500).json({ success: false, message: 'Failed to reject.' });
  }
};

// ── Cancel (requester can cancel their own pending request) ────────────────
exports.cancel = async (req, res) => {
  try {
    const approval = await InternalApproval.findByPk(req.params.id);
    if (!approval) return res.status(404).json({ success: false, message: 'Approval not found.' });
    if (approval.status !== 'pending') {
      return res.status(409).json({ success: false, message: 'Only pending approvals can be cancelled.' });
    }
    const isOwner = approval.requestedByUserId === req.user.id;
    const isPrivileged = ['admin', 'manager'].includes(req.user.role);
    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ success: false, message: 'You can only cancel your own approval requests.' });
    }

    await approval.update({ status: 'cancelled' });
    return res.json({ success: true, message: 'Approval request cancelled.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to cancel.' });
  }
};

// ── Dashboard summary: count pending approvals assigned to current user ────
exports.getPendingCount = async (req, res) => {
  try {
    const count = await InternalApproval.count({
      where: {
        status: 'pending',
        [Op.or]: [
          { assignedToUserId: req.user.id },
          { assignedToUserId: null },
        ],
      },
    });
    return res.json({ success: true, data: { pendingCount: count } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to count pending approvals.' });
  }
};
