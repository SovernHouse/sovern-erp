#!/usr/bin/env node
/**
 * Phase 4.28i — sensitive compensation vocabulary scanner.
 *
 * Two modes:
 *   --staged          Scan `git diff --cached -U0` ADDED lines only. Used
 *                     by the pre-commit hook so only what the developer
 *                     is introducing right now blocks the commit.
 *   --full (default)  Scan every tracked file. Used by CI to catch any
 *                     leak that slipped past a local hook (e.g. someone
 *                     pushed from a fresh clone without the hook
 *                     installed).
 *
 * Exit codes:
 *   0  clean
 *   1  one or more forbidden patterns found in non-allowlisted files
 *
 * No npm deps — pure Node so it runs in CI without an install step and
 * works in any clone (including the GCP VM's deploy worker).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const VOCAB_FILE = path.join(__dirname, 'sensitive-vocab.json');

function loadVocab() {
  const raw = JSON.parse(fs.readFileSync(VOCAB_FILE, 'utf8'));
  return {
    patterns: raw.patterns.map(p => ({ name: p.name, regex: new RegExp(p.regex, 'i') })),
    allowlistPaths: new Set(raw.allowlist_paths || []),
    allowlistDirs: (raw.allowlist_dirs || []).map(d => d.replace(/\/$/, '') + '/'),
  };
}

function normalize(rel) {
  return rel.replace(/\\/g, '/');
}

function isAllowed(relPath, vocab) {
  const norm = normalize(relPath);
  if (vocab.allowlistPaths.has(norm)) return true;
  for (const dir of vocab.allowlistDirs) {
    if (norm.startsWith(dir)) return true;
  }
  return false;
}

function scanText(text, fileRel, vocab) {
  if (!text) return [];
  const hits = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const { name, regex } of vocab.patterns) {
      const m = lines[i].match(regex);
      if (m) {
        hits.push({
          file: fileRel,
          line: i + 1,
          pattern: name,
          match: m[0],
          context: lines[i].length > 200 ? lines[i].slice(0, 200) + '...' : lines[i],
        });
      }
    }
  }
  return hits;
}

function listTrackedFiles() {
  try {
    const out = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
    return out.split(/\r?\n/).filter(Boolean);
  } catch (e) {
    console.error('Could not list git-tracked files:', e.message);
    process.exit(2);
  }
}

function listStagedDiff() {
  // `--diff-filter=ACMR` excludes deletions/renames without content changes
  // so we only scan added/modified content. `-U0` strips context lines so
  // we only see what the developer actually added.
  try {
    return execSync('git diff --cached --diff-filter=ACMR -U0', {
      cwd: ROOT, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024,
    });
  } catch (e) {
    console.error('git diff failed:', e.message);
    process.exit(2);
  }
}

function scanStagedDiff(vocab) {
  const diff = listStagedDiff();
  if (!diff.trim()) return [];

  const hits = [];
  let currentFile = null;
  let addedLineNum = 0; // best-effort line number in the new file

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice(6);
      addedLineNum = 0;
      continue;
    }
    if (line.startsWith('@@')) {
      // @@ -a,b +c,d @@ — pull c as the starting line of the new hunk
      const m = line.match(/\+(\d+)(?:,\d+)?/);
      addedLineNum = m ? parseInt(m[1], 10) - 1 : 0;
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      addedLineNum++;
      if (!currentFile || isAllowed(currentFile, vocab)) continue;
      const text = line.slice(1);
      for (const { name, regex } of vocab.patterns) {
        const m = text.match(regex);
        if (m) {
          hits.push({
            file: currentFile,
            line: addedLineNum,
            pattern: name,
            match: m[0],
            context: text.length > 200 ? text.slice(0, 200) + '...' : text,
          });
        }
      }
    } else if (line.startsWith(' ')) {
      addedLineNum++;
    }
  }
  return hits;
}

function scanFullRepo(vocab) {
  const hits = [];
  for (const rel of listTrackedFiles()) {
    if (isAllowed(rel, vocab)) continue;
    const ext = path.extname(rel).toLowerCase();
    // Skip binary file types
    if (['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.tar', '.gz',
         '.svg', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.mp4', '.mp3',
         '.sqlite', '.db', '.bin', '.lock'].includes(ext)) continue;

    const abs = path.join(ROOT, rel);
    let content;
    try {
      const stat = fs.statSync(abs);
      if (stat.size > 2 * 1024 * 1024) continue; // skip > 2 MB
      content = fs.readFileSync(abs, 'utf8');
    } catch (_) { continue; }

    hits.push(...scanText(content, rel, vocab));
  }
  return hits;
}

function main() {
  const mode = process.argv.includes('--staged') ? 'staged' : 'full';
  const vocab = loadVocab();
  const hits = mode === 'staged' ? scanStagedDiff(vocab) : scanFullRepo(vocab);

  if (hits.length === 0) {
    console.log(`[sensitive-vocab] ${mode}: clean (${vocab.patterns.length} patterns checked).`);
    process.exit(0);
  }

  console.error('');
  console.error(`[sensitive-vocab] ${mode}: FAILED — ${hits.length} hit(s) in non-allowlisted file(s).`);
  console.error('');
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}  pattern="${h.pattern}"  match="${h.match}"`);
    console.error(`    > ${h.context}`);
  }
  console.error('');
  console.error('Compensation / commission / markup / margin language must not appear in');
  console.error('non-allowlisted files. See Instructions & Skills/preferred-vocabulary.md');
  console.error('for neutral alternates. If a file legitimately implements the compensation');
  console.error('system (model, service, controller, prompt, skill doc), add it to the');
  console.error('allowlist_paths array in scripts/sensitive-vocab.json.');
  console.error('');
  process.exit(1);
}

main();
