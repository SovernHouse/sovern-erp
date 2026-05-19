#!/usr/bin/env node
/**
 * Phase 4.28i — install git hooks from scripts/git-hooks/ into .git/hooks/
 * Runs as a postinstall script in root package.json so every fresh
 * clone gets the pre-commit hook without manual setup.
 *
 * Safe to run repeatedly. Skips silently in CI (where .git/hooks isn't
 * needed since CI runs the same checker via a workflow).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'scripts', 'git-hooks');
const DST = path.join(ROOT, '.git', 'hooks');

if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
  process.exit(0);
}

if (!fs.existsSync(DST)) {
  // Not inside a git checkout (e.g. npm consumer install). Silent skip.
  process.exit(0);
}

let installed = 0;
for (const name of fs.readdirSync(SRC)) {
  const srcFile = path.join(SRC, name);
  const dstFile = path.join(DST, name);
  fs.copyFileSync(srcFile, dstFile);
  try { fs.chmodSync(dstFile, 0o755); } catch (_) { /* Windows: no-op */ }
  installed++;
}

if (installed > 0) {
  console.log(`[hooks] Installed ${installed} git hook(s) to .git/hooks/`);
}
