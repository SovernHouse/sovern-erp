/**
 * Dev Mode Runner — orchestrates the full dev-mode run lifecycle.
 *
 * Phase sequence:
 *   queued → running → (awaiting_clarification?) → opening_pr → completed | wip | failed
 *
 * Design:
 *   - Each run is processed by an async function in the same Node process.
 *   - State is persisted to the DevModeRun row at each phase change.
 *   - The actual `claude -p` subprocess is the long-running piece (up to
 *     30 min); everything else is sub-second async.
 *   - Worktree cleanup happens on terminal status only (not on
 *     awaiting_clarification — we preserve the worktree across the Q&A
 *     pause so the AI can resume from the same state).
 *   - On server boot, any row in a non-terminal status is force-failed
 *     (the previous process died mid-run).
 */

const db = require('../models');
const logger = require('../utils/logger');
const { setupSandbox, captureDiff, scanForSecrets, cleanupSandbox } = require('./devModeSandbox');
const {
  runDevModeSubprocess,
  detectClarification,
  consumeClarification,
} = require('./devModeSubprocess');
const { commitAndOpenPR } = require('./devModePR');
const { fireDevModeNotifications } = require('./devModeNotifier');

const NON_TERMINAL = ['queued', 'running', 'opening_pr', 'awaiting_clarification'];
const TERMINAL = ['completed', 'wip', 'failed', 'aborted'];

/**
 * Boot recovery — anything still non-terminal must be from a dead process.
 * Mark them failed so users aren't left with phantom "running" rows.
 */
async function recoverStaleRuns() {
  if (!db.DevModeRun) return;
  const stale = await db.DevModeRun.findAll({
    where: { status: NON_TERMINAL },
  });
  for (const run of stale) {
    await run.update({
      status: 'failed',
      errorMessage: 'Server restarted while run was in flight; auto-failed by boot recovery.',
      completedAt: new Date(),
    });
    logger.warn(`[dev-mode] Boot recovery: marked stale run ${run.id} as failed`);
  }
  if (stale.length > 0) {
    logger.info(`[dev-mode] Boot recovery: failed ${stale.length} stale run(s)`);
  }
}

/**
 * Process a single run end-to-end. Called on startRun and on resume after
 * clarification.
 */
