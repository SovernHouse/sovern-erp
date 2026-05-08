/**
 * Dev Mode PR — commit + push + open PR via gh CLI.
 *
 * Assumes gh is installed and authenticated as VendettaGamesHQ on the VM
 * (verified at session start). The auth token is in /home/alex/.config/gh/.
 *
 * If gh is not available or auth fails, the runner falls back to leaving
 * the branch pushed but un-PR'd, with a chat message asking Alex to open
 * the PR manually.
 */

const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');

const exec = promisify(execFile);

const COMMIT_AUTHOR_NAME = process.env.DEV_MODE_GIT_NAME || 'VendettaGamesHQ';
const COMMIT_AUTHOR_EMAIL = process.env.DEV_MODE_GIT_EMAIL || 'thevendettadao@gmail.com';
const PR_BASE = process.env.DEV_MODE_PR_BASE || 'main';

/**
 * Stage all changes, commit, push, open a PR.
 *
 * @returns {Promise<{ ok, prUrl, prNumber, error, commitSha }>}
 */
async function commitAndOpenPR({ worktreePath, branchName, run, summaryText }) {
  const commitMessage = buildCommitMessage(run, summaryText);

  // 1. Stage everything (already done by captureDiff but harmless to repeat)
  try {
    await exec('git', ['-C', worktreePath, 'add', '-A'], { timeout: 30000 });
  } catch (e) {
    return { ok: false, error: `git add failed: ${e.message}` };
  }

  // 2. Configure commit identity (per L-032)
  try {
    await exec('git', ['-C', worktreePath, 'config', 'user.name', COMMIT_AUTHOR_NAME]);
    await exec('git', ['-C', worktreePath, 'config', 'user.email', COMMIT_AUTHOR_EMAIL]);
  } catch (e) {
    logger.warn(`[dev-mode] git config failed (continuing): ${e.message}`);
  }

  // 3. Commit. Skip pre-commit hooks (we ran our own gitleaks scan).
  let commitSha = null;
  try {
    const { stdout } = await exec(
      'git',
      ['-C', worktreePath, 'commit', '-m', commitMessage],
      { timeout: 30000 },
    );
    // Capture sha
    const sha = await exec('git', ['-C', worktreePath, 'rev-parse', 'HEAD'], { timeout: 5000 });
    commitSha = sha.stdout.trim();
    logger.info(`[dev-mode] Committed ${commitSha} on ${branchName}`);
  } catch (e) {
    return { ok: false, error: `git commit failed: ${(e.stdout || '') + e.stderr || e.message}`.slice(0, 400) };
  }

  // 4. Push the branch
  try {
    await exec('git', ['-C', worktreePath, 'push', '-u', 'origin', branchName], { timeout: 60000 });
  } catch (e) {
    return { ok: false, error: `git push failed: ${(e.stdout || '') + e.stderr || e.message}`.slice(0, 400), commitSha };
  }

  // 5. Open PR via gh
  const prTitle = buildPRTitle(run);
  const prBody = buildPRBody(run, summaryText, commitSha);

  try {
    const { stdout } = await exec(
      'gh',
      [
        'pr', 'create',
        '--base', PR_BASE,
        '--head', branchName,
        '--title', prTitle,
        '--body', prBody,
        '--label', 'dev-mode',  // optional; if label doesn't exist, gh still creates the PR
      ],
      { timeout: 60000, cwd: worktreePath },
    );
    const prUrl = stdout.trim().split('\n').find(line => line.startsWith('https://')) || stdout.trim();
    const prNumberMatch = prUrl.match(/\/pull\/(\d+)/);
    const prNumber = prNumberMatch ? parseInt(prNumberMatch[1], 10) : null;
    logger.info(`[dev-mode] PR opened: ${prUrl}`);
    return { ok: true, prUrl, prNumber, commitSha };
  } catch (e) {
    // PR creation failed (label missing? gh auth expired? rate limit?).
    // We retry once without the label.
    if (/label.*not found/i.test((e.stdout || '') + (e.stderr || ''))) {
      try {
        const { stdout } = await exec(
          'gh',
          [
            'pr', 'create',
            '--base', PR_BASE,
            '--head', branchName,
            '--title', prTitle,
            '--body', prBody,
          ],
          { timeout: 60000, cwd: worktreePath },
        );
        const prUrl = stdout.trim().split('\n').find(line => line.startsWith('https://')) || stdout.trim();
        const prNumberMatch = prUrl.match(/\/pull\/(\d+)/);
        const prNumber = prNumberMatch ? parseInt(prNumberMatch[1], 10) : null;
        logger.info(`[dev-mode] PR opened (no label): ${prUrl}`);
        return { ok: true, prUrl, prNumber, commitSha };
      } catch (e2) {
        return {
          ok: false,
          error: `gh pr create failed: ${(e2.stdout || '') + (e2.stderr || e2.message)}`.slice(0, 400),
          commitSha,
          branchPushed: true,
        };
      }
    }
    return {
      ok: false,
      error: `gh pr create failed: ${(e.stdout || '') + (e.stderr || e.message)}`.slice(0, 400),
      commitSha,
      branchPushed: true,
    };
  }
}

function buildCommitMessage(run, summaryText) {
  const promptShort = (run.prompt || '').replace(/\s+/g, ' ').slice(0, 60);
  const trailer = '\nCo-Authored-By: Claude (dev-mode) <noreply@anthropic.com>\nDev-Mode-Run-Id: ' + run.id;
  const summary = summaryText
    ? '\n\n' + summaryText.slice(0, 1500)
    : '';
  return `feat(dev-mode): ${promptShort}${summary}${trailer}`;
}

function buildPRTitle(run) {
  const promptShort = (run.prompt || '').replace(/\s+/g, ' ').slice(0, 60);
  return `[dev-mode] ${promptShort}`;
}

function buildPRBody(run, summaryText, commitSha) {
  const lines = [
    '> Generated by Sovern ERP dev-mode AI assistant.',
    '',
    `**Run ID:** \`${run.id}\``,
    `**Requested by:** super_admin (in-ERP chat)`,
    `**Branch:** \`${run.branchName || 'unknown'}\``,
    commitSha ? `**Commit:** \`${commitSha.slice(0, 7)}\`` : null,
    '',
    '## Original prompt',
    '',
    '> ' + (run.prompt || '').replace(/\n/g, '\n> '),
    '',
    '## AI summary',
    '',
    summaryText ? summaryText.slice(0, 4000) : '_(no summary captured)_',
    '',
    '---',
    '',
    '## Review checklist',
    '',
    '- [ ] Diff is surgical (no drive-by refactors)',
    '- [ ] No secrets in the diff (gitleaks pre-flight passed)',
    '- [ ] Mobile parity satisfied (api.ts mirror if backend changed)',
    '- [ ] Lessons honored (L-031 bare strings, L-032 shared api, L-034 .associate FKs)',
    '',
    '_Merge to ship. CI will deploy automatically._',
  ];
  return lines.filter(l => l !== null).join('\n');
}

module.exports = { commitAndOpenPR };
