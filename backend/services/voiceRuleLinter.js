/**
 * voiceRuleLinter — Phase 4.18f (extended 2026-05-18 per new product
 * skill files: backend/skills/product-ironlite-core.md and
 * backend/skills/product-flooring-industry.md).
 *
 * Server-side defence-in-depth for the brand-voice rules codified by
 * the two product skill files and the company profile. Even if the AI
 * fails to apply a rule, this linter catches the violation before the
 * draft / outreach is persisted.
 *
 * Rules
 *   1. Country names ALWAYS Title Case on word boundary.
 *   2. Em-dashes (— and --) replaced with ", ".
 *   3. "powered by IronLite[...]" rewritten to
 *      "with IronLite Core Technology".
 *   4. US spellings rewritten to British English (organise, finalise,
 *      colour, programme, metre, fibre, behaviour, aluminium,
 *      optimisation, and inflections).
 *   5. "trader" / "middleman" in a Sovern/FW/HH sentence context
 *      rewritten to brand-correct framing: "buying house in Asia"
 *      for SH, "factory" for FW/HH.
 *   6. "trading company" in a Sovern sentence context rewritten to
 *      "buying house in Asia".
 *   7. "JetCore" stripped — always rewritten to "IronLite Core". This
 *      is the IronLite skill's hardest rule: JetCore is the parallel
 *      ingredient brand on the same production line and must never
 *      appear in customer-facing output.
 *   8. Sovern compensation language (commission / sourcing fee /
 *      buying commission / agency fee / markup) in a Sovern sentence
 *      context replaced with the approved deflection: "Alex will
 *      confirm our commercial terms with you directly."
 *   9. "40HC" rewritten to "40 HQ" — the customer-facing container
 *      abbreviation per the flooring skill's vocabulary section.
 *
 * Order matters: em-dash first so the comma rewrites cleanly. JetCore
 * + British spellings before country Title Case so the cleaned text
 * is what gets case-corrected. Sovern-context rewrites last because
 * they're sentence-scoped and operate on already-normalised words.
 *
 * The linter is non-throwing. Returns { text, corrections } where
 * corrections is an array of { rule, before, after, count } so the
 * caller can audit-log + post a chatter event when corrections > 0.
 */

// Country names commonly miscased in cold-email drafts. Keep this
// list high-signal — over-aggressive capitalisation breaks region
// descriptors. Whole-word match only via \b.
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

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const COUNTRY_REPLACERS = COUNTRIES.map(c => {
  const words = c.split(' ');
  const pattern = words.map(escapeRegex).join('\\s+');
  return {
    rx: new RegExp(`\\b(${pattern})\\b`, 'gi'),
    replacement: titleCase(c),
    label: c,
  };
});

// British English spellings. Each entry rewrites US → UK with case
// preservation (lowercase / Title Case / ALL CAPS). The list is
// intentionally narrow — drift here would over-correct.
const UK_SPELLINGS = [
  // organise family
  { us: 'organize', uk: 'organise' },
  { us: 'organizes', uk: 'organises' },
  { us: 'organized', uk: 'organised' },
  { us: 'organizing', uk: 'organising' },
  { us: 'organization', uk: 'organisation' },
  { us: 'organizations', uk: 'organisations' },
  { us: 'organizational', uk: 'organisational' },
  // finalise family
  { us: 'finalize', uk: 'finalise' },
  { us: 'finalizes', uk: 'finalises' },
  { us: 'finalized', uk: 'finalised' },
  { us: 'finalizing', uk: 'finalising' },
  // optimise family
  { us: 'optimize', uk: 'optimise' },
  { us: 'optimizes', uk: 'optimises' },
  { us: 'optimized', uk: 'optimised' },
  { us: 'optimizing', uk: 'optimising' },
  { us: 'optimization', uk: 'optimisation' },
  { us: 'optimizations', uk: 'optimisations' },
  // colour family
  { us: 'color', uk: 'colour' },
  { us: 'colors', uk: 'colours' },
  { us: 'colored', uk: 'coloured' },
  { us: 'coloring', uk: 'colouring' },
  { us: 'colorful', uk: 'colourful' },
  // programme (note: in British English, "program" is reserved for
  // software/computer; "programme" is plan/schedule. Trade copy is
  // not software, so default to programme.)
  { us: 'program', uk: 'programme' },
  { us: 'programs', uk: 'programmes' },
  // metre (length unit; British "metre" rather than the device-name
  // sense which is also "meter" in UK — accept the trade-copy default)
  { us: 'meter', uk: 'metre' },
  { us: 'meters', uk: 'metres' },
  // fibre
  { us: 'fiber', uk: 'fibre' },
  { us: 'fibers', uk: 'fibres' },
  // behaviour
  { us: 'behavior', uk: 'behaviour' },
  { us: 'behaviors', uk: 'behaviours' },
  { us: 'behavioral', uk: 'behavioural' },
  // aluminium
  { us: 'aluminum', uk: 'aluminium' },
];

