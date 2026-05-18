# Phase 4.18 — AI Assistant Knowledge Base + Persistent Memory (Feature Directive)

**Status:** DRAFT — pending Alex approval
**Owner:** Alex (Super Admin) → Claude (executing)
**Spec template:** `erp-feature-directive.md`
**Related:** `LeadAIPanel.jsx` (admin), `mobile/app/lead/[id].tsx` AI panel, `backend/controllers/aiController.js`, `backend/mcp/erpToolServer.js`
**Triggered by:** 2026-05-18 Stevens Omni cold-email session where the AI emitted "malaysia and china" (lowercase) + "powered by IronLite Core" (wrong phrasing) and didn't know IronLite ≡ JetCore.

---

## The gap

Today the AI Assistant gets two kinds of context per turn:

1. **Lead context block** — assembled client-side in `LeadAIPanel.jsx` lines 30-76. Includes the lead's company, contact, country, draft email subject/body, and an 8-point guidance list ("refine the draft email", "fill missing fields", etc.). Compact and lead-specific. Good for "what does this company sell" type questions.
2. **Lead chat history** — re-fed each turn via the `conversationId` continuity.

What's missing:

- **Brand voice rules.** No system-level enforcement of:
  - Country names always capitalized (Malaysia, China, Vietnam) — see L-068 capitalization incident.
  - No em-dashes (CLAUDE.md standing rule).
  - Factory-direct framing for FW/HH leads ("we ship from our factory in Malaysia"), buying-house framing for SH leads ("30-year founder Asia story, Taiwan-based").
  - "With IronLite Core Technology" (correct) vs "powered by IronLite Core" (wrong) — surfaced 2026-05-18.
- **Product knowledge.** No durable knowledge of:
  - IronLite Core Technology construction, layers, wear, click system.
  - IronLite ≡ JetCore equivalence (same tech, different brand on the same factory line).
  - HGTV provenance (which show, what air dates).
  - Generic flooring industry: LVT/SPC/WPC/Engineered SPC/Vinyl Sheet construction, click systems (Uniclic, Valinge 2G/5G), wear layers (6/12/20 mil), dimension standards.
- **Trade terms.** No durable knowledge of HS codes, Incoterms, CPTPP rules of origin, CBSA MFN rates, AD/CV duty status. The AI re-searches every turn (and sometimes gets it wrong).
- **Persistent memory.** Every correction Alex gives ("use Title Case on country names", "stop saying 'powered by'") is lost when the conversation ends. The next session repeats the mistakes.
- **Skill files.** `International Trade Company/Instructions & Skills/` has dozens of well-authored .md skill files for humans. The AI can't read them.

These gaps compound. The Stevens Omni session burned 4.5 minutes of AI tool-use time (and a 504) on tariff verification the AI should have known cold.

---

## Goals

By end of Phase 4.18:

1. The AI always loads a compact brand-voice + capitalization + IronLite-phrasing system prompt.
2. The AI can fetch any of the existing skill .md files on demand via a new MCP tool.
3. IronLite specs + flooring industry knowledge live as markdown that the AI loads when relevant.
4. Per-user memory survives across sessions: corrections, preferences, factual claims Alex flags as durable.
5. Three-Surface Rule: changes are backend-only (admin panel + mobile + chat page all hit the same `/api/ai/chat`).

---

## Phases

### Phase 4.18a — System prompt overhaul (foundation)

**Goal:** Inject a compact, always-loaded system prompt that codifies brand voice + non-negotiable writing rules.

**Content (~1200 tokens, fits in any model context):**

