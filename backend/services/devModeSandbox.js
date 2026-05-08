/**
 * Dev Mode Sandbox — manages git worktrees for dev-mode runs.
 *
 * Each run gets its own worktree branched off main. The AI subprocess
 * is restricted (via --add-dir) to operate inside the worktree only.
 * Sandbox cleanup removes the worktree after the PR is opened.
 *
 * Path layout on the VM:
 *   /home/<pm2-user>/sovern-erp/                  ← main checkout (read-only for dev-mode)
 *   /home/<pm2-user>/sovern-erp-dev-runs/<runId>/ ← per-run worktree
 *
 * Configurable via env:
 *   DEV_MODE_REPO_PATH       (default: process.cwd() resolved up from backend/)
 *   DEV_MODE_WORKTREE_BASE   (default: <repo>-dev-runs/ sibling)
 */

const path = require('path');
const fs = require('fs/promises');
const { execFile } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');

const exec = promisify(execFile);

const REPO_PATH = process.env.DEV_MODE_REPO_PATH ||
  path.resolve(__dirname, '..', '..');

const WORKTREE_BASE = process.env.DEV_MODE_WORKTREE_BASE ||
  path.resolve(REPO_PATH, '..', path.basename(REPO_PATH) + '-dev-runs');

// Files/dirs the AI must never read or write. Paths are repo-relative.
const DENYLIST = [
  '.env',
  '.env.local',
  '.env.production',
  '.github/workflows',
  'data/erp.db',
  'backend/database.sqlite',
  'secrets',
];
const DENYLIST_REGEX = /(^|\/)(\.env(\.[a-z]+)?$|.*\.(key|pem|p12|pfx)$|secrets\/.*$)/i;

async function ensureBaseDir() {
  await fs.mkdir(WORKTREE_BASE, { recursive: true });
}

/**
 * Create a fresh worktree for this run. The worktree starts from the
 * latest origin/main so the AI sees the deployed code, not any local
 * uncommitted state.
 */
async function setupSandbox(runId) {
  await ensureBaseDir();
  const worktreePath = path.join(WORKTREE_BASE, runId);
  const stamp = new Date().toISOString().slice(0, 10);
  const branchName = `dev-mode/${stamp}-${runId.slice(0, 8)}`;

  // Make sure we have the latest main locally before branching
  try {
    await exec('git', ['-C', REPO_PATH, 'fetch', 'origin', 'main', '--depth=50'], { timeout: 30000 });
  } catch (e) {
    logger.warn(`[dev-mode] Fetch failed (continuing with local main): ${e.message}`);
  }

  // Create the worktree on a new branch off origin/main
  await exec('git', [
    '-C', REPO_PATH,
    'worktree', 'add',
    '-b', branchName,
    worktreePath,
    'origin/main',
  ], { timeout: 60000 });

  // Strip any secret files that somehow live in the working tree (defense
  // in depth on top of .gitignore). We never commit these — they don't
  // exist in origin/main — but if a future change leaks one, we still
  // remove it from the AI's view.
  for (const denied of DENYLIST) {
    const target = path.join(worktreePath, denied);
    try { await fs.rm(target, { recursive: true, force: true }); } catch (_) {}
  }

  logger.info(`[dev-mode] Sandbox ready: ${worktreePath} on ${branchName}`);
  return { worktreePath, branchName };
}

/**
 * Capture diff stats after the AI has finished editing.
 */
async function captureDiff(worktreePath) {
  const filesChanged = [];
  let linesAdded = 0;
  let linesDeleted = 0;

  // Stage everything so we can see the full diff (tracked + untracked)
  try {
    await exec('git', ['-C', worktreePath, 'add', '-A'], { timeout: 30000 });
  } catch (e) {
    logger.warn(`[dev-mode] git add -A failed: ${e.message}`);
  }

  let numstat = '';
  try {
    const { stdout } = await exec('git', ['-C', worktreePath, 'diff', '--cached', '--numstat'], { timeout: 15000 });
    numstat = stdout;
  } catch (e) {
    return { filesChanged: [], linesAdded: 0, linesDeleted: 0 };
  }

  for (const line of numstat.split('\n').filter(Boolean)) {
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0;
    const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0;
    const filePath = parts[2];
    filesChanged.push({ path: filePath, additions, deletions });
    linesAdded += additions;
    linesDeleted += deletions;
  }

  return { filesChanged, linesAdded, linesDeleted };
}

