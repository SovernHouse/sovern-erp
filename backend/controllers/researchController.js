/**
 * Research Controller — Tier 2 background sourcing.
 *
 * Owns the DB lifecycle of ResearchTask rows. The actual subprocess that
 * does the web research lives in services/researchRunner.js (skeleton in
 * commit 2; real implementation in commit 3).
 *
 * Routes are gated by requireAuth + requireRole('admin', 'super_admin')
 * at the route layer (bare strings — L-031).
 */

const { Op } = require('sequelize');
const db = require('../models');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const logger = require('../utils/logger.js');
const { spawnTask, cancelTask } = require('../services/researchRunner');

const MAX_CONCURRENT_PER_USER = 3;
const MAX_TASKS_PER_24H = 10;
const VALID_MODES = ['clients', 'suppliers'];

// ─── START a new research task ───────────────────────────────────────────────

exports.startTask = async (req, res) => {
  const { mode, brief, conversationId } = req.body;

  if (!mode || !VALID_MODES.includes(mode)) {
    throw new ValidationError(
      `mode is required and must be one of: ${VALID_MODES.join(', ')}`
    );
  }
  if (!brief || typeof brief !== 'string' || brief.trim().length < 5) {
    throw new ValidationError('brief is required and must be at least 5 characters.');
  }

  // Per-user 24h cap (rolling)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCount = await db.ResearchTask.count({
    where: {
      userId: req.user.id,
      createdAt: { [Op.gt]: since },
    },
  });
  if (recentCount >= MAX_TASKS_PER_24H) {
    throw new ValidationError(
      `Research task cap reached (${MAX_TASKS_PER_24H} per rolling 24h). Wait for the cap to roll off.`
    );
  }

  // Per-user concurrency cap
  const inFlight = await db.ResearchTask.count({
    where: {
      userId: req.user.id,
      status: { [Op.in]: ['queued', 'running'] },
    },
  });
  if (inFlight >= MAX_CONCURRENT_PER_USER) {
    throw new ValidationError(
      `Too many research tasks running (${inFlight}/${MAX_CONCURRENT_PER_USER}). Wait for one to finish or cancel it.`
    );
  }

  // Optional conversation link (so the runner can append the result back to chat)
  let validConversationId = null;
  if (conversationId) {
    const conv = await db.AIConversation.findOne({
      where: { id: conversationId, userId: req.user.id },
    });
    if (conv) validConversationId = conv.id;
  }

  const task = await db.ResearchTask.create({
    userId: req.user.id,
    mode,
    brief: brief.trim(),
    conversationId: validConversationId,
    status: 'queued',
    startedAt: new Date(),
  });

  logger.info(`[research] Task ${task.id} queued by user ${req.user.id} (mode=${mode}).`);

  // Kick off the runner asynchronously. HTTP response goes back immediately;
  // the run continues in the background and notifies on completion.
  spawnTask(task.id);

  return res.status(202).json({
    success: true,
    data: task,
    message: `Research started — I'll notify you when done. ~5–15 min.`,
  });
};

// ─── GET a single task ───────────────────────────────────────────────────────

exports.getTask = async (req, res) => {
  const task = await db.ResearchTask.findByPk(req.params.id);
  if (!task) throw new NotFoundError('Research task not found');
  if (task.userId !== req.user.id && req.user.role !== 'super_admin') {
    throw new NotFoundError('Research task not found');
  }
  return res.json({ success: true, data: task });
};

// ─── LIST tasks (audit view) ─────────────────────────────────────────────────

exports.listTasks = async (req, res) => {
  const { status, mode, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = {};
  // super_admin sees all rows; everyone else is scoped to their own.
  if (req.user.role !== 'super_admin') where.userId = req.user.id;
  if (status) where.status = status;
  if (mode && VALID_MODES.includes(mode)) where.mode = mode;

  const [count, rows] = await Promise.all([
    db.ResearchTask.count({ where }),
    db.ResearchTask.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    }),
  ]);

  return res.json({
    success: true,
    data: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      pages: Math.ceil(count / parseInt(limit)),
      pageSize: parseInt(limit),
    },
  });
};

// ─── CANCEL a queued or running task ─────────────────────────────────────────

exports.cancelTask = async (req, res) => {
  const task = await db.ResearchTask.findByPk(req.params.id);
  if (!task) throw new NotFoundError('Research task not found');
  if (task.userId !== req.user.id && req.user.role !== 'super_admin') {
    throw new NotFoundError('Research task not found');
  }

  const TERMINAL = ['completed', 'failed', 'cancelled'];
  if (TERMINAL.includes(task.status)) {
    return res.json({
      success: true,
      data: task,
      message: `Already terminal (${task.status}).`,
    });
  }

  await cancelTask(task.id);
  const refreshed = await db.ResearchTask.findByPk(task.id);

  logger.info(`[research] Task ${task.id} cancel requested by user ${req.user.id}.`);

  return res.json({ success: true, data: refreshed, message: 'Task cancelled.' });
};
