/**
 * Chatter Controller
 * Handles polymorphic message threads on any ERP record.
 */
const { ChatterMessage, User } = require('../models');
const { Op } = require('sequelize');

// ── Allowed entity types (whitelist prevents enumeration attacks) ───────────
const ALLOWED_ENTITY_TYPES = new Set([
  'Quotation',
  'ProformaInvoice',
  'SalesOrder',
  'PurchaseOrder',
  'Lead',
  'Customer',
  'Factory',
  'Inquiry',
  'Invoice',
  'Payment',
  'Shipment',
  'Inspection',
  'Claim',
  'SampleRequest',
  'LetterOfCredit',
]);

/**
 * GET /api/chatter/:entityType/:entityId
 * Returns all messages for a record, oldest first.
 */
exports.getMessages = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;

    if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
      return res.status(400).json({ success: false, message: `Unknown entity type: ${entityType}` });
    }

    const messages = await ChatterMessage.findAll({
      where: {
        entityType,
        entityId,
        parentId: null, // top-level messages only; replies nested separately
      },
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
          required: false,
        },
        {
          model: ChatterMessage,
          as: 'replies',
          include: [
            {
              model: User,
              as: 'author',
              attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
              required: false,
            },
          ],
          order: [['createdAt', 'ASC']],
        },
      ],
      order: [['createdAt', 'ASC']],
    });

    return res.json({ success: true, data: messages });
  } catch (err) {
    console.error('[chatter.getMessages]', err);
    return res.status(500).json({ success: false, message: 'Failed to load messages.' });
  }
};

/**
 * POST /api/chatter/:entityType/:entityId
 * Post a new comment on a record.
 * Authenticated users only; system events are created by other controllers.
 */
exports.postMessage = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { body, attachments, parentId } = req.body;

    if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
      return res.status(400).json({ success: false, message: `Unknown entity type: ${entityType}` });
    }

    if (!body && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ success: false, message: 'Message body or attachment is required.' });
    }

    const authorName = req.user
      ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim()
      : 'System';

    const message = await ChatterMessage.create({
      entityType,
      entityId,
      messageType: attachments?.length ? 'file_attachment' : 'comment',
      body: body || null,
      userId: req.user?.id || null,
      authorName,
      attachments: attachments || [],
      parentId: parentId || null,
      metadata: {},
    });

    // Return with author included
    const created = await ChatterMessage.findByPk(message.id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
        required: false,
      }],
    });

    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('[chatter.postMessage]', err);
    return res.status(500).json({ success: false, message: 'Failed to post message.' });
  }
};

/**
 * DELETE /api/chatter/:entityType/:entityId/:messageId
 * Users can delete their own comments; admins/managers can delete any comment.
 * System events (non-comment types) cannot be deleted.
 */
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await ChatterMessage.findByPk(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    if (message.messageType !== 'comment' && message.messageType !== 'file_attachment') {
      return res.status(403).json({ success: false, message: 'System events cannot be deleted.' });
    }

    const isOwner = message.userId === req.user?.id;
    const isPrivileged = ['admin', 'manager'].includes(req.user?.role);

    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ success: false, message: 'You can only delete your own messages.' });
    }

    await message.destroy();
    return res.json({ success: true, message: 'Message deleted.' });
  } catch (err) {
    console.error('[chatter.deleteMessage]', err);
    return res.status(500).json({ success: false, message: 'Failed to delete message.' });
  }
};

// ── Utility: post a system event from another controller ────────────────────
/**
 * Called internally (not via HTTP) to log automated events to the chatter thread.
 * Usage:
 *   const { postSystemEvent } = require('./chatterController');
 *   await postSystemEvent('Quotation', quotation.id, 'status_change', 'Status changed from Draft to Sent', { oldStatus: 'draft', newStatus: 'sent' }, userId);
 */
exports.postSystemEvent = async (entityType, entityId, messageType, body, metadata = {}, userId = null, authorName = 'System') => {
  try {
    await ChatterMessage.create({
      entityType,
      entityId,
      messageType,
      body,
      userId,
      authorName,
      metadata,
      attachments: [],
    });
  } catch (err) {
    // Never throw from system event logging — it must not break the parent action
    console.error('[chatter.postSystemEvent]', err.message);
  }
};