/**
 * Inline secret scanner — defense in depth on top of gitleaks (if installed).
 * Returns { foundSecrets: bool, findings: string[] }.
 */
async function scanForSecrets(worktreePath, filesChanged) {
  const findings = [];

  // 1. Block any change that touches a denied path
  for (const f of filesChanged) {
    if (DENYLIST_REGEX.test(f.path) || DENYLIST.some(d => f.path === d || f.path.startsWith(d + '/'))) {
      findings.push(`Forbidden path edit: ${f.path}`);
    }
  }

  // 2. Pattern scan the diff for common secret shapes
  let diffText = '';
  try {
    const { stdout } = await exec('git', ['-C', worktreePath, 'diff', '--cached'], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
    diffText = stdout;
  } catch (_) { /* skip pattern scan on diff failure */ }

  const patterns = [
    { name: 'AWS Access Key', re: /\bAKIA[0-9A-Z]{16}\b/ },
    { name: 'AWS Secret Key', re: /aws[_-]?secret[_-]?(access)?[_-]?key.{0,20}['"]?[0-9a-zA-Z/+=]{40}/i },
    { name: 'Google API Key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
    { name: 'Slack Token', re: /\bxox[abprs]-[0-9a-zA-Z-]{10,}\b/ },
    { name: 'GitHub Token', re: /\b(ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{36,}\b/ },
    { name: 'Stripe Live Key', re: /\bsk_live_[0-9a-zA-Z]{24,}\b/ },
    { name: 'JWT-shaped string', re: /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ },
    { name: 'Private key block', re: /-----BEGIN (RSA|OPENSSH|EC|DSA|PRIVATE) PRIVATE KEY-----/ },
  ];

  for (const p of patterns) {
    if (p.re.test(diffText)) findings.push(`${p.name} pattern detected in diff`);
  }

  // 3. Run gitleaks if present (best-effort, doesn't fail the run if missing)
  try {
    await exec('gitleaks', ['detect', '--source', worktreePath, '--no-git', '--redact', '--exit-code', '1'], {
      timeout: 30000,
    });
  } catch (e) {
    // gitleaks exits 1 when leaks are found, ENOENT if not installed
    if (e.code === 'ENOENT') {
      logger.info('[dev-mode] gitleaks not installed; relying on inline scanner only');
    } else if (e.stdout || e.stderr) {
      findings.push('gitleaks: ' + ((e.stdout || '') + (e.stderr || '')).slice(0, 300));
    }
  }

  return { foundSecrets: findings.length > 0, findings };
}

/**
 * Remove a worktree after the PR is opened (PR lives on remote, we don't
 * need the local copy). Best-effort: log and continue on failure.
 */
async function cleanupSandbox(worktreePath) {
  if (!worktreePath) return;
  try {
    await exec('git', ['-C', REPO_PATH, 'worktree', 'remove', '--force', worktreePath], { timeout: 30000 });
    logger.info(`[dev-mode] Sandbox removed: ${worktreePath}`);
  } catch (e) {
    logger.warn(`[dev-mode] Worktree remove failed (${worktreePath}): ${e.message}`);
    // Fallback: just delete the directory
    try { await fs.rm(worktreePath, { recursive: true, force: true }); } catch (_) {}
  }
}

module.exports = {
  REPO_PATH,
  WORKTREE_BASE,
  DENYLIST,
  setupSandbox,
  captureDiff,
  scanForSecrets,
  cleanupSandbox,
};
