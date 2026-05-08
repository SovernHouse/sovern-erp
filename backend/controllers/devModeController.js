/**
 * Dev Mode Controller — Session 1 skeleton.
 *
 * Owns the DB lifecycle of DevModeRun rows. The actual sandboxed Claude
 * subprocess that does the code work is wired in Session 2. For now,
 * startRun just creates a queued row and returns 202; it does not spawn
 * anything.
 *
 * Routes are gated by requireRole('super_admin') at the route layer.
 */

const { Op } = require('sequelize');
const db = require('../models');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const logger = require('../utils/logger.js');
const { spawnRun } = require('../services/devModeRunner');

const MAX_RUNS_PER_24H = 5;
const ANSWER_TIMEOUT_MS = 30 * 60 * 1000; // 30 min — matches the spec's stuck-fallback window

// ─── START a new dev-mode run ────────────────────────────────────────────────

exports.startRun = async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
    throw new ValidationError('Prompt is required and must be at least 5 characters.');
  }

  // Per-user daily cap (rolling 24h)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCount = await db.DevModeRun.count({
    where: {
      userId: req.user.id,
      createdAt: { [Op.gt]: since },
    },
  });
  if (recentCount >= MAX_RUNS_PER_24H) {
    throw new ValidationError(
      `Dev-mode run cap reached (${MAX_RUNS_PER_24H} per rolling 24h). Wait for the cap to roll off or raise the limit in MAX_RUNS_PER_24H.`
    );
  }

  // No concurrent runs per user — Session 2 expects exclusive worktree access
  const inFlight = await db.DevModeRun.findOne({
    where: {
      userId: req.user.id,
      status: { [Op.in]: ['queued', 'running', 'opening_pr', 'awaiting_clarification'] },
    },
  });
  if (inFlight) {
    throw new ValidationError(
      `Another dev-mode run is already in flight (id=${inFlight.id}, status=${inFlight.status}). Wait for it to finish or abort it first.`
    );
  }

  const run = await db.DevModeRun.create({
    userId: req.user.id,
    prompt: prompt.trim(),
    status: 'queued',
    startedAt: new Date(),
  });

  logger.info(`[dev-mode] Run ${run.id} queued by user ${req.user.id}.`);

  // Kick off the runner asynchronously. The HTTP response goes back
  // immediately; the run continues in the background.
  spawnRun(run.id);

  return res.status(202).json({
    success: true,
    data: run,
    message: 'Run queued. The dev-mode AI is now working in a sandboxed worktree on the VM.',
  });
};

// ─── GET a single run ────────────────────────────────────────────────────────

exports.getRun = async (req, res) => {
  const run = await db.DevModeRun.findByPk(req.params.id);
  if (!run) throw new NotFoundError('Dev-mode run not found');
  // super_admin can see everyone's runs (single-tenant for now, but keeps the
  // check honest if/when multiple super_admins exist later).
  if (run.userId !== req.user.id && req.user.role !== 'super_admin') {
    throw new NotFoundError('Dev-mode run not found');
  }
  return res.json({ success: true, data: run });
};

// ─── LIST runs (audit view) ──────────────────────────────────────────────────

exports.listRuns = async (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = {};
  // super_admin sees all rows; non-super_admin should already be 403'd at the
  // route layer, but defense-in-depth: scope to own rows if somehow they got here.
  if (req.user.role !== 'super_admin') where.userId = req.user.id;
  if (status) where.status = status;

  const [count, rows] = await Promise.all([
    db.DevModeRun.count({ where }),
    db.DevModeRun.findAll({
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

// ─── ANSWER a clarification question (mid-run Q&A) ───────────────────────────

exports.answerClarification = async (req, res) => {
  const { answer } = req.body;
  if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
    throw new ValidationError('Answer is required.');
  }

  const run = await db.DevModeRun.findByPk(req.params.id);
  if (!run) throw new NotFoundError('Dev-mode run not found');
  if (run.userId !== req.user.id && req.user.role !== 'super_admin') {
    throw new NotFoundError('Dev-mode run not found');
  }
  if (run.status !== 'awaiting_clarification') {
    throw new ValidationError(
      `Run is not awaiting a clarification (current status: ${run.status}).`
    );
  }
  if (run.awaitingSince && Date.now() - new Date(run.awaitingSince).getTime() > ANSWER_TIMEOUT_MS) {
    throw new ValidationError(
      'Clarification window has expired (30 min). Run will fall back to WIP PR shortly.'
    );
  }

  await run.update({
    clarificationAnswer: answer.trim(),
    status: 'queued',
    awaitingSince: null,
  });

  logger.info(`[dev-mode] Run ${run.id} clarification answered; resuming.`);

  // Resume the runner with the worktree preserved from before the pause.
  spawnRun(run.id, { isResume: true });

  return res.json({
    success: true,
    data: run,
    message: 'Answer recorded. AI is resuming with your answer in context.',
  });
};

// ─── ABORT a running or queued run ───────────────────────────────────────────

exports.abortRun = async (req, res) => {
  const run = await db.DevModeRun.findByPk(req.params.id);
  if (!run) throw new NotFoundError('Dev-mode run not found');
  if (run.userId !== req.user.id && req.user.role !== 'super_admin') {
    throw new NotFoundError('Dev-mode run not found');
  }

  const TERMINAL = ['completed', 'wip', 'failed', 'aborted'];
  if (TERMINAL.includes(run.status)) {
    return res.json({ success: true, data: run, message: `Already terminal (${run.status}).` });
  }

  // Session 2 will use subprocessPid to actually kill the running subprocess.
  // For Session 1 we just flip the row.
  await run.update({
    status: 'aborted',
    completedAt: new Date(),
    errorMessage: 'Aborted by user.',
  });

  logger.info(`[dev-mode] Run ${run.id} aborted by user ${req.user.id}.`);

  return res.json({ success: true, data: run, message: 'Run aborted.' });
};
