/**
 * Phase 4, C18 — sanctions screening.
 *
 * Two responsibilities:
 *   1. Refresh sanctions data from 4 public lists (OFAC SDN, OFAC
 *      Consolidated, EU, UN). Files land in backend/data/sanctions/.
 *      Atomic write via .tmp + rename so a half-fetch never replaces a
 *      good cache.
 *   2. Screen a (name, country) pair against the cached lists. Returns
 *      { status, hits, screenedAt } where status is one of:
 *        - cleared          : no hits
 *        - flagged          : exact (case-insensitive) name match
 *        - requires_review  : fuzzy match (Levenshtein ratio >= 0.85)
 *      Country gating reduces false positives:
 *        - country overlap with hit raises confidence
 *        - no overlap downgrades fuzzy `requires_review` to `cleared`
 *        - no overlap with exact match downgrades flagged to
 *          requires_review (so country mismatches don't auto-block)
 *
 * The 4 hit lists are parsed once per mtime change and cached in
 * memory. Memory footprint at current list sizes is well under 50MB
 * combined. List access during a screen is synchronous after the
 * initial async parse.
 *
 * No external dependencies. The Levenshtein implementation is inline
 * (~30 lines) so the deploy doesn't need a new package install.
 *
 * Safety: refresh failures retain the last-known-good cache. The
 * screenName fast path returns `pending` (not `cleared`) when no data
 * has ever been fetched, so a never-refreshed install never silently
 * waves traffic through.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const logger = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '..', 'data', 'sanctions');
const META_FILE = path.join(DATA_DIR, 'last_refresh.json');

// ───────────────────────────────────────────────────────────────────────────
// Sources

const SOURCES = [
  {
    key: 'ofac_sdn',
    label: 'OFAC SDN',
    url: 'https://www.treasury.gov/ofac/downloads/sdn.csv',
    file: 'ofac_sdn.csv',
    format: 'csv',
    // OFAC SDN columns: ent_num, sdn_name, sdn_type, program, title, call_sign, vess_type, tonnage, grt, vess_flag, vess_owner, remarks
    parser: parseOfacCsv,
  },
  {
    key: 'ofac_consolidated',
    label: 'OFAC Consolidated',
    url: 'https://www.treasury.gov/ofac/downloads/consolidated/cons_prim.csv',
    file: 'ofac_consolidated.csv',
    format: 'csv',
    parser: parseOfacCsv,
  },
  {
    key: 'eu_consolidated',
    label: 'EU Consolidated',
    url: 'https://webgate.ec.europa.eu/europeaid/fsd/fsf/public/files/csvFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw==',
    file: 'eu_consolidated.csv',
    format: 'csv',
    parser: parseEuCsv,
  },
  {
    key: 'un_consolidated',
    label: 'UN Consolidated',
    url: 'https://scsanctions.un.org/resources/xml/en/consolidated.xml',
    file: 'un_consolidated.xml',
    format: 'xml',
    parser: parseUnXml,
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Data fetching

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function downloadOnce(url, dest) {
  return new Promise((resolve, reject) => {
    const tmp = dest + '.tmp';
    const file = fs.createWriteStream(tmp);
    const req = https.get(url, { timeout: 60_000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow one redirect.
        file.close();
        try { fs.unlinkSync(tmp); } catch {}
        return downloadOnce(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(tmp); } catch {}
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          try {
            fs.renameSync(tmp, dest);
            resolve();
          } catch (e) { reject(e); }
        });
      });
    });
    req.on('error', (err) => {
      file.close();
      try { fs.unlinkSync(tmp); } catch {}
      reject(err);
    });
    req.on('timeout', () => {
      req.destroy(new Error(`Timeout downloading ${url}`));
    });
  });
}

async function refreshSanctionsData() {
  ensureDir();
  const results = [];
  for (const src of SOURCES) {
    const dest = path.join(DATA_DIR, src.file);
    try {
      await downloadOnce(src.url, dest);
      const stat = fs.statSync(dest);
      results.push({ key: src.key, ok: true, bytes: stat.size, mtime: stat.mtime.toISOString() });
      logger.info(`[sanctions] refreshed ${src.label} (${stat.size} bytes)`);
    } catch (err) {
      results.push({ key: src.key, ok: false, error: err.message });
      logger.warn(`[sanctions] refresh failed for ${src.label}: ${err.message}`);
    }
  }
  // Bust the parsed cache so the next screen re-reads.
  parsedCache = { mtime: 0, entries: [] };
  // Write a last-refresh manifest.
  try {
    fs.writeFileSync(META_FILE, JSON.stringify({
      lastRefreshedAt: new Date().toISOString(),
      sources: results,
    }, null, 2));
  } catch (e) {
    logger.warn('[sanctions] could not write meta:', e.message);
  }
  return results;
}

// ───────────────────────────────────────────────────────────────────────────
// Parsers — produce a uniform { name, country, list, raw } shape.

function splitCsvLine(line) {
  // Minimal CSV splitter: handles quoted fields and embedded commas.
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function parseOfacCsv(text, listLabel) {
  // OFAC SDN format has no header. Columns we care about:
  //   col[1] = sdn_name
  //   col[11] = remarks (often includes country)
  const entries = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = splitCsvLine(line);
    const name = (cols[1] || '').trim();
    if (!name) continue;
    const remarks = (cols[11] || '').trim();
    // Extract a country hint from remarks if it appears as "Country: X" or similar.
    const countryMatch = remarks.match(/Country[:\s]+([A-Z][a-zA-Z ]{2,40})/);
    entries.push({
      name,
      country: countryMatch ? countryMatch[1].trim() : null,
      list: listLabel,
      raw: { remarks },
    });
  }
  return entries;
}

function parseEuCsv(text) {
  // EU consolidated CSV has a header row. We parse generically and look
  // for likely name + country columns.
  const entries = [];
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return entries;
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const nameIdx = header.findIndex((h) => h.includes('namealias') || h.includes('whole_name') || h === 'name');
  const countryIdx = header.findIndex((h) => h.includes('country'));
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = splitCsvLine(lines[i]);
    const name = (nameIdx >= 0 ? cols[nameIdx] : cols[0] || '').trim();
    if (!name) continue;
    const country = countryIdx >= 0 ? (cols[countryIdx] || '').trim() : null;
    entries.push({
      name,
      country: country || null,
      list: 'EU Consolidated',
      raw: {},
    });
  }
  return entries;
}

function parseUnXml(text) {
  // UN sanctions XML uses <INDIVIDUAL> and <ENTITY> elements with
  // <FIRST_NAME> / <SECOND_NAME> / <THIRD_NAME> for individuals and
  // <FIRST_NAME> only for entities. We extract whatever name fields
  // we find. Regex-based; XML libs aren't worth a dep here.
  const entries = [];
  // Match each top-level person/entity block.
  const blockRegex = /<(INDIVIDUAL|ENTITY)>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = blockRegex.exec(text)) !== null) {
    const body = m[2];
    const parts = ['FIRST_NAME', 'SECOND_NAME', 'THIRD_NAME', 'FOURTH_NAME']
      .map((tag) => {
        const tm = body.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
        return tm ? tm[1].trim() : '';
      })
      .filter(Boolean);
    const name = parts.join(' ').trim();
    if (!name) continue;
    const countryMatch = body.match(/<COUNTRY>([^<]*)<\/COUNTRY>/);
    entries.push({
      name,
      country: countryMatch ? countryMatch[1].trim() : null,
      list: 'UN Consolidated',
      raw: {},
    });
  }
  return entries;
}

// ───────────────────────────────────────────────────────────────────────────
// Parsed cache (in-memory)

let parsedCache = { mtime: 0, entries: [] };

function loadParsed() {
  if (!fs.existsSync(DATA_DIR)) return parsedCache;
  // mtime invalidation: take the max mtime across all source files.
  let maxMtime = 0;
  const present = [];
  for (const src of SOURCES) {
    const fp = path.join(DATA_DIR, src.file);
    if (!fs.existsSync(fp)) continue;
    const stat = fs.statSync(fp);
    if (stat.mtimeMs > maxMtime) maxMtime = stat.mtimeMs;
    present.push({ src, fp });
  }
  if (maxMtime === parsedCache.mtime && parsedCache.entries.length) {
    return parsedCache;
  }
  const entries = [];
  for (const { src, fp } of present) {
    try {
      const text = fs.readFileSync(fp, 'utf8');
      const parsed = src.parser(text, src.label);
      entries.push(...parsed);
    } catch (e) {
      logger.warn(`[sanctions] parse error in ${src.label}:`, e.message);
    }
  }
  parsedCache = { mtime: maxMtime, entries };
  logger.info(`[sanctions] parsed ${entries.length} hit records across ${present.length} list(s)`);
  return parsedCache;
}

// ───────────────────────────────────────────────────────────────────────────
// String similarity (Levenshtein-based ratio)

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length, n = b.length;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function similarityRatio(a, b) {
  const al = a.length, bl = b.length;
  if (!al && !bl) return 1;
  const dist = levenshtein(a, b);
  const longest = Math.max(al, bl);
  return 1 - dist / longest;
}

function normalize(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[.,'"`’]/g, '')
    .replace(/\s+(ltd|llc|inc|co|corp|corporation|gmbh|sa|sas|bv|kft|sl|srl|sdn|bhd|pty|s\.?p\.?a\.?)\.?$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ───────────────────────────────────────────────────────────────────────────
// Screening

/**
 * Screen a (name, country) pair against all loaded sanctions lists.
 *
 * @param {string} name      Company or individual name to check.
 * @param {string} country   ISO country name (e.g. "Iran", "Russia"). Optional.
 * @returns {{status, hits, screenedAt}}
 *
 * Returns `pending` (not `cleared`) when no list data is loaded yet so
 * a fresh install with cold cache never silently waves traffic through.
 */
