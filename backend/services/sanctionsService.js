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
    // Phase 4.13.6: switched to the SLS direct path. The legacy
    // www.treasury.gov/ofac/downloads/sdn.csv redirects here anyway,
    // but Node's https.get follows redirects without re-applying request
    // headers in some library versions — pointing direct removes that
    // edge case.
    url: 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV',
    file: 'ofac_sdn.csv',
    format: 'csv',
    // OFAC SDN columns: ent_num, sdn_name, sdn_type, program, title, call_sign, vess_type, tonnage, grt, vess_flag, vess_owner, remarks
    parser: parseOfacCsv,
  },
  {
    key: 'ofac_consolidated',
    label: 'OFAC Consolidated',
    // Phase 4.13.6: OFAC renamed cons_prim.csv → consolidated.csv on the
    // SLS path. The legacy treasury.gov/ofac/downloads/consolidated/
    // path now 400s on the cons_prim.csv filename; the new SLS path with
    // consolidated.csv returns 200 (verified 2026-05-16).
    url: 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/consolidated.csv',
    file: 'ofac_consolidated.csv',
    format: 'csv',
    parser: parseOfacCsv,
  },
  {
    key: 'eu_consolidated',
    label: 'EU Consolidated',
    // Phase 4.13.6: dropped the trailing == base64 padding from the
    // token (matches what the EU webgate RSS feed publishes). Both
    // padded and unpadded forms currently return HTTP 500 with a
    // server-side "Internal Server Error" JSON body — the bug is on
    // EU webgate's side; this URL change is cosmetic. The
    // failure-streak alert (added in this commit) will catch the
    // upstream outage at the 3-day mark.
    url: 'https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw',
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

// Phase 4.13.6: OFAC's sanctionslistservice and EU's webgate both reject
// Node's default User-Agent (returns 403 / 406). curl works because it
// sends a recognised UA. We send a polite, contactable UA so an
// admin upstream can identify our traffic if they ever need to.
const REQUEST_HEADERS = {
  'User-Agent': 'SovernHouseERP/1.0 (+https://erp.sovernhouse.co; sanctions-list-refresher)',
  'Accept': '*/*',
};

function downloadOnce(url, dest) {
  return new Promise((resolve, reject) => {
    const tmp = dest + '.tmp';
    const file = fs.createWriteStream(tmp);
    const req = https.get(url, { timeout: 60_000, headers: REQUEST_HEADERS }, (res) => {
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
// Phase 4.13a — Jurisdiction screening (OFAC comprehensive countries).
//
// The fuzzy-name screener above can't catch a Lead/Customer based on
// country alone — it requires a name match against the SDN list. That
// left a real production false-negative: an entity in Iran with no
// recognisable name slipped through as `cleared`. This block enforces
// the OFAC comprehensive sanctions programs: any entity whose country
// matches the JURISDICTION_BLOCK set is flagged regardless of name.
//
// Hardcoded set is intentional for 4.13a (per spec). 4.13d moves this
// to a DB-backed JurisdictionRule table for the full authority/scope
// matrix. Until then, additions need a code commit + deploy — acceptable
// because OFAC comprehensive sanctions change rarely (Cuba 1963, Iran
// 1979, DPRK 2008, Syria 2004 — all stable for years).
//
// Citations on every basis string so the AuditLog row carries the
// underlying regulation reference for any human reviewing the block.

const JURISDICTION_BLOCK = new Map([
  ['IR', { country: 'Iran', basis: 'OFAC comprehensive sanctions — Iran (ITSR 31 CFR Part 560 / EO 13599)', authority: 'OFAC' }],
  ['CU', { country: 'Cuba', basis: 'OFAC comprehensive sanctions — Cuba (CACR 31 CFR Part 515)', authority: 'OFAC' }],
  ['KP', { country: 'North Korea', basis: 'OFAC comprehensive sanctions — DPRK (NKSR 31 CFR Part 510)', authority: 'OFAC' }],
  ['SY', { country: 'Syria', basis: 'OFAC comprehensive sanctions — Syria (SySR 31 CFR Part 542)', authority: 'OFAC' }],
]);

// Case-insensitive alias map: any user-typed country variant must
// normalise to one of the JURISDICTION_BLOCK keys. Unknown countries
// fall through to "not sanctioned by jurisdiction" — false positives
// on legitimate counterparties are worse than the override path that
// 4.13c adds for the rare legitimate false negative.
const COUNTRY_ALIASES = new Map([
  // Iran
  ['ir', 'IR'], ['iran', 'IR'], ['islamic republic of iran', 'IR'],
  ['the islamic republic of iran', 'IR'], ['persia', 'IR'],
  // Cuba
  ['cu', 'CU'], ['cuba', 'CU'], ['republic of cuba', 'CU'],
  // North Korea
  ['kp', 'KP'], ['north korea', 'KP'], ['dprk', 'KP'],
  ["democratic people's republic of korea", 'KP'],
  ['korea, democratic peoples republic of', 'KP'],
  ["korea, democratic people's republic of", 'KP'],
  // Syria
  ['sy', 'SY'], ['syria', 'SY'], ['syrian arab republic', 'SY'],
]);

function normalizeCountry(country) {
  if (country == null) return '';
  return String(country)
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')          // strip parentheticals: "Iran (Islamic Republic of)" → "iran "
    .replace(/[.,;]/g, '')               // strip common punctuation
    .replace(/\s+/g, ' ')                // collapse whitespace
    .trim();
}

/**
 * Screen a country string against OFAC comprehensive sanctions
 * jurisdictions (Phase 4.13a). Independent of name screening — a
 * matched jurisdiction blocks regardless of whether the name appears
 * on any SDN list.
 *
 * @param {string} country   Free-text country, ISO-2 code, or alias.
 * @returns {{status: 'flagged'|'cleared', hits: Array, screenedAt: string}}
 *
 * status='flagged' on a jurisdiction match; 'cleared' on miss or empty
 * input. Empty country is intentionally NOT 'pending' — we don't want
 * to block legitimate creates on missing data. Compliance correctness
 * lives in screenName composing both signals.
 */
function screenJurisdiction(country) {
  const screenedAt = new Date().toISOString();
  const norm = normalizeCountry(country);
  if (!norm) return { status: 'cleared', hits: [], screenedAt };

  // Try direct ISO-2 first (cheap), then alias map.
  const upper = norm.toUpperCase();
  let code = JURISDICTION_BLOCK.has(upper) ? upper : null;
  if (!code) code = COUNTRY_ALIASES.get(norm) || null;

  if (!code) return { status: 'cleared', hits: [], screenedAt };

  const rule = JURISDICTION_BLOCK.get(code);
  return {
    status: 'flagged',
    hits: [{
      rule: 'jurisdiction',
      basis: rule.basis,
      authority: rule.authority,
      matched: `country=${rule.country}`,
      reviewer: 'automated_screen',
      timestamp: screenedAt,
    }],
    screenedAt,
  };
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
 *
 * Phase 4.13a: composes name screen with jurisdiction screen. A
 * jurisdiction match alone is sufficient to flag; either signal can
 * trigger 'flagged'. When both signals trigger, the hits arrays are
 * combined so the audit row carries every reason.
 */
function screenName(name, country) {
  const screenedAt = new Date().toISOString();

  // Phase 4.13a: jurisdiction screen runs first and unconditionally.
  // A comprehensively-sanctioned country flags the entity regardless
  // of name match, no data refresh, or empty name. The result merges
  // with the name screen below so the audit hits carry every reason.
  const jurisdictionResult = screenJurisdiction(country);

  const { entries } = loadParsed();

  if (!entries.length) {
    // No data loaded — name screen is pending. Jurisdiction signal
    // still stands on its own; if it flagged, return the block. Else
    // surface 'pending' so callers know the name-list is stale.
    if (jurisdictionResult.status === 'flagged') {
      return { status: 'flagged', hits: jurisdictionResult.hits, screenedAt };
    }
    return { status: 'pending', hits: [], screenedAt };
  }

  const normName = normalize(name);
  const normCountry = (country || '').toLowerCase().trim();
  if (!normName) {
    // Empty name: defer to jurisdiction. Previously returned 'cleared'
    // unconditionally — that was the gap that let the Iran lead through.
    if (jurisdictionResult.status === 'flagged') {
      return { status: 'flagged', hits: jurisdictionResult.hits, screenedAt };
    }
    return { status: 'cleared', hits: [], screenedAt };
  }

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

  // Phase 4.13a: jurisdiction signal upgrades the final status. A
  // jurisdiction match alone is enough to flag; combined with a name
  // hit, both reasons land in the hits array.
  const jurisdictionHits = jurisdictionResult.status === 'flagged'
    ? jurisdictionResult.hits
    : [];

  if (exact.length) {
    const anyOverlap = exact.some((h) => h.countryOverlap);
    // Exact name + no country overlap is a likely false positive
    // (different company with the same name). Demote to review.
    let status = (!normCountry || anyOverlap) ? 'flagged' : 'requires_review';
    // Jurisdiction flag promotes to 'flagged' regardless of name overlap.
    if (jurisdictionHits.length) status = 'flagged';
    return { status, hits: jurisdictionHits.concat(exact, fuzzy), screenedAt };
  }

  if (fuzzy.length) {
    const anyOverlap = fuzzy.some((h) => h.countryOverlap);
    if (jurisdictionHits.length) {
      // Jurisdiction match — flag regardless of fuzzy name overlap.
      return { status: 'flagged', hits: jurisdictionHits.concat(fuzzy), screenedAt };
    }
    if (!normCountry || anyOverlap) {
      return { status: 'requires_review', hits: fuzzy, screenedAt };
    }
    // Fuzzy + no country overlap → cleared (too noisy otherwise).
    return { status: 'cleared', hits: [], screenedAt };
  }

  // No name hits. Defer to jurisdiction.
  if (jurisdictionHits.length) {
    return { status: 'flagged', hits: jurisdictionHits, screenedAt };
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

// Phase 4.13.6: detect sources that have been failing for N+ consecutive
// daily refresh runs. Scans the most recent sanctions_refresh AuditLog
// rows (newest first), walks each source's per-run result, and reports
// any source whose latest run failed AND whose last `thresholdDays` runs
// all failed.
//
// Returns: array of { key, label, consecutiveFailures, latestError }.
// Empty array when no source is in a failure streak (the happy case).
//
// thresholdDays defaults to 3 per the Phase 4.13.6 spec. lookbackDays
// caps how far back the scan goes (defensive: avoids unbounded scans on
// long-running installs).
async function checkRefreshFailureStreaks(db, { thresholdDays = 3, lookbackDays = 7 } = {}) {
  if (!db?.AuditLog) return [];
  const { Op } = require('sequelize');
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const rows = await db.AuditLog.findAll({
    where: { action: 'sanctions_refresh', createdAt: { [Op.gte]: since } },
    order: [['createdAt', 'DESC']],
    limit: 14,  // 2× lookbackDays in case refresh runs more than daily
  });

  // Build per-source ordered failure series from newest to oldest.
  const seriesByKey = new Map();
  for (const row of rows) {
    const results = row.changes?.results || [];
    for (const r of results) {
      const arr = seriesByKey.get(r.key) || [];
      arr.push({ ok: !!r.ok, error: r.error || null, at: row.createdAt });
      seriesByKey.set(r.key, arr);
    }
  }

  const alerts = [];
  for (const [key, series] of seriesByKey) {
    if (series.length < thresholdDays) continue;
    // Latest must be a failure for the alert to fire.
    if (series[0].ok) continue;
    // Count consecutive failures from the newest row.
    let streak = 0;
    for (const entry of series) {
      if (!entry.ok) streak++;
      else break;
    }
    if (streak >= thresholdDays) {
      const label = (SOURCES.find(s => s.key === key) || {}).label || key;
      alerts.push({
        key,
        label,
        consecutiveFailures: streak,
        latestError: series[0].error,
      });
    }
  }
  return alerts;
}

module.exports = {
  refreshSanctionsData,
  screenName,
  screenJurisdiction,
  getSanctionsStatus,
  checkRefreshFailureStreaks,
  DATA_DIR,
  // Exposed for tests and for the 4.13a backfill migration.
  JURISDICTION_BLOCK,
  COUNTRY_ALIASES,
  SOURCES,
};
