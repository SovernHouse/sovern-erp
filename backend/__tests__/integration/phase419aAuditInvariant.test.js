// Phase 4.19a — audit invariant.
//
// Walks every `case '...': { ... }` block in mcp/erpToolServer.js callTool()
// and verifies that any case which performs a Sequelize write (.create,
// .update, .destroy, .bulkCreate, .bulkUpdate, .increment, .decrement)
// also calls auditAiWrite(...). The Phase 4.18 audit gap on create_product
// (9 IronLite Products with no audit rows) escaped review because nothing
// was pinning this invariant.
//
// Exempt list: cases that legitimately write without auditing — e.g.
// internal-state housekeeping, dedupe-table inserts. Keep the exempt
// list small + well-justified; every entry is a documented exception.

const fs = require('fs');
const path = require('path');

const SOURCE_PATH = path.join(__dirname, '../../mcp/erpToolServer.js');

// Cases that perform writes but are intentionally NOT audited.
// Each entry must have a one-line rationale.
const EXEMPT = {
  // Read-only / lookup tools that may incidentally update a cache row.
  'erp_describe_entity_db': 'read-only PRAGMA',
  'erp_query': 'generic read endpoint',
  'list_recent_conversations': 'read-only',
  'read_conversation': 'read-only',
  'search_conversations': 'read-only',
};

function extractCases(source) {
  // Find every `case 'xxx': {` and capture the case name + body span.
  // Body ends at the matching closing brace counting nesting.
  const out = [];
  const caseRe = /^\s*case '([a-zA-Z_][\w]*)':\s*\{/gm;
  let m;
  while ((m = caseRe.exec(source)) !== null) {
    const name = m[1];
    const bodyStart = m.index + m[0].length;
    // Walk to matching close brace.
    let depth = 1;
    let i = bodyStart;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      if (depth === 0) break;
      i++;
    }
    out.push({ name, body: source.slice(bodyStart, i) });
  }
  return out;
}

const WRITE_PATTERNS = [
  /\.create\s*\(/,
  /\.bulkCreate\s*\(/,
  /\.update\s*\(/,
  /\.bulkUpdate\s*\(/,
  /\.destroy\s*\(/,
  /\.increment\s*\(/,
  /\.decrement\s*\(/,
  /\.upsert\s*\(/,
  /\.findOrCreate\s*\(/,
];

function bodyDoesWrite(body) {
  // Skip strings/comments cheaply: very rough but the source is well-
  // formatted enough that this catches false positives only on rare
  // edge cases (a write-shaped substring inside a string literal).
  for (const re of WRITE_PATTERNS) {
    if (re.test(body)) return true;
  }
  return false;
}

function bodyCallsAuditAiWrite(body) {
  return /\bauditAiWrite\s*\(/.test(body);
}

describe('Phase 4.19a — MCP case audit invariant', () => {
  let source;
  let cases;

  beforeAll(() => {
    source = fs.readFileSync(SOURCE_PATH, 'utf8');
    cases = extractCases(source);
  });

  it('finds a non-trivial number of case handlers (sanity check)', () => {
    expect(cases.length).toBeGreaterThan(100);
  });

  it('every write-performing case calls auditAiWrite (or is on the exempt list)', () => {
    const offenders = [];
    for (const c of cases) {
      if (EXEMPT[c.name]) continue;
      if (!bodyDoesWrite(c.body)) continue;
      if (bodyCallsAuditAiWrite(c.body)) continue;
      offenders.push(c.name);
    }

    if (offenders.length > 0) {
      const msg = [
        '',
        'Found MCP case(s) that perform DB writes without calling auditAiWrite:',
        ...offenders.map(n => `  - ${n}`),
        '',
        'Each MCP write tool must audit-log via auditAiWrite(action, entity, entityId, changes, userId)',
        'OR be added to the EXEMPT map in this test file with a one-line justification.',
        '',
        'See Phase 4.18 for the create_product gap that motivated this invariant.',
      ].join('\n');
      throw new Error(msg);
    }

    expect(offenders).toEqual([]);
  });

  it('exempt list entries are real cases (no stale exemptions)', () => {
    const caseNames = new Set(cases.map(c => c.name));
    const stale = Object.keys(EXEMPT).filter(name => !caseNames.has(name));
    expect(stale).toEqual([]);
  });
});