```
## Sovern House Operations — AI Assistant System Prompt (always loaded)

### Identity
You are the AI Assistant for Sovern House Operations, the internal ERP for
three brands run by Alex McConnell:
  - SH (Sovern House)  — Taiwan-based buying house. 5% flat commission,
    30-year founder Asia story. Voice: trusted intermediary.
  - FW (FlorWay)        — Malaysia-origin resilient flooring (LVT/SPC/WPC).
    Voice: factory-direct. "We ship from our factory in Malaysia."
  - HH (HanHua)         — China-origin resilient flooring (LVT/SPC/WPC).
    Voice: factory-direct. "We ship from our factory in China."

### Non-negotiable writing rules
1. Country names ALWAYS capitalized: Malaysia, China, Vietnam, Canada,
   United States. Never "malaysia" or "china", even in subject lines.
2. No em-dashes anywhere in copy. Use periods, commas, colons, parentheses.
3. IronLite Core: phrase as "with IronLite Core Technology". Never
   "powered by IronLite". Never "containing IronLite".
4. IronLite Core ≡ JetCore (same tech, manufactured on the same line,
   different branding). HGTV-featured. When citing HGTV, say "recently
   seen on HGTV" unless you have a specific show + date confirmed by Alex.
5. FW/HH product positioning: factory-direct, no middleman framing.
   SH product positioning: trusted buying house, multi-supplier network.
6. Resilient flooring (LVT / SPC / WPC / Engineered SPC / Vinyl Sheet)
   is NEVER SH. It's FW (Malaysia) or HH (China). Rule #9. If a lead
   has resilient flooring interest tagged SH, the brand is wrong.
7. Trade tariffs: cite CBSA / USITC URLs when stating duty rates. Don't
   make up numbers. If unsure, use read_sovern_skill('trade-tariffs')
   or WebFetch to verify.

### Voice templates by brand
[FW factory-direct opener, body structure, ask]
[SH buying-house opener, body structure, ask]

### Available knowledge (load on demand)
You have access to these knowledge surfaces — call the matching MCP tool
when relevant:
  - read_sovern_skill(skill_name)  — read any skill .md from the repo
  - read_drive_file(file_id)        — read a Google Drive doc
  - list_memories(kind?)            — recall durable facts from prior chats
  - remember_fact(key, value, kind?)— save a durable fact for future chats
```

**Files:**
- `backend/services/aiSystemPrompt.js` (new) — exports `buildSystemPrompt({ userId, leadContext? })`.
- `backend/controllers/aiController.js` — prepend the system prompt to every claude subprocess turn.

**Estimated diff:** ~250 lines (mostly the prompt text itself).

**Acceptance:**
- Start a fresh AI chat, ask "write a cold email subject for a flooring lead in Vietnam". Subject must capitalize Vietnam.
- Ask "what does powered by IronLite mean". AI corrects to "with IronLite Core Technology".
- Ask "is SPC ever an SH product". AI says no, FW or HH only.

### Phase 4.18b — Skill-file loader MCP tool

**Goal:** Let the AI read any markdown skill file from the repo on demand.

**Files:**
- `International Trade Company/Instructions & Skills/` — existing directory, ~40 .md files.
- `backend/mcp/erpToolServer.js` — new tool `read_sovern_skill(skill_name)`. Lists available skills in tool description so the AI knows what's there. Path-traversal guarded (refuse if `..` in name).
- `backend/services/skillIndex.js` (new) — builds a list of `{slug, oneLineDescription}` from the first non-empty line of each .md. Cached for 10 min so the AI's tool listing stays current without re-reading 40 files per turn.

**Estimated diff:** ~150 lines.

**Acceptance:**
- AI asked "what's the rule on Egypt BCC for outreach emails" calls `read_sovern_skill('trade-email-rules')`, reads the section, answers correctly.
- AI asked to draft a quotation cover page calls `read_sovern_skill('trade-cmo')` or similar.

### Phase 4.18c — IronLite + JetCore knowledge file

**Goal:** Author the durable product knowledge the AI keeps citing wrong.

**Files:**
- `International Trade Company/Instructions & Skills/product-ironlite-core.md` — sections:
  - Brand position: "IronLite Core Technology" is the FW-branded structural core. Never "powered by".
  - Construction: layer stack, wear layer, click system, dimensions.
  - JetCore equivalence: same factory line, same tech, JetCore is the legacy brand. Talk to Alex before publicly equating them.
  - HGTV provenance: which show, episode, air date — TO BE FILLED BY ALEX (placeholder in the doc).
  - Approved phrasing for cold emails, decks, RFQ responses.
  - Forbidden phrasings (the "powered by" pattern + variants).