async function processRun(runId, { isResume = false } = {}) {
  const run = await db.DevModeRun.findByPk(runId);
  if (!run) {
    logger.warn(`[dev-mode] processRun: ${runId} not found`);
    return;
  }
  if (TERMINAL.includes(run.status) && !isResume) {
    logger.warn(`[dev-mode] processRun: ${runId} already terminal (${run.status})`);
    return;
  }

  try {
    // ── 1. Sandbox (skip if resuming after clarification) ────────────────
    let worktreePath = run.workTreePath;
    let branchName = run.branchName;
    if (!isResume) {
      await run.update({ status: 'running', startedAt: run.startedAt || new Date() });
      const sb = await setupSandbox(runId);
      worktreePath = sb.worktreePath;
      branchName = sb.branchName;
      await run.update({ workTreePath: worktreePath, branchName });
    } else {
      await run.update({ status: 'running' });
      await consumeClarification(worktreePath);
    }

    // ── 2. Run claude -p ─────────────────────────────────────────────────
    const result = await runDevModeSubprocess({
      runId,
      worktreePath,
      branchName,
      userPrompt: run.prompt,
      clarificationContext: isResume
        ? {
            previousQuestion: run.clarificationQuestion,
            previousAnswer: run.clarificationAnswer,
          }
        : null,
      maxTurns: run.maxTurns || 30,
    });

    await run.update({
      turnCount: (run.turnCount || 0) + (result.turnCount || 0),
      tokenUsage: mergeTokenUsage(run.tokenUsage || {}, result.tokenUsage || {}),
    });

    // ── 3. Clarification check (before diff/PR) ──────────────────────────
    const clar = await detectClarification(worktreePath);
    if (clar.found) {
      await run.update({
        status: 'awaiting_clarification',
        clarificationQuestion: clar.content,
        awaitingSince: new Date(),
      });
      logger.info(`[dev-mode] Run ${runId} is awaiting clarification`);
      await fireDevModeNotifications(run, 'awaiting_clarification');
      return;  // do NOT cleanup; preserve worktree for resume
    }

    // ── 4. Subprocess errors that didn't ask for clarification ──────────
    if (!result.ok) {
      const wasTimeout = result.killedByTimeout;
      const errMsg = wasTimeout
        ? '30-minute timeout reached'
        : (result.error || 'Subprocess exited non-zero with no clarification');
      await run.update({
        status: wasTimeout ? 'wip' : 'failed',
        errorMessage: errMsg,
        completedAt: new Date(),
      });
      // Even on failure, attempt a WIP-PR if the AI made any progress
      const diff = await captureDiff(worktreePath);
      if (diff.linesAdded > 0 || diff.linesDeleted > 0) {
        await tryWipPR({ run, worktreePath, branchName, diff, summaryText: result.output, errMsg });
      }
      await cleanupSandbox(worktreePath);
      await fireDevModeNotifications(run, run.status);
      return;
    }

    // ── 5. Capture diff + scan for secrets ───────────────────────────────
    const diff = await captureDiff(worktreePath);
    await run.update({
      filesChanged: diff.filesChanged,
      linesAdded: diff.linesAdded,
      linesDeleted: diff.linesDeleted,
    });

    if (diff.linesAdded === 0 && diff.linesDeleted === 0) {
      await run.update({
        status: 'failed',
        errorMessage: 'AI reported success but made no file changes.',
        completedAt: new Date(),
      });
      await cleanupSandbox(worktreePath);
      await fireDevModeNotifications(run, 'failed');
      return;
    }

    const leak = await scanForSecrets(worktreePath, diff.filesChanged);
    if (leak.foundSecrets) {
      await run.update({
        status: 'failed',
        errorMessage: 'Secrets/forbidden-path scanner blocked: ' + leak.findings.join('; '),
        completedAt: new Date(),
      });
      await cleanupSandbox(worktreePath);
      await fireDevModeNotifications(run, 'failed');
      return;
    }

    // ── 6. Open PR ───────────────────────────────────────────────────────
    await run.update({ status: 'opening_pr' });
    const pr = await commitAndOpenPR({
      worktreePath,
      branchName,
      run,
      summaryText: result.output,
    });

    if (!pr.ok) {
      await run.update({
        status: pr.branchPushed ? 'wip' : 'failed',
        errorMessage: pr.error,
        completedAt: new Date(),
      });
      await cleanupSandbox(worktreePath);
      await fireDevModeNotifications(run, run.status);
      return;
    }

    await run.update({
      status: 'completed',
      prUrl: pr.prUrl,
      prNumber: pr.prNumber,
      completedAt: new Date(),
    });
    await cleanupSandbox(worktreePath);
    await fireDevModeNotifications(run, 'completed');

  } catch (err) {
    logger.error(`[dev-mode] Run ${runId} threw: ${err.message}\n${err.stack}`);
    try {
      await run.update({
        status: 'failed',
        errorMessage: 'Runner exception: ' + err.message.slice(0, 300),
        completedAt: new Date(),
      });
      if (run.workTreePath) await cleanupSandbox(run.workTreePath);
      await fireDevModeNotifications(run, 'failed');
    } catch (_) { /* swallow nested errors */ }
  }
}

async function tryWipPR({ run, worktreePath, branchName, diff, summaryText, errMsg }) {
  try {
    await run.update({
      filesChanged: diff.filesChanged,
      linesAdded: diff.linesAdded,
      linesDeleted: diff.linesDeleted,
    });
    const wipSummary = '⚠️ WIP — ' + (errMsg || 'incomplete') + '\n\n' + (summaryText || '');
    const pr = await commitAndOpenPR({ worktreePath, branchName, run, summaryText: wipSummary });
    if (pr.ok) {
      await run.update({ prUrl: pr.prUrl, prNumber: pr.prNumber });
    }
  } catch (e) {
    logger.warn(`[dev-mode] WIP PR attempt failed: ${e.message}`);
  }
}

function mergeTokenUsage(prev, next) {
  return {
    input: (prev.input || 0) + (next.input || 0),
    output: (prev.output || 0) + (next.output || 0),
    cacheRead: (prev.cacheRead || 0) + (next.cacheRead || 0),
    cacheCreation: (prev.cacheCreation || 0) + (next.cacheCreation || 0),
  };
}

/**
 * Kick off a run asynchronously. Returns immediately; the run continues in
 * the background. Errors are caught inside processRun and persisted to the
 * row's status/errorMessage.
 */
function spawnRun(runId, opts = {}) {
  setImmediate(() => {
    processRun(runId, opts).catch((err) => {
      logger.error(`[dev-mode] Unhandled spawnRun error for ${runId}: ${err.message}`);
    });
  });
}

module.exports = {
  processRun,
  spawnRun,
  recoverStaleRuns,
  TERMINAL,
  NON_TERMINAL,
};
