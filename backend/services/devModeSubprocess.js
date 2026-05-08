/**
 * Dev Mode Subprocess — extended `claude -p` invocation for the in-ERP
 * dev mode. Mirrors backend/controllers/aiController.js runClaudeSubprocess
 * but inverts the tool allowlist (Bash/Read/Write/Edit/Glob/Grep ON, MCP
 * server OFF) and runs cwd-pinned to the worktree.
 *
 * The subprocess is sandboxed by:
 *   - --add-dir <worktreePath>  (Claude tool access restricted to this dir)
 *   - cwd = worktreePath        (relative paths resolve inside the sandbox)
 *   - No --mcp-config           (no ERP data tools available — prevents
 *                                prompt injection from earlier-seen email
 *                                content reaching the dev agent)
 *   - --max-turns               (per-run turn cap, configurable)
 *
 * The dev-mode system prompt is in buildDevModeSystemPrompt() below.
 * Output is captured in stream-json format so we can extract token usage
 * and turn count.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs/promises');
const logger = require('../utils/logger');

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;  // 30 min — matches the spec
const DEFAULT_MAX_TURNS = 30;
const CLARIFICATION_FILE = '_CLARIFY.md';

// ─── System prompt ───────────────────────────────────────────────────────────

function buildDevModeSystemPrompt({ runId, worktreePath, branchName, repoRootRelative = '.' }) {
  return `You are a senior software engineer making targeted changes to the Sovern ERP codebase. You are the dev-mode assistant inside the ERP itself, invoked from the in-app chat by Alex (super_admin).

## Sandbox

- You are running inside a fresh git worktree at: ${worktreePath}
- Branched from origin/main onto: ${branchName}
- Run ID: ${runId}
- All file operations are restricted to this worktree (--add-dir).
- The repo root is at: ${repoRootRelative} (relative to your cwd).

## Hard rules

- DO NOT read or write any of these paths:
  - .env, .env.local, .env.production (any .env*)
  - .github/workflows/*
  - data/erp.db, backend/database.sqlite
  - secrets/*
  - any *.key, *.pem, *.p12, *.pfx file
  - any file containing real credentials
- If a feature genuinely requires a new env var, add it to .env.example with a placeholder value and tell the user in your final summary to add the real value to their server's .env.
- DO NOT push to main directly. The runner does the commit + PR flow for you after you exit.
- DO NOT run interactive commands. No \`gh auth login\`, no editor commands.
- DO NOT run \`npm install\` unless the change genuinely adds a dependency. If you must, document why in your summary.
- Use the existing code conventions (see CLAUDE.md and the surrounding code style).

## Mid-run clarification

If the prompt is genuinely ambiguous and you cannot proceed without a decision from Alex, do NOT guess. Instead:

1. Write a single file at \`${CLARIFICATION_FILE}\` (in the worktree root) with this exact format:
   \`\`\`
   # Clarification needed

   <one short paragraph explaining what's ambiguous>

   ## Question
   <one specific question>

   ## Options (if applicable)
   - Option A: ...
   - Option B: ...
   \`\`\`
2. Make NO other code changes.
3. Exit cleanly.

The runner will detect this file, mark the run \`awaiting_clarification\`, surface the question to Alex, wait for his answer, then re-invoke you with the answer plus the same worktree state. Use clarification only when truly stuck — don't pester for stylistic choices.

## When you finish

- Make the requested change with surgical edits. No drive-by refactors.
- Update related tests if they exist for the touched files. Don't add tests for unrelated code.
- DO NOT commit. The runner stages and commits for you.
- End your final response with a markdown summary block of:
  - what you changed (bulleted)
  - any assumptions you made
  - anything Alex needs to do manually after merging the PR (env vars, migrations, etc.)

## Quality bar

- Follow the existing patterns. Read neighboring files before writing new ones.
- L-031: requireRole takes bare strings, never arrays.
- L-032: import api from '../../services/api'; never import axios directly.
- L-034: with freezeTableName, table names are singular; declare FKs in .associate(), not inline.
- Mobile parity: any new backend endpoint must be mirrored in mobile/sovern-ops-app/src/services/api.ts in the same diff.

You will succeed by writing minimal, correct, surgical changes that pass the existing lint/type checks. The PR review is a single human (Alex) on a phone. Make the diff easy to read.`;
}

// ─── Subprocess invocation ───────────────────────────────────────────────────

/**
 * Run claude -p in dev-mode against a worktree.
 *
 * @param {object} args
 * @param {string} args.runId
 * @param {string} args.worktreePath
 * @param {string} args.branchName
 * @param {string} args.userPrompt          — what Alex asked for
 * @param {object} [args.clarificationContext] — { previousQuestion, previousAnswer } when resuming
 * @param {number} [args.maxTurns]
 * @param {number} [args.timeoutMs]
 * @returns {Promise<{ ok, output, error, exitCode, turnCount, tokenUsage, killedByTimeout }>}
 */