**Estimated diff:** Pure markdown, ~300 lines authored by Alex with Claude help.

**Acceptance:**
- AI asked "tell me about IronLite Core" calls `read_sovern_skill('product-ironlite-core')` and quotes the approved phrasing.
- AI never re-emits "powered by IronLite" in any draft.

### Phase 4.18d — Flooring industry knowledge file

**Goal:** Generic flooring knowledge the AI can pull from rather than re-Web-searching every turn.

**Files:**
- `International Trade Company/Instructions & Skills/product-flooring-industry.md` — sections:
  - Resilient flooring categories: LVT, SPC, WPC, Engineered SPC, Vinyl Sheet, Rigid Core Vinyl.
  - Wear layers: 6 mil (residential), 12 mil (light commercial), 20 mil (commercial), 40 mil (heavy commercial).
  - Click systems: Uniclic (Mohawk), Valinge 2G / 5G (Valinge), proprietary lock variants.
  - Backing types: IXPE foam, EVA, attached underlayment.
  - Standard dimensions: 7" × 48" plank, 9" × 60", 12" × 24" tile, 180mm × 1220mm metric.
  - HS codes: 3918.10 (vinyl flooring), 4418.79 (engineered wood), tariff lookup pointers.
  - Click vs glue-down vs loose-lay use-cases.

**Estimated diff:** Pure markdown, ~400 lines.

### Phase 4.18e — Persistent per-user memory (the big one)

**Goal:** A durable store for corrections, preferences, and facts the AI should remember across chat sessions.

**Backend:**
- `backend/models/AiMemory.js` (new) — table fields: id, userId, kind (preference/fact/correction/voice_rule), key (short slug), value (free text up to 2KB), source ('explicit-remember-command' | 'auto-detected-correction'), createdAt, updatedAt, lastReferencedAt, isActive.
- Sentinel-guarded migration to create the table.
- `backend/services/aiMemoryService.js` — `list({userId, kind?, limit})`, `upsert({userId, key, ...})`, `softDelete({userId, key})`.

