/**
 * Research Runner — Tier 2 background sourcing.
 *
 * Phase sequence:
 *   queued → running → completed | failed | cancelled
 *
 * Commit 2 (this commit) is a skeleton: spawnTask() is a no-op (just flips
 * status to running and back to failed with a placeholder message), so the
 * end-to-end DB lifecycle and boot recovery can be exercised. The real
 * subprocess + JSON output parser + Lead/Factory creation + three-channel
 * notifier wiring lands in commit 3 (Tier 2 runner).
 */

const db = require('../models');
const logger = require('../utils/logger');

const NON_TERMINAL = ['queued', 'running'];

/**
 * Boot recovery — anything still in queued/running on boot is from a dead
 * process. Same pattern as devModeRunner.recoverStaleRuns.
 */
async function recoverStaleResearchTasks() {
  if (!db.ResearchTask) return;
  const stale = await db.ResearchTask.findAll({
    where: { status: NON_TERMINAL },
  });
  for (const task of stale) {
    await task.update({
      status: 'failed',
      errorMessage: 'Server restarted while research run was in flight; auto-failed by boot recovery.',
      completedAt: new Date(),
    });
    logger.warn(`[research] Boot recovery: marked stale task ${task.id} as failed`);
  }
  if (stale.length > 0) {
    logger.info(`[research] Boot recovery: failed ${stale.length} stale task(s)`);
  }
}

/**
 * Kick off a research task. In commit 2 this is a placeholder — it flips
 * the row to 'failed' immediately with a "not yet implemented" message so
 * the API returns and we can verify the lifecycle end-to-end. Commit 3
 * replaces this with a real claude -p subprocess + Lead/Factory creation.
 */
async function spawnTask(taskId) {
  setImmediate(async () => {
    try {
      const task = await db.ResearchTask.findByPk(taskId);
      if (!task) return;
      await task.update({
        status: 'failed',
        errorMessage: 'Research runner not yet implemented (commit 3 of 5). Skeleton lifecycle only.',
        completedAt: new Date(),
      });
      logger.info(`[research] Task ${taskId} marked failed (commit-2 skeleton).`);
    } catch (err) {
      logger.error(`[research] spawnTask ${taskId} error: ${err.message}`);
    }
  });
}

/**
 * Cancel a running task. Commit 2 just flips the row; commit 3 will SIGTERM
 * the subprocess via subprocessPid first.
 */
async function cancelTask(taskId) {
  const task = await db.ResearchTask.findByPk(taskId);
  if (!task) return;
  if (!NON_TERMINAL.includes(task.status)) return;
  await task.update({
    status: 'cancelled',
    completedAt: new Date(),
    errorMessage: 'Cancelled by user.',
  });
  logger.info(`[research] Task ${taskId} cancelled by user.`);
}

module.exports = {
  spawnTask,
  cancelTask,
  recoverStaleResearchTasks,
};