function runDevModeSubprocess({
  runId,
  worktreePath,
  branchName,
  userPrompt,
  clarificationContext = null,
  maxTurns = DEFAULT_MAX_TURNS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let killedByTimeout = false;

    const systemPrompt = buildDevModeSystemPrompt({ runId, worktreePath, branchName });

    // Compose the user prompt. On clarification resume, include prior Q&A.
    let composedPrompt = userPrompt;
    if (clarificationContext && clarificationContext.previousQuestion && clarificationContext.previousAnswer) {
      composedPrompt =
        '## Original task\n\n' + userPrompt + '\n\n' +
        '## Your previous clarification question\n\n' + clarificationContext.previousQuestion + '\n\n' +
        '## Alex\'s answer\n\n' + clarificationContext.previousAnswer + '\n\n' +
        '## Resume\n\nProceed with the task using the answer above. Do not ask another clarification unless absolutely necessary.';
    }

    // claude -p flags:
    //   --system-prompt        — override Claude Code's default identity
    //   --add-dir              — restrict file tools to this directory
    //   --max-turns            — turn cap per run
    //   --permission-mode      — bypassPermissions so MCP/tool calls don't stall
    //   --strict-mcp-config    — ignore global ~/.claude.json
    //   --output-format json   — structured final result with token usage
    //   --allowedTools         — explicitly allow code-edit tools
    //   (no --mcp-config)      — no ERP data tools, prevents prompt-injection bleed
    const args = [
      '-p',
      '--system-prompt', systemPrompt,
      '--add-dir', worktreePath,
      '--max-turns', String(maxTurns),
      '--permission-mode', 'bypassPermissions',
      '--strict-mcp-config',
      '--output-format', 'json',
      '--allowedTools', 'Bash,Read,Write,Edit,Glob,Grep',
    ];

    logger.info(`[dev-mode] Spawning claude -p for run ${runId} in ${worktreePath}`);

    const child = spawn('claude', args, {
      cwd: worktreePath,
      env: {
        ...process.env,
        // Hard-clear secrets-shaped vars from the child's env so the subprocess
        // can't read them back via process.env. Defense in depth on top of
        // the system prompt rule.
        DATABASE_URL: '',
        RESEND_API_KEY: '',
        SMTP_PASS: '',
        SMTP_USER: '',
        JWT_SECRET: '',
        ANTHROPIC_API_KEY: '',
        GOOGLE_CLIENT_SECRET: '',
        SENTRY_DSN: '',
      },
    });

    child.stdin.write(composedPrompt);
    child.stdin.end();

    const killTimer = setTimeout(() => {
      if (!settled) {
        killedByTimeout = true;
        logger.warn(`[dev-mode] Run ${runId} timed out at ${timeoutMs}ms — killing`);
        child.kill('SIGTERM');
        setTimeout(() => { try { child.kill('SIGKILL'); } catch (_) {} }, 5000);
      }
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      settled = true;
      clearTimeout(killTimer);

      // Parse the JSON output to extract token usage + turn count
      let parsed = null;
      let tokenUsage = {};
      let turnCount = 0;
      try {
        parsed = JSON.parse(stdout);
        if (parsed && parsed.usage) {
          tokenUsage = {
            input: parsed.usage.input_tokens || 0,
            output: parsed.usage.output_tokens || 0,
            cacheRead: parsed.usage.cache_read_input_tokens || 0,
            cacheCreation: parsed.usage.cache_creation_input_tokens || 0,
          };
        }
        if (parsed && typeof parsed.num_turns === 'number') {
          turnCount = parsed.num_turns;
        }
      } catch (e) {
        // Not JSON — fall through with empty telemetry
      }

      resolve({
        ok: code === 0 && !killedByTimeout,
        output: parsed && parsed.result ? parsed.result : stdout.trim(),
        error: code !== 0 ? stderr.slice(0, 500) : null,
        exitCode: code,
        turnCount,
        tokenUsage,
        killedByTimeout,
      });
    });

    child.on('error', (err) => {
      settled = true;
      clearTimeout(killTimer);
      logger.error(`[dev-mode] Subprocess error for run ${runId}: ${err.message}`);
      resolve({
        ok: false,
        output: null,
        error: err.message,
        exitCode: -1,
        turnCount: 0,
        tokenUsage: {},
        killedByTimeout: false,
      });
    });
  });
}

/**
 * Detect whether the AI wrote a clarification request file.
 */
async function detectClarification(worktreePath) {
  const filePath = path.join(worktreePath, CLARIFICATION_FILE);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return { found: true, content: content.trim() };
  } catch (_) {
    return { found: false, content: null };
  }
}

/**
 * Remove the clarification file from the worktree before re-invoking
 * (so the next round doesn't see stale state).
 */
async function consumeClarification(worktreePath) {
  const filePath = path.join(worktreePath, CLARIFICATION_FILE);
  try { await fs.unlink(filePath); } catch (_) {}
}

module.exports = {
  runDevModeSubprocess,
  detectClarification,
  consumeClarification,
  buildDevModeSystemPrompt,
  CLARIFICATION_FILE,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_TURNS,
};
