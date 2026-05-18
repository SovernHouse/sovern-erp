/**
 * voiceRuleLinter — Phase 4.18f.
 *
 * Server-side defence-in-depth for the brand-voice rules codified in
 * the system prompt (Phase 4.18a). Even if the AI fails to apply a
 * rule, this linter catches the violation before persisting the
 * outreach email / lead draft / quotation body.
 *
 * Rules
 *   - Country names ALWAYS Title Case on word boundary.
 *   - Em-dashes replaced with " — " collapsed to ", " (the codebase
 *     standing rule: no em-dashes anywhere in copy).
 *   - "powered by IronLite[...]" rewritten to
 *     "with IronLite Core Technology".
 *
 * The linter is non-throwing — it always returns a result with the
 * cleaned text plus a diff of what was changed. Callers decide
 * whether to log a chatter event when corrections > 0.
 */

// Country / region names that have been observed mis-cased in the
// wild. Keep this list short and high-signal — over-aggressive
// capitalisation would break sentences like "the malay archipelago"
// (region name, lowercase ok) or "south indian" (descriptor, no fix
// needed). Adjust as new offenders surface.
const COUNTRIES = [
  'malaysia', 'china', 'vietnam', 'thailand', 'indonesia', 'philippines',
  'taiwan', 'singapore', 'hong kong', 'japan', 'south korea',
  'cambodia', 'laos', 'myanmar', 'burma', 'bangladesh', 'india',
  'pakistan', 'sri lanka', 'nepal',
  'egypt', 'jordan', 'lebanon', 'israel', 'saudi arabia', 'uae',
  'united arab emirates', 'qatar', 'kuwait', 'bahrain', 'oman', 'iran',
  'iraq', 'syria', 'turkey', 'morocco', 'algeria', 'tunisia', 'libya',
  'south africa', 'kenya', 'nigeria', 'ethiopia', 'ghana',
  'canada', 'united states', 'usa', 'mexico', 'brazil', 'argentina',
  'chile', 'colombia', 'peru', 'venezuela',
  'united kingdom', 'uk', 'germany', 'france', 'spain', 'italy',
  'netherlands', 'belgium', 'poland', 'sweden', 'norway', 'finland',
  'denmark', 'ireland', 'switzerland', 'austria', 'portugal',
  'australia', 'new zealand',
  'russia', 'ukraine',
];

function titleCase(s) {
  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Build the regexes once — each country gets a word-boundary, case-
// insensitive replacer. The regex captures so we can selectively
// re-case only the matched span (multi-word countries like
// "saudi arabia" need full-string replacement).
const COUNTRY_REPLACERS = COUNTRIES.map(c => {
  // Word-boundary regex; multi-word countries use \s+ in the middle
  // to tolerate single or double spaces.
  const words = c.split(' ');
  const pattern = words.map(escapeRegex).join('\\s+');
  return {
    rx: new RegExp(`\\b(${pattern})\\b`, 'gi'),
    replacement: titleCase(c),
    label: c,
  };
});

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns { text, corrections: [{ rule, before, after, count }] }.
 *
 * Caller-supplied `text` may be null/undefined — returns it unchanged
 * with corrections: [] for null-tolerance.
 */
function lint(text, opts = {}) {
  if (typeof text !== 'string' || text.length === 0) {
    return { text: text || '', corrections: [] };
  }
  let out = text;
  const corrections = [];

  // ── Em-dash rewrite ─────────────────────────────────────────────
  // Em-dash (U+2014) and the " -- " double-hyphen approximation both
  // get rewritten to ", " — the codebase's standing punctuation rule.
  // We do em-dash first so the count is accurate before counting
  // remaining rules' impact on it.
  const emDashCount = (out.match(/—|--/g) || []).length;
  if (emDashCount > 0) {
    out = out
      .replace(/\s*—\s*/g, ', ')
      .replace(/\s*--\s*/g, ', ');
    corrections.push({
      rule: 'no-em-dash',
      before: '—',
      after: ', ',
      count: emDashCount,
    });
  }

  // ── IronLite phrasing rewrite ───────────────────────────────────
  // "powered by IronLite[...]" / "powered by IronLite Core" → standard
  // phrasing. Match the offending preposition + the IronLite token,
  // then re-emit "with IronLite Core Technology". Case-insensitive on
  // "powered by", case-sensitive on "IronLite" (it's a brand name,
  // shouldn't have been lowercased anyway).
  const poweredByRx = /\bpowered by ironlite( core)?( technology)?\b/gi;
  const poweredByCount = (out.match(poweredByRx) || []).length;
  if (poweredByCount > 0) {
    out = out.replace(poweredByRx, 'with IronLite Core Technology');
    corrections.push({
      rule: 'ironlite-phrasing',
      before: 'powered by IronLite',
      after: 'with IronLite Core Technology',
      count: poweredByCount,
    });
  }

  // ── Country names — Title Case ─────────────────────────────────
  // Iterate each country regex. Count up corrections (we only count
  // when the case actually changed, not when the text already had
  // Title Case).
  let totalCountryFixes = 0;
  for (const { rx, replacement, label } of COUNTRY_REPLACERS) {
    out = out.replace(rx, (match) => {
      if (match === replacement) return match;
      totalCountryFixes += 1;
      return replacement;
    });
  }
  if (totalCountryFixes > 0) {
    corrections.push({
      rule: 'country-title-case',
      before: 'lowercase country names',
      after: 'Title Case country names',
      count: totalCountryFixes,
    });
  }

  return { text: out, corrections };
}

/**
 * Convenience: lint a {subject, bodyText} object in one call,
 * returning a combined corrections list with field labels.
 */
function lintEmailParts({ subject, bodyText } = {}) {
  const subjectRes = lint(subject);
  const bodyRes = lint(bodyText);
  return {
    subject: subjectRes.text,
    bodyText: bodyRes.text,
    corrections: [
      ...subjectRes.corrections.map(c => ({ ...c, field: 'subject' })),
      ...bodyRes.corrections.map(c => ({ ...c, field: 'bodyText' })),
    ],
  };
}

module.exports = { lint, lintEmailParts, COUNTRIES };