function screenName(name, country) {
  const screenedAt = new Date().toISOString();
  const { entries } = loadParsed();

  if (!entries.length) {
    // No data loaded — treat as pending. Callers should kick a refresh
    // and re-screen, but the entity is not blocked.
    return { status: 'pending', hits: [], screenedAt };
  }

  const normName = normalize(name);
  const normCountry = (country || '').toLowerCase().trim();
  if (!normName) return { status: 'cleared', hits: [], screenedAt };

  const exact = [];
  const fuzzy = [];
  const FUZZY_THRESHOLD = 0.85;

  for (const entry of entries) {
    const entryNorm = normalize(entry.name);
    if (!entryNorm) continue;
    if (entryNorm === normName) {
      const countryOverlap = !!normCountry
        && !!entry.country
        && entry.country.toLowerCase().includes(normCountry);
      exact.push({
        list: entry.list,
        matchedName: entry.name,
        country: entry.country || null,
        score: 1.0,
        countryOverlap,
      });
      continue;
    }
    // Fuzzy: only score if length is close enough to avoid scoring every pair.
    if (Math.abs(entryNorm.length - normName.length) > 4) continue;
    const ratio = similarityRatio(entryNorm, normName);
    if (ratio >= FUZZY_THRESHOLD) {
      const countryOverlap = !!normCountry
        && !!entry.country
        && entry.country.toLowerCase().includes(normCountry);
      fuzzy.push({
        list: entry.list,
        matchedName: entry.name,
        country: entry.country || null,
        score: ratio,
        countryOverlap,
      });
    }
  }

  if (exact.length) {
    const anyOverlap = exact.some((h) => h.countryOverlap);
    // Exact name + no country overlap is a likely false positive
    // (different company with the same name). Demote to review.
    const status = (!normCountry || anyOverlap) ? 'flagged' : 'requires_review';
    return { status, hits: exact.concat(fuzzy), screenedAt };
  }

  if (fuzzy.length) {
    const anyOverlap = fuzzy.some((h) => h.countryOverlap);
    if (!normCountry || anyOverlap) {
      return { status: 'requires_review', hits: fuzzy, screenedAt };
    }
    // Fuzzy + no country overlap → cleared (too noisy otherwise).
    return { status: 'cleared', hits: [], screenedAt };
  }

  return { status: 'cleared', hits: [], screenedAt };
}

// ───────────────────────────────────────────────────────────────────────────
// Status (for the admin status panel)

function getSanctionsStatus() {
  let lastRefreshedAt = null;
  let sources = [];
  if (fs.existsSync(META_FILE)) {
    try {
      const j = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
      lastRefreshedAt = j.lastRefreshedAt || null;
      sources = j.sources || [];
    } catch {}
  }
  const listSizes = {};
  for (const src of SOURCES) {
    const fp = path.join(DATA_DIR, src.file);
    listSizes[src.key] = fs.existsSync(fp) ? fs.statSync(fp).size : 0;
  }
  const { entries } = loadParsed();
  return {
    lastRefreshedAt,
    sources,
    listSizes,
    parsedEntries: entries.length,
    refreshEnabled: process.env.SCHEDULER_SANCTIONS_REFRESH !== 'false',
    rescreenEnabled: process.env.SCHEDULER_SANCTIONS_RESCREEN !== 'false',
  };
}

module.exports = {
  refreshSanctionsData,
  screenName,
  getSanctionsStatus,
  DATA_DIR,
};