**MCP tools (rule #8):**
- `remember_fact(key, value, kind?)` — super_admin-gated, audit-logged. Used by AI when Alex says "remember that..." or when the AI detects an explicit correction.
- `forget_fact(key)` — soft-delete by key.
- `list_memories(kind?)` — read for the current user.

**System prompt integration (Phase 4.18a):**
- `buildSystemPrompt({ userId })` prepends the top 30 most-recent active memories for that user. Compact format: `[preference] always use Title Case on country names`. Cap at ~500 tokens to avoid bloating every turn.

**Auto-detection of corrections:**
- After each user message, the AI looks for correction patterns ("don't say X", "use Y instead", "always capitalize Z"). If detected with high confidence, it calls `remember_fact(...)` and confirms in its reply.
- Manual: Alex can say `/remember "use Title Case on country names"` as a slash command.

**Acceptance:**
- Session 1: Alex says "stop saying 'powered by IronLite'". AI calls `remember_fact('phrasing-ironlite', 'always use "with IronLite Core Technology", never "powered by IronLite"', 'voice_rule')`. Confirms.
- Session 2 (next day, fresh chat): Alex asks for a draft mentioning IronLite. AI uses correct phrasing without prompting.
- Alex types `/memories`. UI shows the saved memory.
- `/forget phrasing-ironlite` removes it.

**Estimated diff:** ~600 lines (model + migration + service + 3 MCP tools + system-prompt integration + tests).

### Phase 4.18f — Voice rule enforcement at write time

**Goal:** Defense in depth. Even if the AI fails to apply a rule, a server-side pre-write hook catches the violation before persisting to the OutreachEmail draft.

**Files:**
- `backend/services/voiceRuleLinter.js` (new) — runs over every `subject` + `bodyText` the MCP `send_outreach_email` / `update_lead` / `save_outreach_draft` writes:
  - Capitalize `\bmalaysia\b`/`\bchina\b`/`\bvietnam\b`/etc. on word boundary.
  - Replace `powered by IronLite[^,]*` → `with IronLite Core Technology`.
  - Replace em-dashes (`—` / `--`) with appropriate punctuation.
- Integrated into the MCP handlers + `outreachController.saveLeadOutreachDraft` server-side.
- Audit log shows the lint diff per write so Alex can review what was rewritten.

**Estimated diff:** ~200 lines + 8-10 unit tests.

**Acceptance:**
- AI emits "malaysia and china" → DB writes "Malaysia and China".
- AI emits "powered by IronLite Core" → DB writes "with IronLite Core Technology".
- Em-dashes get rewritten to commas/periods.
- Lint event posts to Lead chatter as "Voice lint applied: 2 corrections".

---

## Three-Surface Rule (rule #7)

All changes land server-side in the AI chat path + MCP tool surface. Admin panel, mobile assistant tab, and chat page all hit `/api/ai/chat` — no UI work needed for parity. Mobile gets the same fixed AI for free.

## MCP coverage (rule #8)

| New tool | Purpose | Gating | Audit action |
|---|---|---|---|
| `read_sovern_skill(skill_name)` | Read repo .md skill file | any authenticated user | n/a (read-only) |
| `remember_fact(key, value, kind?)` | Save durable per-user fact | super_admin | `ai_assistant_remember_fact` |
| `forget_fact(key)` | Soft-delete a memory | super_admin | `ai_assistant_forget_fact` |
| `list_memories(kind?)` | List current user's memories | any authenticated user | n/a |

## Out of scope (deferred)

- Full RAG vector index. We have ~40 skill files + ~10 knowledge files; fits in tool-fetch context. Revisit if knowledge surface grows past 100 files.
- Cross-user shared memory. Per-user only for v1.
- AI fine-tuning. Stays prompt-engineered.
- Multi-language prompts. English only.
- Mobile UI for memory inspection. Desktop ERP only for now (operator-only feature).

## Approval gate (4-item — required before any code lands)

1. **Scope approval.** Yes/no on shipping Phase 4.18a-f as scoped above. If a-d only, that's also fine — e + f can be deferred to 4.18.x.
2. **IronLite phrasing approval.** Confirm:
   - Always "with IronLite Core Technology", never "powered by IronLite".
   - Public phrasing on JetCore equivalence (acknowledge openly or treat as internal-only).
   - HGTV provenance: which show + air dates? (placeholder in 4.18c doc until you fill this in.)
3. **Voice rule approval.** Confirm the linter list:
   - Capitalize country names on word boundary.
   - No em-dashes.
   - "with IronLite Core Technology" phrasing.
   - Any others you want enforced (e.g. "factory-direct" vs "we are middlemen", buying-house vs trader framing).
4. **Memory design approval.** Confirm:
   - Per-user (not shared across SH staff).
   - Soft-deletes (`forget_fact` flips isActive=false; row stays for audit).
   - Top 30 memories injected into every system prompt (~500 token cap).
   - Auto-detection of corrections in addition to explicit `/remember` command.

Once all four are signed, Phase 4.18a is the natural starting commit. Each sub-phase ships its own commit + tests.

## Estimated total scope

- Phase 4.18a (system prompt): half a 5-hour window.
- Phase 4.18b (skill loader): 1-2 hours.
- Phase 4.18c + d (knowledge docs): mostly Alex's authoring time, +1 hour Claude for skeleton.
- Phase 4.18e (memory): full 5-hour window (model + migration + 3 MCP tools + system-prompt integration + 8 tests).
- Phase 4.18f (voice linter): 2-3 hours including tests.

Total: ~2 working days end to end. 4.18a alone delivers most of the value Alex flagged.
