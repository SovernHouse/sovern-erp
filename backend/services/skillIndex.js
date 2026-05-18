/**
 * Phase 4.18b — skill-file index + reader.
 *
 * The AI assistant can load any markdown skill file from
 * `backend/skills/` on demand via the MCP tool `read_sovern_skill`.
 * This module is the path-traversal-guarded reader + a cached index
 * of available slugs so the tool description can list what's there
 * without re-reading 24+ files per turn.
 *
 * Production deployment: `backend/skills/` is committed to the repo
 * and ships with every deploy. SKILLS_DIR env var can override the
 * default for local dev (e.g. point at the desktop authoring folder).
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_SKILLS_DIR = path.resolve(__dirname, '..', 'skills');
const SKILLS_DIR = process.env.SKILLS_DIR
  ? path.resolve(process.env.SKILLS_DIR)
  : DEFAULT_SKILLS_DIR;

const CACHE_TTL_MS = 10 * 60 * 1000;
let _cachedIndex = null;
let _cachedAt = 0;

/**
 * Normalises a caller-supplied slug to its on-disk filename and
 * refuses anything that tries to escape the skills directory.
 *
 * Allowed: /^[a-z0-9][a-z0-9_-]{0,80}$/ (case-folded). Bare slug
 * without `.md` extension; the reader appends it.
 *
 * Rejects: absolute paths, anything containing `/` or `\` or `..`,
 * leading dots, empty strings, NUL bytes.
 */
function normaliseSlug(rawSlug) {
  if (typeof rawSlug !== 'string') return null;
  let slug = rawSlug.trim().toLowerCase();
  if (slug.length === 0 || slug.length > 80) return null;
  if (slug.includes('/') || slug.includes('\\')) return null;
  if (slug.includes('..')) return null;
  if (slug.indexOf('\0') !== -1) return null;
  // Strip a trailing `.md` BEFORE applying the slug regex so callers
  // can pass "trade-sales.md" interchangeably with "trade-sales".
  slug = slug.replace(/\.md$/, '');
  if (slug.startsWith('.')) return null;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) return null;
  return slug;
}

/**
 * Build the index: [{ slug, oneLineDescription }, ...]. Reads the
 * first non-empty line of every `.md` in SKILLS_DIR, falling back
 * to the slug if the file has no header. Cached for 10 minutes —
 * skill files don't change between sessions, and we don't want the
 * tool descriptor to re-read 24 files every turn.
 */
function getIndex() {
  const now = Date.now();
  if (_cachedIndex && now - _cachedAt < CACHE_TTL_MS) {
    return _cachedIndex;
  }
  const out = [];
  let entries = [];
  try {
    entries = fs.readdirSync(SKILLS_DIR);
  } catch {
    // Missing skills dir: return empty rather than crash. The tool
    // description will say "no skills available".
    _cachedIndex = [];
    _cachedAt = now;
    return _cachedIndex;
  }
  for (const name of entries) {
    if (!name.toLowerCase().endsWith('.md')) continue;
    const slug = name.replace(/\.md$/i, '');
    if (!normaliseSlug(slug)) continue;
    const fullPath = path.join(SKILLS_DIR, name);
    let oneLine = slug;
    try {
      const fd = fs.openSync(fullPath, 'r');
      const buf = Buffer.alloc(512);
      const n = fs.readSync(fd, buf, 0, 512, 0);
      fs.closeSync(fd);
      const head = buf.slice(0, n).toString('utf8');
      const lines = head.split(/\r?\n/);
      for (const line of lines) {
        const t = line.trim().replace(/^#+\s*/, '');
        if (t) { oneLine = t.slice(0, 120); break; }
      }
    } catch {
      // ignore — fall through with slug as description
    }
    out.push({ slug, oneLineDescription: oneLine });
  }
  out.sort((a, b) => a.slug.localeCompare(b.slug));
  _cachedIndex = out;
  _cachedAt = now;
  return _cachedIndex;
}

/**
 * Read a skill by slug. Returns { slug, content, bytes } on success,
 * or { error } on any failure (unknown slug, path traversal, IO).
 *
 * Refuses silently if the slug fails normaliseSlug — does NOT echo
 * the offending input back so a malicious prompt can't probe the
 * filesystem.
 */
function readSkill(slug) {
  const safe = normaliseSlug(slug);
  if (!safe) {
    return { error: 'Invalid skill name. Use a lowercase slug like "trade-sales" or "brand-safety".' };
  }
  const fullPath = path.join(SKILLS_DIR, `${safe}.md`);
  // Belt-and-braces: ensure the resolved path is still under SKILLS_DIR.
  // (normaliseSlug already rejects path separators, but a symlink in
  // the skills dir itself could redirect. Defence in depth.)
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(path.resolve(SKILLS_DIR) + path.sep) && resolved !== path.resolve(SKILLS_DIR)) {
    return { error: 'Invalid skill name (path traversal refused).' };
  }
  let content;
  try {
    content = fs.readFileSync(resolved, 'utf8');
  } catch (e) {
    return { error: `Skill "${safe}" not found in skills directory.` };
  }
  return {
    slug: safe,
    content,
    bytes: Buffer.byteLength(content, 'utf8'),
  };
}

/** For tests — wipes the cache so subsequent getIndex() re-reads disk. */
function _resetCache() {
  _cachedIndex = null;
  _cachedAt = 0;
}

module.exports = {
  getIndex,
  readSkill,
  normaliseSlug,
  _resetCache,
  SKILLS_DIR,
};