function preserveCase(match, replacement) {
  if (match.length > 1 && match === match.toUpperCase()) {
    return replacement.toUpperCase();
  }
  if (match[0] === match[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

// Pre-compiled regex per UK spelling.
const UK_REPLACERS = UK_SPELLINGS.map(({ us, uk }) => ({
  rx: new RegExp(`\\b${us}\\b`, 'gi'),
  uk,
  us,
}));

// Brand marker pattern. Used by the sentence-scoped Sovern-context
// rewrites (rules 5/6/8). Case-insensitive whole-word match.
const SH_MARKER_RX = /\b(sovern(\s+house)?|SH)\b/i;
const FW_HH_MARKER_RX = /\b(florway|fw|hanhua|anhui\s+hanhua|hh)\b/i;
const ANY_BRAND_MARKER_RX = new RegExp(
  `${SH_MARKER_RX.source}|${FW_HH_MARKER_RX.source}`,
  'i'
);

// Sentence splitter. Preserves the trailing delimiter so we can
// rebuild the original text without losing punctuation.
function splitSentences(text) {
  // Match a run of non-delimiter chars + a delimiter (or end of input).
  // Delimiters: . ! ? ; newline.
  const parts = [];
  const rx = /[^.!?;\n]*[.!?;\n]?/g;
  let m;
  while ((m = rx.exec(text)) !== null) {
    if (m[0].length === 0) break;
    parts.push(m[0]);
  }
  return parts;
}

// ── Rule implementations ──────────────────────────────────────────

function applyEmDash(text) {
  const count = (text.match(/—|--/g) || []).length;
  if (count === 0) return { text, count: 0 };
  const out = text
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*--\s*/g, ', ');
  return { text: out, count };
}

function applyIronLite(text) {
  const rx = /\bpowered by ironlite( core)?( technology)?\b/gi;
  const count = (text.match(rx) || []).length;
  if (count === 0) return { text, count: 0 };
  return { text: text.replace(rx, 'with IronLite Core Technology'), count };
}

function applyJetCore(text) {
  // JetCore must NEVER appear in customer-facing output per the
  // IronLite skill rule #1. Replace with IronLite Core (the
  // approved-name technology equivalent). Whole-word, case-insensitive.
  const rx = /\bjetcore\b/gi;
  const count = (text.match(rx) || []).length;
  if (count === 0) return { text, count: 0 };
  return { text: text.replace(rx, 'IronLite Core'), count };
}

function applyUkSpellings(text) {
  let out = text;
  let total = 0;
  for (const { rx, uk } of UK_REPLACERS) {
    out = out.replace(rx, (match) => {
      total += 1;
      return preserveCase(match, uk);
    });
  }
  return { text: out, count: total };
}

function applyCountryTitleCase(text) {
  let out = text;
  let total = 0;
  for (const { rx, replacement } of COUNTRY_REPLACERS) {
    out = out.replace(rx, (match) => {
      if (match === replacement) return match;
      total += 1;
      return replacement;
    });
  }
  return { text: out, count: total };
}

function applyContainerAbbrev(text) {
  // 40HC → 40 HQ. Customer-facing per flooring skill vocabulary.
  // Match "40HC", "40 HC", "40-HC" (case-insensitive).
  const rx = /\b40[\s-]?HC\b/gi;
  const count = (text.match(rx) || []).length;
  if (count === 0) return { text, count: 0 };
  return { text: text.replace(rx, '40 HQ'), count };
}

function applyTraderMiddleman(text) {
  // Sentence-scoped. If a sentence contains a Sovern/FW/HH marker AND
  // "trader" or "middleman", rewrite. SH context → "buying house in
  // Asia". FW/HH context → "factory" (or "production line" if more
  // contextual; we default to "factory" for simplicity — the term
  // matches both seeded brand signatures).
  const parts = splitSentences(text);
  let total = 0;
  const rewritten = parts.map(sentence => {
    const traderRx = /\b(trader|middleman)\b/gi;
    if (!traderRx.test(sentence)) return sentence;
    if (!ANY_BRAND_MARKER_RX.test(sentence)) return sentence;

    const isFwHh = FW_HH_MARKER_RX.test(sentence) && !SH_MARKER_RX.test(sentence);
    const replacement = isFwHh ? 'factory' : 'buying house in Asia';

    return sentence.replace(/\b(trader|middleman)\b/gi, () => {
      total += 1;
      return replacement;
    });
  });
  return { text: rewritten.join(''), count: total };
}

function applyTradingCompany(text) {
  // Sentence-scoped. "trading company" in a Sovern sentence context
  // → "buying house in Asia".
  const parts = splitSentences(text);
  let total = 0;
  const rewritten = parts.map(sentence => {
    const tcRx = /\btrading\s+company\b/gi;
    if (!tcRx.test(sentence)) return sentence;
    if (!SH_MARKER_RX.test(sentence)) return sentence;
    return sentence.replace(/\btrading\s+company\b/gi, () => {
      total += 1;
      return 'buying house in Asia';
    });
  });
  return { text: rewritten.join(''), count: total };
}

function applySovernCompensation(text) {
  // Sentence-scoped. If a sentence contains a Sovern marker AND any
  // of [commission, sourcing fee, buying commission, agency fee,
  // markup], rewrite the entire sentence to the approved deflection
  // from product-ironlite-core.md rule #10:
  //   "Alex will confirm our commercial terms with you directly."
  // This is a big transform; only fires when both signals are
  // present so legitimate commission language about competitors or
  // brokers passes through.
  const compensationRx =
    /\b(commission|sourcing\s+fee|buying\s+commission|agency\s+fee|markup)\b/i;
  const parts = splitSentences(text);
  let total = 0;
  const rewritten = parts.map(sentence => {
    if (!compensationRx.test(sentence)) return sentence;
    if (!SH_MARKER_RX.test(sentence)) return sentence;

    // Preserve the trailing punctuation so the rejoin doesn't drop
    // sentence boundaries.
    const tail = sentence.match(/[.!?;\n]?$/)[0];
    total += 1;
    return ` Alex will confirm our commercial terms with you directly${
      tail && /[.!?;]/.test(tail) ? '' : '.'
    }${tail}`.replace(/^ /, sentence.startsWith(' ') ? ' ' : '');
  });
  // Trim a leading space that may have been introduced when the very
  // first sentence is the one rewritten (the replacement above starts
  // with a leading space to preserve mid-paragraph spacing).
  let out = rewritten.join('');
  if (text.length > 0 && !text.startsWith(' ') && out.startsWith(' ')) {
    out = out.replace(/^ /, '');
  }
  return { text: out, count: total };
}

// ── Public API ─────────────────────────────────────────────────────

function lint(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return { text: text || '', corrections: [] };
  }

  let out = text;
  const corrections = [];

  const pushIf = (rule, before, after, n) => {
    if (n > 0) corrections.push({ rule, before, after, count: n });
  };

  // Em-dash → comma.
  let r = applyEmDash(out); out = r.text;
  pushIf('no-em-dash', '—', ', ', r.count);

  // IronLite "powered by" → "with IronLite Core Technology".
  r = applyIronLite(out); out = r.text;
  pushIf('ironlite-phrasing', 'powered by IronLite', 'with IronLite Core Technology', r.count);

  // JetCore stripping. Comes BEFORE British spellings + Title Case so
  // the IronLite Core token that replaces it doesn't get touched.
  r = applyJetCore(out); out = r.text;
  pushIf('no-jetcore', 'JetCore', 'IronLite Core', r.count);

  // British spellings.
  r = applyUkSpellings(out); out = r.text;
  pushIf('british-english', 'US spellings', 'UK spellings', r.count);

  // Country Title Case (after UK spellings; lowercase country names
  // in mixed-case text get fixed here).
  r = applyCountryTitleCase(out); out = r.text;
  pushIf('country-title-case', 'lowercase country names', 'Title Case', r.count);

  // 40HC → 40 HQ.
  r = applyContainerAbbrev(out); out = r.text;
  pushIf('container-hq-preferred', '40HC', '40 HQ', r.count);

  // Trader/middleman in brand context.
  r = applyTraderMiddleman(out); out = r.text;
  pushIf('no-trader-middleman', 'trader/middleman', 'buying house in Asia / factory', r.count);

  // Trading company in Sovern context.
  r = applyTradingCompany(out); out = r.text;
  pushIf('no-trading-company', 'trading company', 'buying house in Asia', r.count);

  // Sovern compensation language (sentence-level rewrite).
  r = applySovernCompensation(out); out = r.text;
  pushIf('sovern-compensation-language', 'commission / sourcing fee / markup', 'Alex will confirm our commercial terms', r.count);

  return { text: out, corrections };
}

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

module.exports = { lint, lintEmailParts, COUNTRIES, UK_SPELLINGS };
