/**
 * Research Runner — Tier 2 background sourcing.
 *
 * Phase sequence:
 *   queued → running → completed | failed | cancelled
 *
 * Spawns a `claude -p` subprocess with WebSearch + WebFetch + the ERP MCP
 * server enabled, asks it to return a structured JSON list of findings,
 * dedups against existing Lead / Customer / Factory rows, creates draft
 * Lead or Factory records for non-duplicates, and fires the three-channel
 * notifier on completion.
 *
 * The subprocess sees no local code — Bash/Read/Write/Edit/Glob/Grep are
 * blocked. Only WebSearch / WebFetch / MCP tools.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Op } = require('sequelize');
const db = require('../models');
const logger = require('../utils/logger');
const { fireResearchNotifications } = require('./researchNotifier');

const NON_TERMINAL = ['queued', 'running'];
const RUN_TIMEOUT_MS = 20 * 60 * 1000; // 20 min — matches the spec
const MAX_FINDINGS_PER_RUN = 25; // sanity cap on AI output

// ── MCP config — same ERP tool server as the chat subprocess ─────────────────
// Written once at module load. The research subprocess gets the same MCP
// access so it can dedup against existing rows and create_lead / create_factory
// directly if it prefers — though the structured-output path below is the
// default flow.
const MCP_SERVER_PATH = path.join(__dirname, '..', 'mcp', 'erpToolServer.js');
const MCP_CONFIG_PATH = path.join(os.tmpdir(), 'sovern-erp-research-mcp-config.json');
try {
  fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify({
    mcpServers: {
      'sovern-erp': {
        command: 'node',
        args: [MCP_SERVER_PATH],
      },
    },
  }));
  logger.info('[research] MCP config written to', MCP_CONFIG_PATH);
} catch (err) {
  logger.error('[research] Failed to write MCP config:', err.message);
}

// ─── Boot recovery ───────────────────────────────────────────────────────────

async function recoverStaleResearchTasks() {
  if (!db.ResearchTask) return;
  const stale = await db.ResearchTask.findAll({ where: { status: NON_TERMINAL } });
  for (const task of stale) {
    await task.update({
      status: 'failed',
      errorMessage: 'Server restarted while research run was in flight; auto-failed by boot recovery.',
      completedAt: new Date(),
    });
    logger.warn(`[research] Boot recovery: marked stale task ${task.id} as failed`);
  }
  if (stale.length > 0) {
    logger.info(`[research] Boot recovery: failed ${stale.length} stale task(s)`);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

function spawnTask(taskId) {
  // Detach from the HTTP request — the controller has already returned 202.
  setImmediate(() => {
    processTask(taskId).catch(err => {
      logger.error(`[research] processTask ${taskId} unhandled error: ${err.stack || err.message}`);
    });
  });
}

async function cancelTask(taskId) {
  const task = await db.ResearchTask.findByPk(taskId);
  if (!task) return;
  if (!NON_TERMINAL.includes(task.status)) return;

  // Kill the subprocess if we have a pid recorded.
  if (task.subprocessPid) {
    try {
      process.kill(task.subprocessPid, 'SIGTERM');
      setTimeout(() => {
        try { process.kill(task.subprocessPid, 'SIGKILL'); } catch (_) {}
      }, 5000);
    } catch (e) {
      // ESRCH = already exited, fine
      if (e.code !== 'ESRCH') {
        logger.warn(`[research] Could not signal pid ${task.subprocessPid}: ${e.message}`);
      }
    }
  }

  await task.update({
    status: 'cancelled',
    completedAt: new Date(),
    errorMessage: 'Cancelled by user.',
  });

  fireResearchNotifications(task, 'cancelled').catch(() => {});
  logger.info(`[research] Task ${taskId} cancelled by user.`);
}

// ─── Core flow ───────────────────────────────────────────────────────────────

async function processTask(taskId) {
  const task = await db.ResearchTask.findByPk(taskId);
  if (!task) {
    logger.warn(`[research] processTask: ${taskId} not found`);
    return;
  }
  if (!NON_TERMINAL.includes(task.status)) {
    logger.warn(`[research] processTask: ${taskId} already terminal (${task.status})`);
    return;
  }

  await task.update({ status: 'running', startedAt: task.startedAt || new Date() });

  try {
    const result = await runResearchSubprocess({
      taskId: task.id,
      mode: task.mode,
      brief: task.brief,
      onPid: (pid) => task.update({ subprocessPid: pid }).catch(() => {}),
    });

    if (!result.ok) {
      await task.update({
        status: 'failed',
        errorMessage: result.error || (result.killedByTimeout ? `Run timed out at ${RUN_TIMEOUT_MS / 1000}s` : 'Subprocess failed'),
        completedAt: new Date(),
        tokenUsage: result.tokenUsage || {},
        subprocessPid: null,
      });
      const refreshed = await db.ResearchTask.findByPk(task.id);
      fireResearchNotifications(refreshed, 'failed').catch(() => {});
      return;
    }

    const parsed = parseFindings(result.output);
    if (!parsed.ok) {
      await task.update({
        status: 'failed',
        errorMessage: `Could not parse AI output: ${parsed.error}. Raw start: ${(result.output || '').slice(0, 300)}`,
        completedAt: new Date(),
        tokenUsage: result.tokenUsage || {},
        subprocessPid: null,
      });
      const refreshed = await db.ResearchTask.findByPk(task.id);
      fireResearchNotifications(refreshed, 'failed').catch(() => {});
      return;
    }

    const { summary, findings: rawFindings } = parsed;
    const trimmed = rawFindings.slice(0, MAX_FINDINGS_PER_RUN);
    const processed = await dedupAndCreateDrafts(task, trimmed);

    await task.update({
      status: 'completed',
      summary: summary || null,
      findings: processed.findings,
      findingsCount: trimmed.length,
      draftsCreated: processed.draftsCreated,
      duplicatesFound: processed.duplicatesFound,
      tokenUsage: result.tokenUsage || {},
      completedAt: new Date(),
      subprocessPid: null,
    });

    const refreshed = await db.ResearchTask.findByPk(task.id);
    fireResearchNotifications(refreshed, 'completed').catch(() => {});
    logger.info(`[research] Task ${task.id} completed: ${processed.draftsCreated} drafts, ${processed.duplicatesFound} duplicates.`);
  } catch (err) {
    logger.error(`[research] Task ${task.id} threw: ${err.stack || err.message}`);
    await task.update({
      status: 'failed',
      errorMessage: `Runner error: ${err.message}`.slice(0, 500),
      completedAt: new Date(),
      subprocessPid: null,
    });
    const refreshed = await db.ResearchTask.findByPk(task.id);
    fireResearchNotifications(refreshed, 'failed').catch(() => {});
  }
}

// ─── Subprocess invocation ───────────────────────────────────────────────────

function buildResearchSystemPrompt(mode) {
  const isClients = mode === 'clients';
  const entity = isClients ? 'buyer / importer / distributor' : 'manufacturer / factory / supplier';
  const ourSide = isClients ? 'sell to' : 'buy from';
  const requiredFields = isClients
    ? `companyName, contactName, email (required, must be a real verifiable address), country (required), website (optional), vertical (optional), productInterests (optional array of category slugs), draftEmail (required, see "Cold-email drafting" section below)`
    : `companyName, contactPerson, email (required, must be a real verifiable address), phone (required), country (required), certifications (optional array), specializations (optional array), leadTimeDays (optional integer), notes (optional)`;

  return `You are the Sovern House ERP research assistant running in background mode. Your job: take Alex's research brief and return a structured list of real, verifiable ${entity} candidates that Sovern House could ${ourSide}.

## Hard rules — non-negotiable

1. **No fictional data.** Every company, contact, email, phone, URL, or factual claim MUST come from a real web source you actually fetched. Never fabricate. Never round up confidence. If you cannot cite a real URL for something, drop the finding entirely.
2. **Verified contact required.** Each finding must have a real, valid email address (and for suppliers, a real phone number too). Generic info@ / contact@ addresses are acceptable when you have evidence they reach the right company. If you cannot find a working contact, drop the finding.
3. **Dedup first.** Before adding a candidate, call list_leads / list_factories / erp_query (entity='Customer') to check whether Sovern House already has a record with the same domain or company name. If yes, mention it in the finding's evidence field but do NOT include it as a new candidate (the runner dedups on its side too — this is belt-and-braces).
4. **Tools available:** WebSearch, WebFetch, and the full ERP MCP tool set (list_leads, list_factories, list_customers via erp_query, etc.). You do NOT have file or shell access.
5. **Time budget:** ~20 min hard cap. Aim for 5-15 high-quality findings, not 50 low-quality ones.

## Output format — strict

Your final response must be a single JSON object, nothing else. No markdown fences, no preamble, no closing remarks. Just the JSON.

Schema:
\`\`\`
{
  "summary": "2-4 sentence narrative of what you searched, what you found, what you couldn't find, and any caveats",
  "findings": [
    {
      "companyName": "string",
      ${isClients
        ? `"contactName": "string (best contact you could verify, e.g. 'Procurement Manager' if no name found)",
      "email": "string (must validate as a real email)",
      "country": "string",
      "website": "string or null",
      "vertical": "string or null (e.g. 'flooring', 'auto-parts')",
      "productInterests": ["array", "of", "category", "slugs"],
      "draftEmail": {
        "subject": "string (3-6 words, lowercase except proper nouns, looks human-written)",
        "bodyText": "string (~80-120 words, plain text, follows the Sovern voice + structure described below; pick the right template by vertical)"
      },`
        : `"contactPerson": "string or null",
      "email": "string (must validate as a real email)",
      "phone": "string (required, with country code)",
      "country": "string",
      "certifications": ["FSC", "ISO9001", "..."],
      "specializations": ["spc-flooring", "engineered-oak", "..."],
      "leadTimeDays": 30,
      "notes": "string or null (capture MOQ, price range, anything Alex would want before reaching out)",`}
      "sourceUrl": "string (real URL where you found this — must be loadable)",
      "evidence": "string (1-2 sentences: what specifically on that page told you this is a real ${entity} matching the brief)"
    }
  ]
}
\`\`\`

If you cannot find any usable findings, return \`{"summary": "...", "findings": []}\` with the summary explaining why.

## ${isClients ? 'Buyer profile to find' : 'Supplier profile to find'}

Read Alex's brief carefully. ${isClients
  ? 'Look for established importers, distributors, or wholesalers — not retail shops. Mid-market is usually the sweet spot. Check trade directories, industry associations, LinkedIn company pages, and the companies\' own contact pages.'
  : 'Look for established manufacturers with verifiable export experience. Check trade directories (Made-in-China, IndiaMart, EuroPages, etc.), industry associations, certification body lookup tools, and the factories\' own websites. Prefer factories with English-language sites — easier to vet and reach.'}

Brief specs (e.g. "oak engineered 14/3 1900x190 click system") should be matched literally — only include factories whose published catalog or product pages show that exact spec or very close to it.

${isClients ? `## Cold-email drafting (REQUIRED for every finding)

Each finding must include a complete \`draftEmail\` object with subject + bodyText. These drafts are saved alongside the lead row and surfaced for Alex to review/edit before any send. Nothing goes out without his approval. Quality matters — these are real first impressions.

### Sovern voice — non-negotiable

- Direct, specific, no fluff. No "I hope this finds you well." No "I came across your company."
- One ask per email. No "let me know" + "happy to share more" + "open to discussing." Pick one.
- Lower-case subject lines unless proper nouns. Looks human, not corporate.
- 80-120 words. If you can say it in 80, do.
- No em dashes. Use periods, commas, colons, or parentheses.
- Open with one sentence that proves you researched THEM (their import lane, their product line, a recent move). Not a generic greeting.

### Pick the right template by vertical

**For Malaysia LVT/SPC importers/distributors (US, Canada, EU, AU)** — speak as the factory, never as a middleman:
- Say "we're shipping from our factory in Malaysia" — never "I have an agency agreement," "I work with a factory," or "there's a factory I know"
- Lead with what they get: factory-direct pricing, Malaysia-origin certificates, zero Section 301 (vs 25%+ on Chinese-origin)
- Offer FOB or DDP (DDP = lands at warehouse with duties + freight covered)
- Never use "buying house" framing for this campaign — it implies a middleman that doesn't exist

Template (adapt the opener to be specific to THEM):
\`\`\`
Subject: malaysia LVT/SPC for [Company]

Hi [Name],

[One specific sentence proving research — their import volume, current supplier country, product line, recent expansion, etc.]

We're shipping LVT/SPC from our factory in Malaysia directly to [their region] distributors. Malaysia-origin certificates, zero Section 301 vs. 25%+ on Chinese-origin, specs built for the [their region] market. FOB or DDP — DDP means it lands at your warehouse with duties and freight covered.

Worth 15 minutes to see if the pricing works for [Company]?

Alex
Sovern House
\`\`\`

**For general flooring (non-Malaysia / non-LVT/SPC) — Taiwan/China sourcing:**
- Position as a buying house: "We're a buying house based in Taiwan, 30 years on the ground"
- 5% flat fee on FOB, no hidden spread
- Direct factory negotiation, QC, documents handled

Template:
\`\`\`
Subject: taiwan flooring sourcing

Hi [Name],

Saw [Company] has been bringing in [product type] from [origin country] — looks like real volume.

We're a buying house based in Taiwan, 30 years on the ground. We source flooring direct from factories in Taiwan and China, handle QC, handle documents, 5% flat on FOB. No hidden spread.

Worth a 15-minute call on how we'd quote your next flooring order?

Alex
Sovern House
\`\`\`

**For non-flooring verticals (auto parts, garments, etc.):** general buying-house framing, 5% flat, 30-year founder Asia story, direct factory negotiation.

### Common mistakes to AVOID in drafts

- Don't fabricate the specific opener. If you can't find a real fact about the company from your web search, write "[your company's import lane / product line / recent move]" as a placeholder so Alex fills it in. Better to flag a gap than to invent.
- Don't quote prices, lead times, or commission rates. Alex sets pricing — never assume.
- Don't include phone numbers or company addresses in the signature. Just "Alex / Sovern House."
- Don't mention Sovern's customers or factories by name (NDA risk).

` : ''}## Required output fields recap

${requiredFields}

Drop any finding that lacks the required fields (including draftEmail for clients mode). The runner will reject invalid emails, so don't waste a slot on a guess.

Begin work now. Return only the JSON object when done.`;
}

function runResearchSubprocess({ taskId, mode, brief, onPid }) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let killedByTimeout = false;

    const systemPrompt = buildResearchSystemPrompt(mode);

    // Disallowed: local file/shell tools. Allowed: WebSearch, WebFetch, MCP tools.
    const args = [
      '-p',
      '--system-prompt', systemPrompt,
      '--strict-mcp-config',
      '--mcp-config', MCP_CONFIG_PATH,
      '--permission-mode', 'bypassPermissions',
      '--output-format', 'json',
      '--disallowed-tools', 'Bash,Read,Write,Edit,Glob,Grep',
    ];

    logger.info(`[research] Spawning claude -p for task ${taskId} (mode=${mode})`);

    const child = spawn('claude', args, {
      env: {
        ...process.env,
        ERP_USER_ID: '', // research subprocess shouldn't act on a specific user's behalf for writes
      },
    });

    if (typeof onPid === 'function' && child.pid) onPid(child.pid);

    child.stdin.write(brief);
    child.stdin.end();

    const killTimer = setTimeout(() => {
      if (!settled) {
        killedByTimeout = true;
        logger.warn(`[research] Task ${taskId} timed out at ${RUN_TIMEOUT_MS}ms — killing`);
        child.kill('SIGTERM');
        setTimeout(() => { try { child.kill('SIGKILL'); } catch (_) {} }, 5000);
      }
    }, RUN_TIMEOUT_MS);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      settled = true;
      clearTimeout(killTimer);

      let parsed = null;
      let tokenUsage = {};
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
      } catch (_) {
        // not JSON — fall through with empty telemetry
      }

      resolve({
        ok: code === 0 && !killedByTimeout,
        output: parsed && parsed.result ? parsed.result : stdout.trim(),
        error: code !== 0 ? stderr.slice(0, 500) : null,
        exitCode: code,
        tokenUsage,
        killedByTimeout,
      });
    });

    child.on('error', (err) => {
      settled = true;
      clearTimeout(killTimer);
      logger.error(`[research] Subprocess error for task ${taskId}: ${err.message}`);
      resolve({ ok: false, output: null, error: err.message, exitCode: -1, tokenUsage: {}, killedByTimeout: false });
    });
  });
}

// ─── Output parsing ──────────────────────────────────────────────────────────

function parseFindings(output) {
  if (!output || typeof output !== 'string') {
    return { ok: false, error: 'empty subprocess output' };
  }
  // The AI is instructed to return raw JSON. Accept either bare JSON or
  // JSON wrapped in a fenced code block (graceful fallback).
  let text = output.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) text = fence[1].trim();

  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: e.message };
  }
  if (!obj || typeof obj !== 'object') {
    return { ok: false, error: 'parsed value is not an object' };
  }
  const summary = typeof obj.summary === 'string' ? obj.summary : '';
  const findings = Array.isArray(obj.findings) ? obj.findings : [];
  return { ok: true, summary, findings };
}

// ─── Dedup + draft creation ──────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function dedupAndCreateDrafts(task, rawFindings) {
  const out = [];
  let draftsCreated = 0;
  let duplicatesFound = 0;

  for (const f of rawFindings) {
    if (!f || typeof f !== 'object') continue;

    const companyName = String(f.companyName || '').trim();
    const email = String(f.email || '').trim().toLowerCase();
    const sourceUrl = String(f.sourceUrl || '').trim();

    // Hard requirements
    if (!companyName || !EMAIL_RE.test(email)) {
      out.push({
        type: task.mode === 'clients' ? 'lead' : 'factory',
        draftId: null,
        companyName: companyName || '(unnamed)',
        country: f.country || null,
        sourceUrl: sourceUrl || null,
        evidence: f.evidence || null,
        skipped: 'missing required fields (companyName / valid email)',
      });
      continue;
    }

    // Dedup: check existing rows by email (case-insensitive). Lead and Customer
    // for clients-mode; Factory for suppliers-mode. Belt-and-braces against
    // the AI's own dedup attempt during the run.
    const existing = await findExistingByEmail(task.mode, email, companyName);
    if (existing) {
      duplicatesFound += 1;
      out.push({
        type: existing.type,
        draftId: null,
        companyName,
        country: f.country || null,
        sourceUrl: sourceUrl || null,
        evidence: f.evidence || null,
        dedupedAgainst: { id: existing.id, type: existing.type, companyName: existing.companyName },
      });
      continue;
    }

    // Create the draft row
    try {
      if (task.mode === 'clients') {
        const draftEmail = sanitizeDraftEmail(f.draftEmail);
        const lead = await db.Lead.create({
          companyName,
          contactName: String(f.contactName || 'Unknown contact').trim().slice(0, 200),
          email,
          country: f.country || null,
          website: f.website || null,
          vertical: f.vertical || null,
          productInterests: Array.isArray(f.productInterests) ? f.productInterests : [],
          source: 'other',
          status: 'new',
          leadType: 'outbound_prospect',
          description: buildLeadDescription(f, sourceUrl),
          draftEmailSubject: draftEmail ? draftEmail.subject : null,
          draftEmailBody: draftEmail ? draftEmail.bodyText : null,
          createdById: task.userId || null,
        });
        draftsCreated += 1;
        out.push({
          type: 'lead',
          draftId: lead.id,
          companyName,
          contactName: f.contactName || null,
          email,
          country: f.country || null,
          sourceUrl: sourceUrl || null,
          evidence: f.evidence || null,
          draftEmail: draftEmail || null,
        });
      } else {
        // suppliers — Factory.phone is allowNull: false, so reject if missing
        const phone = String(f.phone || '').trim();
        if (!phone) {
          out.push({
            type: 'factory',
            draftId: null,
            companyName,
            country: f.country || null,
            sourceUrl: sourceUrl || null,
            evidence: f.evidence || null,
            skipped: 'missing required phone (Factory.phone is non-null)',
          });
          continue;
        }
        const factory = await db.Factory.create({
          companyName,
          contactPerson: f.contactPerson || null,
          email,
          phone,
          country: f.country || null,
          certifications: Array.isArray(f.certifications) ? f.certifications : [],
          specializations: Array.isArray(f.specializations) ? f.specializations : [],
          leadTimeDays: typeof f.leadTimeDays === 'number' ? f.leadTimeDays : 30,
          notes: buildFactoryNotes(f, sourceUrl),
          rating: 0, // unverified — Alex sets after review
          isActive: true,
        });
        draftsCreated += 1;
        out.push({
          type: 'factory',
          draftId: factory.id,
          companyName,
          contactPerson: f.contactPerson || null,
          email,
          phone,
          country: f.country || null,
          sourceUrl: sourceUrl || null,
          evidence: f.evidence || null,
        });
      }
    } catch (e) {
      // Most likely cause: validation failure (bad email despite our regex,
      // duplicate unique constraint, etc.). Record but don't blow up the task.
      logger.warn(`[research] Could not create ${task.mode} draft for "${companyName}": ${e.message}`);
      out.push({
        type: task.mode === 'clients' ? 'lead' : 'factory',
        draftId: null,
        companyName,
        country: f.country || null,
        sourceUrl: sourceUrl || null,
        evidence: f.evidence || null,
        skipped: `create failed: ${e.message}`.slice(0, 200),
      });
    }
  }

  return { findings: out, draftsCreated, duplicatesFound };
}

async function findExistingByEmail(mode, email, companyName) {
  // Lower-cased compare via Op.iLike isn't available on SQLite — use LIKE on
  // a lowered field via where + sequelize.where, or just fetch by exact match.
  // The AI is instructed to lowercase, and we lowercased above, so a plain
  // Op.eq is sufficient for the canonical case.
  if (mode === 'clients') {
    const lead = await db.Lead.findOne({ where: { email } });
    if (lead) return { type: 'lead', id: lead.id, companyName: lead.companyName };

    if (db.Customer) {
      const customer = await db.Customer.findOne({ where: { email } });
      if (customer) return { type: 'customer', id: customer.id, companyName: customer.companyName };
    }
    // Also try a companyName match — protects against the AI finding the same
    // company under a different generic email (info@ vs sales@).
    if (companyName) {
      const byName = await db.Lead.findOne({ where: { companyName } });
      if (byName) return { type: 'lead', id: byName.id, companyName: byName.companyName };
    }
    return null;
  }

  // suppliers
  const factory = await db.Factory.findOne({ where: { email } });
  if (factory) return { type: 'factory', id: factory.id, companyName: factory.companyName };
  if (companyName) {
    const byName = await db.Factory.findOne({ where: { companyName } });
    if (byName) return { type: 'factory', id: byName.id, companyName: byName.companyName };
  }
  return null;
}

function buildLeadDescription(f, sourceUrl) {
  const parts = [
    'Sourced via AI research (unverified — review before outreach).',
    f.evidence ? `Evidence: ${f.evidence}` : null,
    sourceUrl ? `Source: ${sourceUrl}` : null,
  ];
  return parts.filter(p => p !== null).join('\n');
}

function sanitizeDraftEmail(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const subject = String(raw.subject || '').trim();
  const bodyText = String(raw.bodyText || '').trim();
  if (!subject || !bodyText) return null;
  return {
    subject: subject.slice(0, 200),
    bodyText: bodyText.slice(0, 4000),
  };
}

function buildFactoryNotes(f, sourceUrl) {
  const parts = [
    'Sourced via AI research (unverified — review before quoting).',
    f.notes ? f.notes : null,
    f.evidence ? `Evidence: ${f.evidence}` : null,
    sourceUrl ? `Source: ${sourceUrl}` : null,
  ].filter(Boolean);
  return parts.join('\n');
}

module.exports = {
  spawnTask,
  cancelTask,
  recoverStaleResearchTasks,
  // exported for tests / future callers
  parseFindings,
  buildResearchSystemPrompt,
};
