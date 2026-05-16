# SESSION.md — Current Work State

> This file is maintained by Cowork at the end of every session so Claude Code can pick up without losing context. Read this at the start of every session before doing anything else.

---

## Last Updated
2026-05-16 Taiwan time. Latest: Phase 4.17 dead-code sweep. IronLite catalog confirmed live on prod (9 products active, 18 ProductPrice rows, 9 specs, 0 stale chips). Two pieces of dead/misleading code in `mcp/erpToolServer.js`: (1) `approve_product` was bulk-updating `ProductPrice.isActive` — a non-existent column, the call returned a fake count and looked like it did something; replaced with a `ProductPrice.count()` and renamed the response field `pricesActivated → pricesAffected` to match reality. (2) `create_product` response hardcoded `status: 'pending_approval'` even when the caller passed `active:true` (this is the bug that confused the AI assistant earlier — "the tool overrode my active:true!"); response now reflects the actual isActive flag with separate `statusLabel` + `statusMsg` paths. Suite still 619/619 green.

2026-05-16 Taiwan time (earlier). Phase 4.17 follow-up — orphan-FK + stale-migration cleanup. Audit of `sqlite_master WHERE sql LIKE '%_orphan_%'` found one more table (ProductAttribute) with the same broken FK pattern that took out Product creates earlier: category_id REFERENCES ProductCategory_orphan_20260515 (a dead archive). Rebuilt the table on prod (0 rows, trivial) with full 17-column schema matching the model, no inline FK. Dropped the inline `references` block from `models/ProductAttribute.js` per L-034 so future Sequelize syncs don't re-introduce the bug. Also patched `migrate415c1ProductCubicMeters.js` — was checking `Products` (plural) but the real table is `Product` (singular), so the migration ALTER failed on every restart and never wrote its sentinel; column was already present from the 4.16.4 Product rebuild. Wrote the retroactive sentinel to AuditLog directly so the migration stops looping. Suite still 619/619.

2026-05-16 Taiwan time (earlier). Phase 4.17 — Product approval workflow UI. Activity pills typed `entityType='Product' + type='approve'` now open a full-detail modal (ProductApprovalModal) instead of routing to a missing detail page. Modal shows: brand, category, factory, type, isActive flag, base FOB, lead time, origin country + origin_variants, HS code, weight, cubic meters, full specifications JSON, recent ProductPrice rows (up to 8 with cost/selling/window), and the original AI-create approval task note. Three actions: **Approve** (POST /api/products/:id/approve, optional note, flips isActive=true + closes activity), **Reject** (POST /reject, reason required, soft-deletes Product + closes any open ProductPrice windows to today + cancels activity), **Request revision** (POST /request-revision, comment required, closes current activity + spawns a `follow_up` activity routed back to the original requester so the comment loops to the AI session author for a second-pass edit). All super_admin/admin gated, all audited via auditService. Also patched `create_product` MCP handler to skip the approval ScheduledActivity when `active:true` was explicitly passed (the 9 stale IronLite chips were caused by this — handler used to queue redundant tasks for already-live products). Cleared the 9 stale Product activities on prod via direct UPDATE. 12 new endpoint tests; full backend suite 619/619 green.

2026-05-16 Taiwan time (earlier). Phase 4.16.3 — widen create_product MCP tool surface so a single call can set every Product-row column the AI directive needs. The IronLite Turn 1 prompt failed Phase 4.15c-1 era because the inputSchema declared only 12 fields while the underlying Product model has 23+ columns; the AI correctly stopped per the "no partial data" rule. Fix: extended the handler to write base_fob_price, lead_time_days, origin_country, origin_variants (JSON), cubic_meters, certifications_list (JSON) directly to the Product.create() call, and rewrote the inputSchema to declare all supported fields (now ~25 properties) with descriptions guiding the AI on typed vs free-form spec keys. No service-layer refactor — the handler still calls Product.create() directly (legacy path). Suite 607/607 green. Restart pm2 after deploy.

2026-05-16 Taiwan time (earlier). Phase 4.16.2 — make `claude -p` actually stream so the heartbeat is meaningful. Phase 4.16 + 4.16.1 assumed `claude -p` emits stdout incrementally as the turn progresses; in reality the default `-p` mode buffers all output until the end. Server logs after the 4.16.1 deploy showed the same "stdout idle 120s > 120s threshold" kill, confirming the watchdog was killing legitimate turns whose total subprocess work happened to take >120s (e.g. IronLite bulk 9-SKU + 9-spec turn). Fix: add `--output-format stream-json --verbose` to the claude args so each tool call / assistant text chunk / final result emits a JSON event to stdout. Refactored `runClaudeSubprocess` to line-buffer + JSON-parse each event: accumulates assistant.message.content[].text, prefers the terminal `result.result` field for final text, surfaces result.is_error=true via errOutput. SSE onProgress now forwards actual assistant text chunks (not raw bytes) — better UX side-effect. 5 new stream-json tests + 4 existing test bodies migrated from raw-text to assistant-event emits. Suite 607/607 green. Restart pm2 after deploy.

2026-05-16 Taiwan time (earlier). Phase 4.16.1 — bump claude subprocess IDLE_TIMEOUT_MS from 30s to 120s. The 30s threshold from Phase 4.16 was too aggressive; single MCP tool calls (Drive xlsx parse + multi-row DB writes) routinely silenced stdout for 30-60s mid-call, hitting the watchdog. Symptom in prod was "response disappears with no error" + server-log kill messages "stdout idle 30s > 30s threshold". 120s is the new conservative ceiling that distinguishes legitimate slow tool from hung subprocess. Worst-case kill latency = 120s + 5s poll = 125s. Updated test threshold-cross at 35s → 125s, added 2 boundary tests (90s silence then resumes = NOT killed; 130s silence = killed). Full suite 602/602 green. Restart pm2 after deploy for the new constant.

2026-05-16 Taiwan time (earlier). Phase 4.16 — streaming AI chat with heartbeat-based subprocess liveness. Replaces the flat 240s subprocess kill (and the upstream 150s Express middleware) with an idle-stdout watchdog (kill at 30s of zero stdout) + 900s hard cap. Bulk MCP turns (IronLite-style 28-op sequences) now have unlimited wall-clock budget as long as the subprocess keeps emitting progress. SSE response branch added to /api/ai/chat: clients sending `Accept: text/event-stream` get `progress` events on every stdout chunk + a final `complete` event; non-SSE clients (mobile + offline replay) keep using the JSON-buffer path on the same backend. Frontend desktop chat switched to `chatStream()` (fetch + ReadableStream + SSE parser). req.on('close') aborts the subprocess via AbortSignal when the SSE client disconnects. Mobile gets the longer budget + heartbeat for free (same endpoint, same backend). 10 new heartbeat tests; full suite 600/600 green locally.

2026-05-16 Taiwan time (earlier). Phase 4.13.6 — sanctions list source URL repair + failure-streak alert + weekly URL-probe CI workflow. OFAC SDN URL now points direct to the SLS canonical endpoint (`sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV`); OFAC Consolidated renamed from `cons_prim.csv` → `consolidated.csv` (OFAC-side rename); EU token stripped of trailing `==` base64 padding (cosmetic; webgate is currently returning HTTP 500 server-side regardless). Added `User-Agent: SovernHouseERP/1.0` header to `downloadOnce` — root cause of the 403s was Node's default UA being blocked. New `checkRefreshFailureStreaks(db)` walks the most recent `sanctions_refresh` AuditLog rows and reports sources with 3+ consecutive failures; scheduler fires Notification rows (admin dashboard) + email Alex via `emailService.sendEmail` when the threshold trips. New `.github/workflows/sanctions-url-check.yml` runs the URL HEAD probe every Monday 04:00 UTC. 13 new tests (full suite 590/590 + 4 skipped real-URL probes locally).

2026-05-16 Taiwan time (earlier). Phase 4.15b-2 — Letter of Credit MCP tools (7). createLetterOfCredit (draft + validates supplier/customer/amount/expiry/enums); submitLetterOfCredit (draft → submitted, embeds submitter UUID marker in notes); approveLetterOfCredit (submitted → approved, SUPER_ADMIN gate at MCP layer, self-approval blocked when submitter === approver — Phase 4.15d-1 pattern adapted to the LC schema); attachLcDocument (LetterOfCreditDocument row); recordLcPayment (presented_amount → presented; paid_amount → tolerance-checked against amount ± tolerance% or amount ± tolerance_amount → paid); listLettersOfCredit + getLetterOfCredit (eager-load documents/customer/supplier). 28 new convergence tests including tolerance edge cases. Full suite 577/577 green locally. **Phase 4.15 is now complete** (4.15a + 4.15b + 4.15c + 4.15d, ~60 tools across the sprint).

2026-05-16 Taiwan time (earlier). Phase 4.15c-3 — Sample management MCP tools (6). createSampleRequest (auto-sums totalQuantity from products[], validates each productId); approveSampleRequest (pending → approved with approvedBy + approvalDate); createSampleShipment (auto-promotes parent request approved/processing → shipped, supports multiple shipments for split deliveries); recordSampleFeedback (1–5 rating + quality/packaging/delivery axes, auto-escalates when rating ≤ 2); listSampleRequests + getSampleRequest (with shipments/feedback/customer eager-loaded). Stripped L-034 inline references from SampleFeedback (sampleRequestId / sentByContactId / handledBy). 24 new tests. Full suite 549/549 green locally. **Phase 4.15c is now complete** (c-1 + c-2 + c-3).

2026-05-16 Taiwan time (earlier). Phase 4.15c-2 — Quality / inspection MCP tools (9). schedule / start / complete inspection with explicit state machine (scheduled → in_progress → passed/failed/conditional); add + update inspection items (refused on finalized inspections); list + get inspection (with items/report/factory/inspector eager-loaded); generate + get inspection report (auto-derived findings: counts + per-checkpoint breakdown; one-to-one inspection ↔ report). 23 new convergence tests. Full suite 525/525 green locally.

2026-05-16 Taiwan time (earlier). Phase 4.15c-1 — Container loading MCP tools (5). createContainerLoad / optimizeContainerLoad (pure-math, no DB) / listContainerLoads / getContainerLoad / updateContainerLoad. Added `Product.cubicMeters` DECIMAL(10,4) + sentinel-guarded boot migration `migrate415c1ProductCubicMeters` (sentinel `phase4_15c1_product_cubic_meters_added`). 15 new convergence tests. Full suite 502/502 green locally. L-051 captured (Sequelize silently drops unknown attributes on Model.create).

2026-05-16 Taiwan time (earlier). Phase 4.15d-2b-2 — Compliance write MCP tools (6). create/update_compliance_record, create_hs_code (super_admin gate — HS codes are global reference), create_certificate_of_origin (row create; the PDF generator is the separate Phase 4.15a tool), get_compliance_dashboard. Defensive Shipment FK pre-check on CO create to avoid raw SQLITE_CONSTRAINT errors. 12 new tests (487/487 total locally). **Phase 4.15d is now complete** (4.15d-1 + 4.15d-2a + 4.15d-2b-1 + 4.15d-2b-2).

2026-05-16 Taiwan time (earlier). Phase 4.15d-2b-1 — Compliance read/calc MCP tools (8).

2026-05-16 Taiwan time (earlier). Phase 4.15b-1 — Landed Cost MCP tools (5). ProductPrice.validTo expiration check.

2026-05-16 Taiwan time (earlier). parsePdfRaw extraction — L-050 captured.

2026-05-16 Taiwan time (earlier). Phase 4.15d-2a — Product Specifications MCP layer (6 tools). 71-entry alias map powers QA lookup. 21 convergence tests.

2026-05-16 Taiwan time (earlier). Phase 4.15d-1 — Internal Approvals MCP layer (5 tools). Self-approval hard-blocked, assignee-only with super_admin override.

2026-05-16 Taiwan time (earlier). Phase 4.15a proper — patched brandedQuotationRenderer's 4 brand variants to accept opts.returnBuffer, built `pdfGenerationService.js`, wired 13 PDF generator MCP tools + 4 quotation CRUD MCP tools. 26 new convergence tests.

2026-05-16 Taiwan time (earlier). Phase 4.15a-prep — added `pipeToBufferOrDisk` helper in pdfHelpers + patched 12 of 13 disk-writing PDF generators across sales/order/logistics/finance to accept `opts.returnBuffer`. Backward-compat additive change. 9 regression tests.

2026-05-16 Taiwan time (earlier). Phase 4.14 hotfix — applied the L-048 Uint8Array wrap to `read_attachment`'s pdf branch (same one-line bug as parsePdf had pre-4.14). `read_attachment` was silently failing on the same subset of real PDFs the 4.14 parser fixed.

2026-05-16 Taiwan time (earlier). Phase 4.14 — Drive document parsers (xlsx, xls, docx, pdf, rtf) wired into `read_drive_file` via a shared `backend/services/driveDocumentParsers.js`. Optional narrowing (sheet_name, row_range, column_range, page_range, max_pages, raw_formulas). 25MB input cap + 200KB output cap + 10-min LRU cache. 23 new parser tests + a prod-smoke harness. L-048 (pdf-parse Buffer→Uint8Array bug on Node 22) and L-049 (SheetJS sheet_to_csv ignores `range`) captured.

2026-05-16 Taiwan time (earlier). Phase 4.13c — super_admin Lead sanctions override route. `POST /api/compliance/leads/:id/override`. Safety valve for jurisdiction false positives. 8 new tests.

2026-05-16 Taiwan time (earlier). Phase 4.13b — drop legacy `Lead.sanctionsScreened` boolean (kills L-044 state-inconsistency pattern) + fix `hasManualOverrideMarker` JSON-string parsing surfaced by 4.13a's prod run. Sentinel-guarded boot migration `migrate413bDropSanctionsScreened`. 6 new tests.

2026-05-16 Taiwan time (earlier). Phase 4.13a — jurisdiction screening (OFAC comprehensive: Iran, Cuba, DPRK, Syria). Closes the Phase 4.12 verification false-negative; sentinel-guarded boot migration re-screens existing rows while preserving manual_db_override markers. 41 new tests including the required Iran-positive CI gate.

2026-05-16 Taiwan time (earlier). Phase 4.12 — MCP write-tool / controller convergence (extracted shared aiWriteServices, closed the L-013 sanctions bypass on AI writes, added auditAiWrite to 12 MCP tools, fixed a silent NOT-NULL audit-write failure that had hidden every sanctions_block at lead-create time since C18). 21 new convergence tests.

2026-05-15 Taiwan time (end of day). Previous: Phase 4.9.3.1 (brand-aware fromAddress hotfix codified + MCP write-tool audit). Also that session: Phase 4.11 (MCP smoke harness + lazy googleapis), Phase 4.9.3 final F+G+H (describe_entity_db + ProductPrice cleanup + boot parity check), Phase 4.10 (migration framework), Phase 4.9.5 (REST current-price endpoint).

---

## CI Status
- **Latest commits on main (newest first):**
  - `<pending-commit>` refactor(ai-mcp): Phase 4.17 dead-code sweep — drop no-op ProductPrice.isActive update + fix misleading status text — local 619/619 green
  - `8ee420b` fix(schema): Phase 4.17 follow-up — drop orphan FK from ProductAttribute + patch migration plural-table bug — CI green, deployed
  - `821dd19` feat(approval): Phase 4.17 — Product approval modal + 3 endpoints + handler-noise gate — CI green, deployed
  - `baa018f` feat(ai-mcp): Phase 4.16.3 — widen create_product MCP surface (4 columns + free-form specs merge advertised in schema) — CI green, deployed
  - `a5d2033` fix(ai): Phase 4.16.2 — switch claude -p to stream-json so heartbeat sees per-event stdout — CI green, deployed
  - `50ebf87` fix(ai): Phase 4.16.1 — bump IDLE_TIMEOUT_MS 30s → 120s — CI green, deployed
  - `445f1d6` feat(ai): Phase 4.16 — SSE streaming + heartbeat-based subprocess liveness — CI green, deployed
  - `ff68428` fix(sanctions): Phase 4.13.6 — OFAC + EU URL repair + UA header + streak alert + weekly CI probe — CI green, deployed
  - `6f1d22b` docs(ai-mcp): Phase 4.15b-2 + 4.15c-1/2/3 — DEVELOPER_GUIDE + tooltipContent + helpContent — CI in progress
  - `4668020` feat(ai-mcp): Phase 4.15 wrap — Container/Inspection/Sample/LC MCP tools (27 + 4 services) — Phase 4.15 complete — CI green, deployed
  - `<pending-commit>` feat(ai-mcp): Phase 4.15c-3 — Sample management MCP tools (6 + service) + L-034 strip on SampleFeedback — local 549/549 green, awaiting push
  - `<pending-commit>` feat(ai-mcp): Phase 4.15c-2 — Quality / inspection MCP tools (9 + service) — local 525/525 green, awaiting push
  - `<pending-commit>` feat(ai-mcp): Phase 4.15c-1 — Container loading MCP tools (5 + service) + Product.cubicMeters migration — local 502/502 green, awaiting push
  - `<pending-commit>` feat(ai-mcp): Phase 4.15d-2b-2 — Compliance write MCP tools (6) — Phase 4.15d complete — local 487/487 green, awaiting push
  - `97e30cc` feat(ai-mcp): Phase 4.15d-2b-1 — Compliance read/calc MCP tools (8 + service) — CI green, deployed
  - `bcaac6a` feat(ai-mcp): Phase 4.15b-1 — Landed Cost MCP tools (5 + service) — CI green, deployed
  - `c7e5a2c` refactor(ai-mcp): extract parsePdfRaw — read_drive_file + read_attachment share one PDF code path (L-050) — CI green, deployed
  - `88f0e4b` feat(ai-mcp): Phase 4.15d-2a — Product Specifications MCP tools (6 + service) — CI green, deployed
  - `66645a5` feat(ai-mcp): Phase 4.15d-1 — Internal Approvals MCP tools (5 + service) — CI green, deployed
  - `53ffa22` feat(ai-mcp): Phase 4.15a proper — pdfGenerationService + 13 PDF MCP tools + 4 quotation CRUD MCP tools — CI green, deployed
  - `7625e02` refactor(pdf): Phase 4.15a-prep — pipeToBufferOrDisk helper + 12 generators accept opts.returnBuffer — CI green, deployed
  - `3676445` fix(ai-mcp): Phase 4.14 hotfix — L-048 Uint8Array wrap for read_attachment pdf branch — CI green, deployed
  - `2db54c0` feat(ai-mcp): Phase 4.14 — Drive document parsers (xlsx/xls/docx/pdf/rtf) for read_drive_file — CI green, deployed
  - `ec7782c` feat(compliance): Phase 4.13c — Lead sanctions override route — CI green, deployed
  - `4546d03` refactor(schema): Phase 4.13b — drop sanctionsScreened boolean + fix JSON-string parsing — CI green, deployed
  - `95222db` feat(compliance): Phase 4.13a — jurisdiction screening for OFAC-comprehensive countries — CI green, deployed
  - `58a22e3` feat(ai-mcp+backend): Phase 4.12 — MCP write-tool / controller convergence — CI green, deployed
  - `35b7982` docs(session): refresh through Phase 4.9.3.1 + Phase 4.11
  - `fb65da0` feat(ai-mcp): Phase 4.9.3.1 — codify brand-aware fromAddress + audit MCP write tools — CI green, deploy in progress
  - `a67ec9f` test(mcp): Phase 4.11 — MCP tool smoke-test harness + lazy googleapis — CI green, deployed
  - `a598a5b` feat(ai-mcp+infra): Phase 4.9.3 (final) Parts F + G + H — describe_entity_db + ProductPrice cleanup + parity check — CI green, deployed
  - `b771c13` feat(pricing): Phase 4.9.5 — REST current-price endpoint + admin form soft-deprecation
  - `559eb83` feat(infra): Phase 4.10 — formalise migration framework (bootstrap + contract)
  - `de61da6` docs(session): refresh through Phase 4.9.3
  - `58f27af` docs(ai): Phase 4.9.3c — three-surface docs for 4.9.3a + 4.9.3b
  - `7d046a3` feat(ai-mcp): Phase 4.9.3b — outreach draft mode + Drive multi-account routing
  - `aadd92c` feat(ai-mcp): Phase 4.9.3a — Customer + Product CRUD MCP tools
  - `11b47d3` fix(rate-limit): Phase 4.9.4 — stop self-DOS via poll exempt + auth-first ordering
  - `1902edd` feat(pricing): Phase 4.9.2c — Price History panel + 4 MCP tools + docs
  - `a50d6f5` feat(pricing): Phase 4.9.2b — ProductPrice temporal replace + getCurrentPrice
  - `fd32688` feat(factory+taxonomy): Phase 4.9.2a — Factory.brandCode + match filter + MCP ext + sortOrder fix
  - …earlier: full 4.9.1 + 4.7+ + Phase 5 + Phase 4.9 chain (see git log).
- **Working tree on VM:** clean (only the usual untracked backups/ecosystem.config.js/local artifacts).
- **Tests:** 148/148 integration passing locally (Windows). On VM: smoke + cross-process MCP tests run via `npx jest` (no supertest installed → full suite is CI-only). New this session: 6 mcpSmoke + 3 mcpFromAddress493_1 tests, all green.
- **Backend health:** live at `https://erp.sovernhouse.co/api`. All boot-time migrations sentinel-recorded in AuditLog through `phase4_9_3_g_product_price_cleanup`. Boot-time parity check (Phase 4.9.3 final Part H) reports "checked 104 model(s) clean, 0 with mismatch(es)."
- **The Phase 4.9.3.1 hotfix is already running live on the VM** (Alex applied it directly before this session). The git history catches up via `a67ec9f` (carried the fix code accidentally because the file was already patched on disk) + `fb65da0` (schema update, 3 integration tests, audit table, SQLITE_STORAGE test enabler).
- **Mobile parity:** N/A for this session's commits — Phase 4.11 (test infra) and Phase 4.9.3.1 (MCP-only schema + tests + audit) don't touch user-facing surfaces. No mobile rebuild needed. Last EAS push from the prior session covered the user-facing changes through 4.9.3.

## Next Session — Pick Up Here (Phase 4.15a proper)

The 4.15a-prep commit shipped the foundation: `pipeToBufferOrDisk` helper + 12 of 13 disk-writing generators accept `opts.returnBuffer`. 4.15a proper now builds on top:

1. **Patch brandedQuotationRenderer's 4 variants** (SH classic + FW IronLite + FW private label + FW generic) to accept opts and use the helper. Each is its own Promise + stream + resolve. ~600 LOC of patching that needed a fresh session.
2. **Patch pdfTemplates.js** (Certificate of Origin, advanced packing list) — verify shape first; may already be Buffer-returning.
3. **Build `backend/services/aiWriteServices/pdfGenerationService.js`**: wraps a generator call with returnBuffer:true, uploads Buffer to brand-appropriate Drive folder (SH → Documents/<category>/, FW → Brand Assets/Documents/<category>/), creates Document row in DB, audits as `ai_assistant_generate_<category>_pdf`, returns `{ driveFileId, driveUrl, documentRowId, fileName, sizeKB }`.
4. **Extend Drive folder tree** in `driveStructureSetup.js` to add the Documents/<category>/ subtree on both accounts. Sentinel-guarded boot migration adds the new folders to existing installs.
5. **Wire 13 MCP generator tools** in erpToolServer.js (erp_generate_quotation_pdf, _invoice_pdf, _proforma_invoice_pdf, _purchase_order_pdf, _packing_list_pdf, _certificate_of_origin_pdf, _credit_note_pdf, _inspection_certificate_pdf, _product_spec_sheet_pdf, _sales_note_pdf, _sales_order_pdf, _shipment_document_pdf, _statement_of_account_pdf). Each ~15 lines.
6. **Extend quotationWriteService** with `updateQuotation` + `archiveQuotation` (create already exists per Phase 4.12).
7. **Wire 4 quotation CRUD MCP tools** (update, get, list, archive). `create_quotation` already exists.
8. **Tests** — convergence-style: sanctions block on create, brand scope on update, Drive upload + Document row on each generator.
9. **Docs** — DEVELOPER_GUIDE section + tooltipContent + helpContent + USER_GUIDE subsection.

## Carry-over (still open from earlier sessions)
- **Phase 4.13a deploy + boot-migration verification:**
  1. After deploy, query `AuditLog WHERE action='phase4_13a_jurisdiction_backfilled'` on the VM — confirm one row exists with stats `{ rescreened, statusChanged, manualOverrideSkipped, alreadyProtected }`.
  2. Confirm the existing Iran Lead (id `bf055c3f-c2d3-4db9-8100-bcad7c4664eb`) was NOT touched: `screening_status` still `'blocked'`, `sanctions_screen_details[0].reviewer === 'manual_db_override'` preserved, no new `phase4_13a_jurisdiction_rescreen` AuditLog row against that entity_id.
  3. AI assistant chat → SH context → "create a lead for X at y@z.com in Iran". Must refuse with `sanctions_block`. Confirm new `sanctions_block` AuditLog row carries `changes.hits[0].rule === 'jurisdiction'` and `basis` cites 31 CFR Part 560.
- **Then 4.13b/c/d** (per the approved 4-commit split):
  - 4.13b — drop the `sanctionsScreened` legacy boolean via Phase 4.10 sentinel boot migration. Kills the L-044 state-inconsistency pattern.
  - 4.13c — `POST /api/compliance/leads/:id/override` super_admin route (mirrors customer override). Adds the safety valve for jurisdiction-screen false positives.
  - 4.13d — JurisdictionRule DB table + admin CRUD + full authority/scope matrix (OFAC/EU/UK/UN × comprehensive/sectoral) + Customer/Quotation parameterization + mobile UI for jurisdiction warnings (L-035).
- **Step 3 audit query** (held until 4.13a deploys per Alex): confirm 12 new `ai_assistant_*` actions appear after a Phase 4.13a-era usage window.
- **Carryover from Phase 4.9.3.1:** AI assistant chat mode, FW context, ask "describe the send_outreach_email tool" — confirm the new `fromAddress` parameter appears in the schema with the Phase 4.9.3.1 resolution description.
- **Phase 4.11 smoke harness now in place** — future MCP changes should add a smoke case for any new high-value tool (template: see `backend/__tests__/integration/mcpSmoke.test.js`). Data-flow tests follow the `mcpFromAddress493_1.test.js` template (SQLITE_STORAGE override + MCP_FORCE_SYNC=false on subprocess + shared file SQLite).
- **Brands on prod:** SH active commission=0%, FW active commission=7% (HanHua Sales Rep Agreement), HH inactive.
- **Taxonomy on prod:** Flooring → Resilient → SPC/WPC/Engineered SPC/LVT/Vinyl Sheet (Resilient sortOrder=2, EngSPC=3, LVT=4, Vinyl Sheet=5). Engineered Wood + remaining flooring rows direct children of Flooring. IronCore Flooring + WPC Hybrid Flooring archived. Orphan `ProductCategory` (singular) renamed to `ProductCategory_orphan_20260515`; 18 rows preserved (~30 day retention; safe to DROP after 2026-06-15).
- **Factories on prod:** Anhui HanHua + FlorWay SDN. BHD. both `brandCode='FW'`.
- **Pricing on prod:** new temporal ProductPrice schema live. `Product.baseFobPrice` retained as denormalized cache (afterSave hook keeps it in sync). 0 ProductPrice rows because 0 priced Products on prod yet (IronLite SKU phase populates).

---

## Phase 4.14 — SHIPPED (LOCAL, AWAITING PUSH)

Drive document parsers for `read_drive_file` so the AI assistant can ingest xlsx, xls, docx, pdf, and rtf without per-file manual conversion. Closes the today-session blocker on the IronLite HanHua xlsx ingestion. Spec was authored end-to-end by Alex (Parts A–J); see commit message for the four locked-in design points (target tool, formula handling, fixture strategy, follow-up scope).

### Parser library
- New: `backend/services/driveDocumentParsers.js` — pure, stateless parsers + dispatch + size caps. Same module will be ported to the Cowork sovern MCP server in Phase 4.14.1.
- xlsx/xls via SheetJS (`xlsx`). Computed-values default; `raw_formulas:true` opt-in flag emits formula source. Per L-049, `sheet_to_csv` ignores its `range` option — we walk cells manually for both modes via a shared `csvForRange` helper.
- docx via `mammoth` (already in deps). `max_pages` heuristic via 3000 chars/page; legacy `.doc` returns the documented guidance message.
- pdf via `pdf-parse` (already in deps). Per-page output with `=== Page N ===` markers; `page_range` narrowing. L-048: Buffer→Uint8Array wrap required on Node 22, applied here. <100-char output triggers the OCR-not-supported guidance message; encrypted PDFs return a clean `pdf_encrypted` error rather than crashing.
- rtf via `rtf-parser` (new dep). Plain text with paragraph breaks.

### MCP wiring
- `read_drive_file` handler in `backend/mcp/erpToolServer.js` rewritten to dispatch through `parseByMime` for all Phase 4.14 mime types, preserving the existing Google Docs/Sheets/text/csv branches behind the same 200KB output cap.
- New optional schema params: `sheet_name`, `row_range`, `column_range`, `raw_formulas`, `page_range`, `max_pages`. Tool description rewritten to advertise the supported mime types + narrowing levers + workarounds for the unsupported set.
- New helpers in erpToolServer.js: `brandScopeForMcp` (already from 4.12), `getDriveReadCache` (10-min LRU, 50 entries, keyed on fileId+accountKey+every narrowing param), `applyDriveReadOutputCap` (shared with parsers for the legacy branches).
- accountKey/brandCode routing unchanged from 4.9.3b. Same parser layer serves both SH and FW Drive accounts.

### Size + output limits
- 25MB soft input cap. Above this, `file_too_large` with a message telling the caller which narrowing params to use.
- 200KB hard output cap. Truncation marker explicitly lists every narrowing param so the caller knows the lever to pull next.

### Tests
- New: `backend/__tests__/integration/phase414DriveDocumentParsers.test.js` — 23 specs covering all five formats, every optional param, size caps, mime dispatcher, OCR detection, legacy-doc guidance, encrypted-PDF handling, invalid range params. Inline fixtures: xlsx via SheetJS write, docx via JSZip (transitive dep), pdf via pdfkit (new devDep), rtf hand-crafted, image-only pdf via pdfkit. Zero committed binary fixtures.
- New: `backend/__tests__/prod-smoke/drive-parsers.smoke.js` — real-Drive integration tests against `DRIVE_SMOKE_XLSX_FW` + `DRIVE_SMOKE_DOCX_SH` + `DRIVE_SMOKE_PDF_SH`. Runs only when `DRIVE_SMOKE_FIXTURES=true`. CI never sets that env. Skipped suites use `describe.skip` so partial fixture sets still run the available ones.
- Full backend suite 365/365 passing locally (was 342 before 4.14).

### Lessons captured
- **L-048** — pdf-parse 1.1.4 on Node 22 throws "bad XRef entry" on valid PDFs when fed a Node Buffer. Uint8Array wrap fixes it. Same bug latent in `read_attachment` — flagged for follow-up audit.
- **L-049** — SheetJS `sheet_to_csv` silently ignores `range`. Walk cells manually.

### Docs
- `DEVELOPER_GUIDE.md` — new "Phase 4.14 — AI assistant Drive document ingestion" section: full mime list, optional params, output shapes, workarounds, size limits, LRU cache, three-surface check, lessons, smoke-harness usage, 4.14.1 follow-up note.
- `tooltipContent.js` — `aiDocumentIngestion` tooltip.
- `helpContent.js` — `/ai/assistant` "Finding and reading documents in Drive" section updated with the Phase 4.14 capabilities + concrete example phrasings the assistant understands.
- `docs/USER_GUIDE.md` — new "AI Assistant — Reading documents from Drive (Phase 4.14)" subsection.

### Out of scope (deferred)
- **Phase 4.14.1**: mirror the same parsers in the Cowork `sovern` MCP server (`mcp__sovern__sovern_drive_read`). Same contract, separate repo. Tracked as a follow-up so global Claude Code DX matches the ERP chat DX.
- Audit `read_attachment` for the L-048 Uint8Array bug. May be silently failing on a subset of real PDFs.
- OCR for image-based PDFs. Tesseract + cloud-OCR options are heavy; defer until a real workflow needs it.
- pptx parsing. Sales decks are rare in operations.
- Write-side document generation (still owned by the Cowork "ms-office-suite" plugin).

### Mobile parity
N/A — Phase 4.14 is backend-only. Mobile already uses the same `/api/ai/chat` endpoint, so parser capability is inherited transparently.

---

## Phase 4.13c — SHIPPED (PROD GREEN)

Super_admin Lead sanctions override route. Safety valve for jurisdiction false positives introduced in 4.13a (exotic country spellings that don't match the alias map, legitimate counterparties with OFAC general licenses, etc.). Mirrors the existing customer override at `/api/compliance/customers/:id/override`.

### Route
`POST /api/compliance/leads/:id/override` — super_admin only, requires `reason >= 10 chars`.
- Sets `lead.screeningStatus = 'override'` (already in the enum; downstream code in customerController.create + quotationWriteService.createQuotation gates only on `'flagged'`, so 'override' implicitly unblocks).
- Appends an `override` hit to `sanctions_screen_details` carrying `reviewer: 'super_admin'`, `reviewerUserId`, `reviewerEmail`, and the reason as the `basis`. Prior hits are preserved (e.g. the original jurisdiction hit + any `manual_db_override` chain).
- Writes a `sanctions_override` AuditLog row with `priorStatus`, `priorHits`, `reason`, `overriddenBy`, `overriddenAt`.
- Lead has no `isActive` column (unlike Customer), so the route does not toggle one. Downstream gates treat `screeningStatus='override'` as the unblock signal.

### Files changed
- Edited: `backend/modules/compliance/complianceRoutes.js` — new route block. Imports already present.
- New: `backend/__tests__/integration/phase413cLeadOverride.test.js` — 8 tests: super_admin happy path, AuditLog row shape, reason < 10 chars, missing reason, 404 on unknown id, 403 for non-super_admin, 401 for unauthenticated, manual_db_override hit preservation when applying a new override.

### Mobile parity
N/A — backend-only. 4.13d will add the desktop + mobile UI for surfacing the override path to super_admin per L-035.

---

## Phase 4.13b — SHIPPED (PROD GREEN)

Drops the legacy `Lead.sanctionsScreened` BOOLEAN column. Phase 1 holdover kept "for read compatibility" but nothing kept it in sync with the C18 `screeningStatus` enum, which created the L-044 state-inconsistency visible on prod (sanctionsScreened=false + lastScreenedAt populated + screeningStatus=cleared all on the same row). Customer table never had the column — verified pre-removal via grep.

### Changes
- `backend/models/Lead.js` — `sanctionsScreened` field removed; comment block explains the L-044 rationale and points readers at the migration.
- `backend/services/migrate413bDropSanctionsScreened.js` — new sentinel-guarded boot migration. `ALTER TABLE "Leads" DROP COLUMN "sanctions_screened"` (SQLite 3.35+, well within our deps). Sentinel: `phase4_13b_sanctions_screened_dropped`.
- `backend/server.js` — wired after `migrate413aJurisdictionBackfill`.
- `backend/services/migrate413aJurisdictionBackfill.js` — bundled fix: `hasManualOverrideMarker` now parses string-form JSON before checking the array. Surfaced by the prod 4.13a backfill: the Iran row's marker was stored such that Sequelize returned the field as a stringified payload; `Array.isArray()` short-circuited false, and the row only survived via the unrelated PROTECTED_STATUSES fallback. A row with the marker + `screeningStatus='pending'` would have been clobbered. **L-047** captured.
- `backend/__tests__/integration/phase413bDropSanctionsScreened.test.js` — 6 new tests: model has no attribute, table has no column, Lead.create works without it, migration is idempotent, hasManualOverrideMarker handles string form, end-to-end backfill counts manualOverrideSkipped correctly when details arrive as a string.
- `backend/__tests__/integration/phase413aJurisdictionScreen.test.js` — manual-override-preservation seed no longer sets `sanctionsScreened`.

### Lessons captured
- **L-047** — Sequelize DataTypes.JSON on SQLite can return strings; helpers reading JSON columns must accept both array and string forms.

### Mobile parity
N/A. Backend-only.

---

## Phase 4.13a — SHIPPED (PROD GREEN)

Jurisdiction screening for OFAC comprehensive sanctions countries. First commit of the approved 4-commit Phase 4.13 split. Closes the live production compliance bug surfaced during Phase 4.12 verification: a Lead with `country='Iran'` cleared the sanctions screener because the pre-4.13a logic only fuzzy-matched names against the OFAC SDN list. Country-level comprehensive sanctions (ITSR / CACR / NKSR / SySR) were not enforced.

### What's enforced now (4.13a scope)
Four OFAC comprehensively-sanctioned countries hardcoded in `JURISDICTION_BLOCK`:
- Iran (IR) — ITSR 31 CFR Part 560 / EO 13599
- Cuba (CU) — CACR 31 CFR Part 515
- North Korea (KP) — NKSR 31 CFR Part 510
- Syria (SY) — SySR 31 CFR Part 542

Country normalization handles ISO-2 codes, full English names, lowercase, parentheticals ("Iran (Islamic Republic of)"), and common aliases (Persia, DPRK, etc.). Unknown countries fall through to `cleared` — false positives on legitimate counterparties are worse than a missed exotic spelling, and 4.13c's override route is the safety valve.

### Where the screen runs
`sanctionsService.screenJurisdiction(country)` is a new top-level helper. `sanctionsService.screenName(name, country)` now composes both signals: a jurisdiction match alone is sufficient to flag, and on a combined hit the hits arrays concatenate so the audit row carries every reason with the regulation basis citation. No call-site changes needed — the existing service-layer hard-blocks in `leadWriteService.createLead` + `quotationWriteService.createQuotation` already gate on `screen.status === 'flagged'` and now fire for jurisdiction matches automatically.

### Boot-time backfill
New file: `backend/services/migrate413aJurisdictionBackfill.js`. Wired into `server.js` after `migrateSanctionsC18`. Sentinel: AuditLog action `phase4_13a_jurisdiction_backfilled`. For each Lead + Customer with a country set:
- Skip rows already at `flagged` / `blocked` / `override` (PROTECTED_STATUSES).
- Skip rows carrying a `reviewer: 'manual_db_override'` marker in `sanctions_screen_details` (preserves Alex's manual block on prod Lead `bf055c3f-c2d3-4db9-8100-bcad7c4664eb`).
- For everything else, run the new screen. If it flags via jurisdiction, update `screening_status='flagged'`, append the jurisdiction hits to `sanctions_screen_details`, set `last_screened_at=now`, and write a `phase4_13a_jurisdiction_rescreen` AuditLog row per entity.

### Required CI gate (don't delete from the test file)
`backend/__tests__/integration/phase413aJurisdictionScreen.test.js` is intentionally structured so that the very first describe block is the Iran-positive test. "4.13a CI green" must mean "the Iran false-negative cannot recur." 41 new tests total: 4 jurisdictions × multiple aliases each, 11 negative cases (USA, China, Mexico, India, Germany, Japan, etc.), screenName composition cases, empty-input cases, manual-override preservation.

### Lessons captured
- **L-046** — Sanctions screening must compose multiple signals; entity-level SDN match alone is not enough. Country-level jurisdiction signal must run independently and concatenate into the same `{ status, hits, screenedAt }` shape.

### Files changed
- New: `backend/services/migrate413aJurisdictionBackfill.js`
- New: `backend/__tests__/integration/phase413aJurisdictionScreen.test.js`
- Edited: `backend/services/sanctionsService.js` (JURISDICTION_BLOCK + COUNTRY_ALIASES + screenJurisdiction + screenName composition)
- Edited: `backend/server.js` (wire boot migration)

### What 4.13a does NOT do (deferred per spec)
- Drop the legacy `sanctionsScreened` boolean → 4.13b
- Super_admin override route for jurisdiction false positives → 4.13c
- JurisdictionRule DB table + admin CRUD + full authority/scope matrix + Customer/Quotation parameterization + mobile UI → 4.13d (covers L-035)

### Mobile parity
N/A in 4.13a (backend-only). 4.13d covers the L-035 mobile-warning UI.

---

## Phase 4.12 — SHIPPED (PROD GREEN)

MCP write-tool / controller convergence. Pulled the inline business logic out of leadController.create/update/delete, quotationController.create, factoryController.create/update/delete, and contactController.create/update/delete into a shared service layer under `backend/services/aiWriteServices/`. Both REST controllers and MCP handlers now call the same service functions — sanctions screening, brand-scope enforcement, leadNumber generation, ProductPrice floor checks, and audit logging happen exactly once per write surface.

### Closed compliance gaps
- **create_lead via MCP** was bypassing OFAC/sanctions screening (L-013 violation). Now hard-blocks identically to REST, with a `sanctions_block` AuditLog row carrying `source: 'mcp'`.
- **create_quotation via MCP** was bypassing the `customer.screeningStatus === 'flagged'` hard-block. Same convergence: identical block, identical audit shape.
- **create_lead** now defaults brandCode from the requester's `defaultBrand` (was hard-coded none).
- **send_email via MCP** refuses to send via a ConnectedGoogleAccount whose brandCode is outside the requester's accessibleBrands (mirrors triageController.brand_account_mismatch_block).

### Closed audit-trail gaps (12 tools)
Every MCP write tool now writes an `ai_assistant_<tool>` AuditLog row on success:
- create_lead, update_lead
- create_factory, update_factory, delete_factory
- create_contact, update_contact, delete_contact
- schedule_follow_up (for both outreach_email and lead scopes)
- create_quotation
- approve_product
- send_email (and a `send_email_blocked` row on brand-mismatch refusal)

### Hidden bug discovered + fixed
**L-044** — Every `sanctions_block` audit row at Lead-create time had been silently failing to land since C18. `AuditLog.entityId` is NOT NULL but the pre-create path passed `null`; the `.catch(() => {})` swallowed the SQLITE_CONSTRAINT failure. Fix: generate a placeholder UUID and stash `preCreate: true` in `changes`. Existing rows in prod are unaffected (there weren't any).

### Pattern lesson captured
**L-045** — When a service layer exists, both REST and MCP must call it. No more per-surface duplication of compliance logic.

### Test coverage
- New file: `backend/__tests__/integration/mcpControllerConvergence.test.js` — 21 service-layer tests covering happy paths, sanctions hard-blocks, cross-brand refusal, brand_not_writable, before/after snapshots, open-PO delete block, contact validation, immutable brandCode on update path.
- Local: 284/284 backend tests green (was 263 before Phase 4.12).
- MCP subprocess smoke harness (Phase 4.11) untouched — its :memory: SQLite still can't see the service-layer writes; that's by design. Cross-process convergence is verifiable on prod via the AuditLog query.

### Files changed
- New: `backend/services/aiWriteServices/leadWriteService.js`, `quotationWriteService.js`, `factoryWriteService.js`, `contactWriteService.js`
- New: `backend/__tests__/integration/mcpControllerConvergence.test.js`
- Edited: `backend/controllers/leadController.js` (createLead/updateLead/deleteLead delegate to service)
- Edited: `backend/controllers/quotationController.js` (create delegates to service; legacy inline block removed)
- Edited: `backend/controllers/factoryController.js` (create/update/delete delegate to service)
- Edited: `backend/controllers/contactController.js` (create/update/delete delegate to service)
- Edited: `backend/mcp/erpToolServer.js` (brandScopeForMcp + formatMcpWriteError helpers added; 12 handlers refactored)

### Mobile parity
N/A. MCP-only change. No user-facing surfaces touched.

---

## Phase 4.9 — IN FLIGHT

Multi-origin products + tariff rates + landed-cost quotations. Ordered as 4.9a → 4.9b → 4.9c → 4.9d → 4.9e per Alex's approved sequence. Must ship before Phase 5 (offline mode).

### 4.9a — Product.originVariants — SHIPPED (`bb22fdd`, deploy green)

- Product gains `originVariants JSON NOT NULL DEFAULT []`. Variant: `{ originCountry, fobPriceUsd, priceUnit, moqOverride?, leadTimeOverride? }`.
- Backfill service `migrateProductOriginVariantsC49a.js` with sentinel `phase4_9_c1_product_origin_variants_backfilled`.
- productController create + update accept `originVariants`.
- Desktop ProductForm: add/remove origin variant rows (origin country / FOB / unit / MOQ override / lead time override).
- Mobile product detail modal: read-only origin variants list.

### 4.9b — TariffRate model + admin CRUD — SHIPPED (`5c80429`, CI running)

- Backend: `TariffRate` model (UUID, originCountry, destinationCountry, ratePercent DECIMAL(7,4), effectiveFrom, effectiveUntil, sourceNote, nullable brandCode). Controller exposes list / expiring / create / update / remove + `getCurrentTariff(origin, destination, brandCode, asOfDate)` helper for the upcoming 4.9c landed-cost flow. Routes: read = any auth user, mutations = super_admin (L-031). All mutations audited.
- Seed (`seedTariffRatesC49b.js`, sentinel `phase4_9_c2_tariff_rates_seeded`): CN→US 40.7714% + MY→US 15.5214%, both `2026-05-14` → `2026-05-15` (intentional short window so 4.9e date-warning fires immediately).
- Desktop: `/settings/tariff-rates` super-admin page. Grouped table by origin→destination, expiry badges (red expired / amber ≤7d), inline DraftRow editor, Show expired toggle. Super-admin sidebar entry.
- Mobile (L-035): `app/tariff-rates.tsx` read-only list with same expiry badges + Show expired toggle. Mutations stay desktop-super-admin only by design.
- DEVELOPER_GUIDE section added.

### 4.9c — Landed-cost + display-unit toggle — SHIPPED (`d7340b6`, CI running)

- Bundles per-line origin + tariff snapshot + landed-cost PDF (C-3) with the area/dimension unit-display toggle Alex requested (one commit because both touch the same surfaces).
- Backend: QuotationItem gains originCountry / fobPriceUsd / tariffSnapshot / landedCostUnit / landedCostTotal. Quotation gains displayAreaUnit + displayDimensionUnit (lock at send via existing draft-only update guard). New `backend/utils/unitConversion.js` + mirror `frontend/shared/units.js`. Storage stays canonical (USD/m², mm); conversion at render boundary only — no backfill needed. Controller: create/update accept originCountry per line, resolve FOB from Product.originVariants. send(): for US destinations, snapshot per item via `getCurrentTariff` and persist landed-cost on the row.
- PDF: `drawFwItemsTable` now reads quotation.displayAreaUnit and converts area-based qty + unit price; new `drawLandedCostBreakdown` 6-col table renders after totals when any item has a snapshot. Non-US quotations look identical.
- Desktop UI: unit toggle pills, per-line origin select that auto-fills FOB, USA landed-cost preview per line with amber expiry warning, floor-hint converts to chosen area unit.
- Mobile UI: same toggles + origin pills + USA preview block.
- Tests: 11 new unitConversion cases (230/230 total).

### Brand MCP — SHIPPED (`6f4421b`, deployed green)

- `list_brands` (any auth user, read-only).
- `create_brand` (super_admin). Validates code 2-8 uppercase, valid senderEmail, both colors as 6-digit hex. commissionRate default 0.05. Refuses to overwrite an existing code.
- Tool descriptions instruct the assistant to call list_brands BEFORE any brandCode-referencing tool and to preview+confirm with Alex before create_brand fires.
- Unblocks the HanHua / HH workflow: AI assistant can now provision HH inline before calling create_product.

### 4.9c follow-up — TariffRate.components breakdown — SHIPPED (`3a15141`)

Single opaque ratePercent replaced with components JSON `[{name, ratePercent, note?}]`. Sum auto-computes ratePercent. Backfill migration converts existing rows. PDF + desktop preview + mobile preview + admin CRUD all show the breakdown ("MFN base 3.2%, Section 301 25.0%, IEEPA reciprocal 10.0%, IEEPA fentanyl 2.15%, MPF 0.3464%, HMF 0.075% → 40.7714%"). Sentinel `phase4_9_c3_2_tariff_rate_components_backfilled`.

### 4.9d — Bulk import + CSV template — SHIPPED (`4c379b0`)

`GET /api/tariff-rates/template.csv` + `POST /api/tariff-rates/bulk-import`. Multipart file or JSON body. Each row is one tariff entry; named component columns (mfnBase, section301, section232, ieepaReciprocal, ieepaFentanyl, adCvd, mpf, hmf) plus two free-form pairs (otherNameN/otherRateN) become the components breakdown. Upsert key (origin, destination, effectiveFrom). Per-row errors don't abort; response carries inserted/updated/errors with CSV line numbers. Desktop toolbar Template + Bulk import buttons added. No mobile UI (super-admin desktop workflow).

### 4.9e — Tariff expiry warning UI — SHIPPED (`88a5e66`)

Dashboard widget (desktop + mobile, L-035 parity): self-hiding amber card listing tariffs in the [-30, +7] day window. Send-confirm warning on QuotationDetail: pre-flight per-line tariff check for US destinations. **Hard-block** when a line has origin but no active tariff (confirm button disabled). **Soft warn** when an active tariff expires within 7 days. ConfirmDialog gained `children` + `disableConfirm` props.

### Phase 4.9 is COMPLETE.

---

## Phase 5 — SHIPPED (offline mode)

7 commits. 5b explicitly skipped per prior PWA-cache kill-switch history.

| Commit | Phase | What |
|---|---|---|
| `e5b049d` | 5a | useConnectivity hook + OfflineBanner (desktop + mobile). 15s /api/health ping as the tiebreaker. |
| n/a | 5b | SKIPPED — public/sw.js documents a prior cache disaster. Revisit only with version-pinned cache key. |
| `bdc1319` | 5c | Desktop IndexedDB read-through cache for whitelisted GETs. Synthetic success on network failure. 24h TTL. Cache wipes on logout for brand isolation. |
| `4b06105` | 5d | Mobile AsyncStorage mirror of 5c. authStore now persists user blob so the fetch wrapper can read the user id without a circular dep. |
| `b38f878` | 5e | Desktop write queue (leads/contacts/activities/scheduled-activities/expenses/notes). FIFO replay on reconnect. Synthetic 202 with `_queued: true` on offline write. |
| `eade02e` | 5f | Mobile mirror of 5e. AsyncStorage queue + same outcome categories. |
| `5c71976` | 5g+5h | Inspector UI (`/settings/offline-queue` desktop, `/offline-queue` mobile) + `POST /api/audit-logs/offline-replay` for cross-device replay history. |

Tests still 240/240. Mobile parity holds for every surface per L-035.

Known limitations documented in DEVELOPER_GUIDE: duplicate on network-cut-after-send (mitigation deferred), 5s reconnect polling lag (acceptable), no collaborative conflict resolution (write allow-list is curated to avoid surfaces where it matters today).

---

## Phase 4.7 — SHIPPED

Three commits closing real gaps in Phase 4.5 and adding the Drive folder structure + proactive upload-suggestion behavior. C-2 (FW signature) and the bulk of C-1 (WRITE/ACTION tools) were already live from Phase 4.5; the spec items were verified rather than redone.

### C-1 gap-closer (commit `41b60a1`, deploy green)
- send_email tool accepts optional from_email. Routes to alex@sovernhouse.co for SH context, alexflorway@gmail.com for FW/IronLite/HanHua context. Both ConnectedGoogleAccounts are active so the previous "auto-pick first active" was non-deterministic.
- getGoogleAuth(targetEmail) helper extended.
- System prompt: tighter hard refusals adds explicit lines for "delete a Brand row, ever" and "change a User role / super_admin grants or revocations" beyond the broader categories already in place.
- aiContextService system prompt: new "Sender account routing" subsection under email safety rule. Tells the model to always pass from_email explicitly and to ask Alex when the brand context is ambiguous rather than guess.

### C-3 Drive folder structure setup (commit `6b81895`, CI in progress)
- New backend/services/driveStructureSetup.js. FOLDER_TREE: 2 top-level + 6 nested folders. findOrCreateFolder helper mirrors the aiController.js pattern. setupForAccount + setupDriveStructureForAllAccounts.
- New backend/routes/adminRoutes.js. POST /api/admin/drive-setup (super_admin only, L-031). Idempotent. Returns { folderTree, accounts: { email: { path: { id, created, webViewLink } } } }.
- Server wires adminRoutes alongside brandRoutes at /api.
- Each successful account run writes admin_drive_setup AuditLog row with folderCount, createdCount, tree.
- DEVELOPER_GUIDE.md gets a new "Drive folder structure setup (Phase 4.7, C-3)" section.
- Bulk upload of the local IronLite Branding folder is intentionally NOT in scope (the Linux VM can't see C:\). Alex opens the returned webViewLink and drags the 5 items in via drive.google.com.

### C-4 Proactive upload suggestion (this commit)
- aiContextService system prompt: new "Proactive upload suggestion when search returns empty" paragraph. When search_drive_files returns no matches, the AI proposes an upload destination based on filename heuristics (IronLite → Brand Assets/IronLite Branding/, contract → Operations/Contracts/, PI / factory / HanHua → Operations/Factory Communications/, template → Operations/Templates/, etc.). Tells Alex he can drag-drop via drive.google.com.
- Reply template documented in the prompt so the AI is consistent.
- Refusal: never invent a Drive link when search returned nothing.
- This is pure prompt behaviour. No new tools. No mobile change required (mobile assistant uses the same /api/ai/chat backend).

---

## Phase 4.6 — SHIPPED (perf sweep)

Mobile list-perf pattern applied across 13 tab + shared screens. Standard recipe per screen:
- Row component wrapped in React.memo.
- renderItem + keyExtractor extracted to useCallback for stable refs.
- Search/status filter via useMemo (was useEffect+setFiltered double-render anti-pattern, where it applied).
- FlatList virtualization tuned: removeClippedSubviews on Android, initialNumToRender=10-12, maxToRenderPerBatch=8-10, windowSize=10.

| Commit | Files |
|---|---|
| `077b728` | dashboard.tsx (MetricCard + ModuleTile + stable handlers + memoized updated label) |
| `c2a23ac` | BrandFilterPicker (memo'd Pill + outer React.memo) + CommissionWidget (memo'd Tile + memoized fmtMoney) |
| `8f08b0c` | quotations.tsx + factories.tsx (worst setFiltered pattern, biggest win) |
| `5bf5f3b` | sales-orders.tsx + purchase-orders.tsx + invoices.tsx + triage.tsx + approvals.tsx |

Customers.tsx + leads.tsx are in `1d0b290` (originally C22 in Phase 4.5). Products.tsx already uses useMemo via C21.

### Deferred perf (Phase 5 candidates)

Lower-value tab screens with FlatList but without the worst patterns. Audit when Alex tells me perf still feels slow:
- `mobile/sovern-ops-app/app/(tabs)/inquiries.tsx`
- `mobile/sovern-ops-app/app/(tabs)/shipments.tsx`
- `mobile/sovern-ops-app/app/(tabs)/expenses.tsx`
- `mobile/sovern-ops-app/app/(tabs)/chat.tsx` (messages list)
- `mobile/sovern-ops-app/app/(tabs)/research.tsx`

Other Phase 5 perf items:
- onEndReached pagination on long lists (current screens fetch page=1 only).
- Image compression on factory / product image-bearing detail screens.
- Bundle-size audit + code splitting if cold start grows.

---

---

## Phase 4.5 — SHIPPED

Six items shipped over seven commits (including one hotfix). All sentinels confirmed on live DB; real customer + lead data untouched.

### C23 — spellcheck + autocorrect on prose inputs (commit `95ec627`, deploy green)
- FormFields.jsx primitives carry explicit spellCheck defaults: TextInput + TextArea → true, EmailInput + PasswordInput + NumberInput + CurrencyInput → false. EmailInput also drops autoCapitalize + autoCorrect.
- AI assistant chat textarea + dev-run answer textarea: spellCheck=true.
- ClientContacts.jsx email composer body + template body: spellCheck=true.
- Mobile assistant + chat composer: explicit autoCorrect + spellCheck + autoCapitalize="sentences".
- Code-like fields (search, SKU, forgot-password email) intentionally keep autoCorrect={false}.

### C21 — flooring-only catalog + super-admin toggle (commit `a9a6aac`, deploy green)
- Shared util `productCategoryFilter.js` (desktop) + `.ts` (mobile) with FLOORING_PRODUCT_TYPES = [lvt, spc, wpc, hardwood, laminate, ceramic, tile, vinyl], filterByFlooring(), useShowAllCategories() hook (localStorage / AsyncStorage).
- Settings/ProductCatalog.jsx: super-admin Show all categories checkbox + empty-state copy.
- Quotations/QuotationForm.jsx: line-item product picker uses visibleProducts. Toggle shared via storage. Fixed pre-existing em dash in label.
- Mobile app/(tabs)/products.tsx: Switch toggle (super-admin only) + composite filter via useMemo.

### C24 — refreshed FW brand signature (commit `41c2a60`, deploy green, live-verified)
- New migrateBrandSignaturesC24.js, idempotent via AuditLog sentinel `phase4_5_fw_signature_updated`. Updates Brand WHERE code='FW' signatureHtml + signatureText to Country Manager design surfacing both FlorWay (Malaysia) and Anhui HanHua (China). Calibri/Arial inline-style table.
- seedBrands.js FW row updated to match so fresh installs are coherent.
- server.js wires migration after migrateSanctionsC18.
- SH brand intentionally untouched.
- **Live verified:** FW.signatureHtml = 966 chars; AuditLog sentinel recorded at 2026-05-15 01:28:39 UTC.

### C19 v1 — AI Drive retrieval + external search docs (commit `a0cbc9a`, deploy green)
- erpToolServer.js TOOL_DEFS: rewritten search_drive_files + read_drive_file descriptions to cover brand decks, presentations, contracts, slide decks, references, drafts. Calls out name= vs query= trade-off and the requirement to surface webViewLink.
- aiContextService.js: new C19 paragraph instructing the assistant to call search_drive_files on any named-document request BEFORE saying "I can't share that".
- helpContent.js: /ai/assistant section gets "Finding documents in Drive" and "External research" subsections with trigger phrasing. Removes stale "does NOT have access to documents" line.

### C19 v2 — AI assistant WRITE + ACTION capabilities (commits `a6fc36f` + hotfix `c71eb25`, deploy green)
- 7 new MCP tools added to erpToolServer.js:
  - WRITE: update_brand, update_email_template, update_user_profile_self, update_dashboard_layout.
  - ACTION: create_scheduled_task, mark_item_complete, archive_item.
- Permission helpers: getCurrentUserOrThrow + requireSuperAdmin.
- Audit wrapper auditAiWrite writes rows with action prefix `ai_assistant_<tool_name>`, entity = affected model, entityId = row UUID, changes = before/after diff.
- Field whitelists: BRAND_WRITABLE_FIELDS, EMAIL_TEMPLATE_WRITABLE_FIELDS, USER_SELF_WRITABLE_FIELDS, ARCHIVABLE_ENTITIES. Anything outside is silently dropped.
- aiContextService.js system prompt: mandatory pre-write protocol (read current, show diff, wait for confirm, apply, report) + hard-refusal list (deletes, payment/billing edits, sanctions screening status, AuditLog mods, user roles/permissions).
- helpContent.js: Configuration changes via chat + Hard refusals subsections.
- **Hotfix `c71eb25`:** the v2 commit used literal backticks inside the system-prompt template literal, breaking parsing and failing 148 tests. Hotfix escaped them per the existing convention (\`\\\`tool\\\`\`). Backend tests now 219/219 pass.

### C20 — archive seed data + lock catalog re-seeding (commit `b6a8d82`, deploy green, live-verified)
- New migrateSeedDataC20.js. For each target (Product, ProductPrice, ProductSpecification, then 6 empty tables: Quotation/SO/PI/Invoice/PO/CommissionTracking): DROP IF EXISTS ArchivedSeed_<X>, CREATE TABLE ArchivedSeed_<X> AS SELECT *, datetime('now') AS archived_at_utc FROM <X>, then DELETE FROM <X> in FK-safe order.
- Sentinel-guarded via AuditLog action `phase4_5_seed_data_archived`. Re-run is no-op.
- seedProducts.js: short-circuits when the C20 sentinel exists, so the empty Product table never gets re-seeded with the 5 Phase 4 placeholder SKUs.
- **Live verified:** Product=0, ArchivedSeed_Product=31 rows, ArchivedSeed_ProductPrice=31 rows. Customer=5, Leads=112 (real data preserved). Sentinel at 2026-05-15 01:45:09 UTC.
- **Recovery path:** INSERT INTO Product SELECT (all columns except archived_at_utc) FROM ArchivedSeed_Product. Same shape for the other tables.

### C22 — mobile perf pass (commit `1d0b290`, CI queued at session close)
- customers.tsx + leads.tsx: row component wrapped in React.memo, search filter migrated from useEffect/setFiltered to useMemo (one render per keystroke instead of two), renderItem + keyExtractor extracted to useCallback for stable references, FlatList virtualization tuned (removeClippedSubviews on Android, initialNumToRender=12, maxToRenderPerBatch=10, windowSize=10).
- No on-device TTI numbers per the agreed "code-level fixes with reasoned narrative" scope.
- Dashboard widget memoization deferred to a follow-up commit (more widgets, deserves its own survey).

---

## What Alex still owes manually

1. **Verify on phone after Expo OTA refresh** — pull the latest update on Expo Go, walk the customer + lead lists, and confirm scrolling feels smoother. C22 changes are JS-only so no native rebuild needed.

2. **Walk the AI assistant verification checklist (Phase 4.5, C19):**
   - "Show me the IronLite Branding deck" — should call search_drive_files name=, return a clickable webViewLink.
   - "Update the FW signature to put HanHua first" — should show before/after, wait for "yes", call update_brand, write `ai_assistant_update_brand` to AuditLog.
   - "Flights TPE to LAX next Friday morning" — WebSearch result.
   - "Send Mr. Lee an email asking for the updated FOB list" — preview-confirm before send_email.
   - "Remind me to follow up with Acme next Tuesday 10am" — echo Taipei time, wait for confirm, call create_scheduled_task, write `ai_assistant_create_scheduled_task`.

3. **Empty product catalog is expected** — the 31 demo Products were archived in C20. Add real flooring products via /settings/products. The flooring-only filter from C21 is on by default; flip "Show all categories" to surface non-flooring schema fields.

4. **AuditLog audit query** — to see every AI-initiated change, run:
   ```sql
   SELECT action, entity, entity_id, datetime(created_at) FROM AuditLog WHERE action LIKE 'ai_assistant_%' ORDER BY created_at DESC;
   ```

5. **Mobile app mobile follow-up** (deferred): dashboard widget memoization is the next Phase 4.6 perf pass. Long-list pagination (onEndReached) is a Phase 5 conversation since current screens fetch page=1 only.

---

## Phase 4.5 commit log

| Hash | Scope |
|---|---|
| `95ec627` | C23 — spellcheck + autocorrect on prose inputs |
| `a9a6aac` | C21 — flooring-only catalog + super-admin toggle |
| `41c2a60` | C24 — refreshed FW brand signature |
| `a0cbc9a` | C19 v1 — AI Drive retrieval + external search docs |
| `a6fc36f` | C19 v2 — AI WRITE + ACTION tools (failed CI, see hotfix) |
| `b6a8d82` | C20 — archive seed data + lock catalog re-seeding |
| `c71eb25` | hotfix — escape backticks inside C19 v2 system prompt template literal |
| `1d0b290` | C22 — memoize list rows + virtualize customer/lead screens |

---

## CI Status (legacy Phase 4)
- **Latest Phase 4 commit:** `4744e8d` (fix(phase-4): sanctions migration uses model.getTableName() (C18 hotfix))
- **CI/CD Pipeline (4744e8d):** green
- **Deploy (4744e8d):** green
- **C18 hotfix:** Customer.getTableName() returns 'Customer' (singular); migration UPDATE now uses model.getTableName() so the bug can't recur on a cold install.

---

## Phase 4 — In progress

Plan file: `C:\Users\Alex\.claude\plans\mutable-stargazing-bubble.md`

### C18 — Sanctions screening (SHIPPED, commit `9f33db7` + hotfix `4744e8d`, live)

**Schema:**
- `Customer` — added `screeningStatus` (enum), `lastScreenedAt`, `sanctionsScreenDetails` (JSON), `sanctionBlockReason`, `sanctionOverrideReason / At / By`, `registeredBuyerSince`, `registeredBuyer`. Indexes on `screening_status`, `last_screened_at`.
- `Lead` — added `screeningStatus`, `sanctionsScreenDetails`, `lastScreenedAt`. Legacy `sanctionsScreened` boolean kept for read compat.

**Migration `migrateSanctionsC18.js`:**
- Idempotent backfill setting `screening_status='pending'` on every NULL row. Sentinel: `phase4_sanctions_backfilled`. Wired into server.js after migrateConnectedAccounts.

**`backend/services/sanctionsService.js` (new):**
- `refreshSanctionsData()` — downloads OFAC SDN, OFAC Consolidated, EU Consolidated, UN SC Consolidated to `backend/data/sanctions/`. Atomic .tmp + rename writes. Manifest in `last_refresh.json`.
- `screenName(name, country)` — name normalization (strips Ltd/LLC/Inc/GmbH/Sdn/Bhd etc.), exact match + country-overlap gating, fuzzy via inline Levenshtein (ratio >= 0.85). Five statuses: pending / cleared / flagged / requires_review / override.
- mtime-cached in-memory parse so screen calls are sync after first load.
- Zero new package dependencies.

**Cron jobs (`schedulerService.js`):**
- `30 3 * * *` refreshSanctionsLists — toggle `SCHEDULER_SANCTIONS_REFRESH=false`.
- `0 4 * * *` rescreenCustomers90d — toggle `SCHEDULER_SANCTIONS_RESCREEN=false`.
- Both audit (`sanctions_refresh`, `sanctions_rescreen_batch`).

**API (`backend/modules/compliance/complianceRoutes.js`):**
- POST `/screen` — stateless screen of `{name, country}`.
- POST `/screen/:customerId` — re-screen + persist + audit `sanctions_screen`.
- POST `/customers/:id/override` — super-admin only, reason ≥ 10 chars, audits `sanctions_override`, sets `isActive=true`.
- GET `/sanctions/status` — last refresh manifest + file sizes + cron toggles.
- POST `/sanctions/refresh` — super-admin manual trigger.

**Four hard-block entry points:**
- `leadController.createLead` — synchronous screen; flagged → 403, NOT created, audit.
- `customerController.create` — synchronous screen; flagged → row created with `isActive=false`, 403 returned.
- `quotationController.create` — rejects on `customer.screeningStatus === 'flagged'`. override bypasses.
- `outreachController` per-lead + campaign — stale (>7d) re-screen on the fly; flagged blocks.
- All write `sanctions_block` with `context` field.

**Desktop:**
- New `SanctionsBadge.jsx` (5 variants).
- `CustomerDetail.jsx` — badge + red Override button (super-admin) + override modal (reason ≥ 10 chars, posts to `/compliance/customers/:id/override`).
- Block reason / override reason previewed under the customer title.

**Mobile:**
- `app/(tabs)/customers.tsx` — SANCTIONS / OVERRIDE / REVIEW inline chip on each customer row when status warrants.
- Customer interface in `src/services/api.ts` extended with sanctions fields.

**Three-surface docs:**
- tooltipContent — new keys: `sanctionsScreening`, `sanctionsCleared`, `sanctionsFlagged`, `sanctionsReview`, `sanctionsOverride`, `screeningSources`.
- helpContent — new `/compliance/sanctions` section.
- DEVELOPER_GUIDE — new "Sanctions screening (Phase 4, C18)" section.
- USER_GUIDE — new "Sanctions screening (Phase 4, C18)" section.

**`.gitignore`:**
- `backend/data/sanctions/*.csv` + `*.xml` + `last_refresh.json` (runtime caches; don't commit).

**AuditLog actions added:**
- `sanctions_screen`, `sanctions_block`, `sanctions_override`, `sanctions_refresh`, `sanctions_rescreen_batch`, `phase4_sanctions_backfilled`.

### C17 — Inbox / email UX brand awareness (SHIPPED, commit `ac4ff75`, live)

**Schema:**
- `ConnectedGoogleAccount.brandCode` STRING(8) NULL — FK Brand.code (constraints:false). Auto-added by autoMigrateSchema at boot.

**Migration `migrateConnectedAccounts.js` (idempotent, sentinel-guarded):**
- Backfills brandCode by matching account.email to Brand.senderEmail (LOWER comparison).
- Orphans (no matching brand) left NULL + logged.
- Sentinel: AuditLog action `phase4_connected_accounts_brand_backfilled`.
- Wired into server.js boot after backfillBrandsIfNeeded.

**OAuth enforcement (`googleAccountController.js`):**
- Callback now looks up Brand by senderEmail. New connects without a matching brand redirect to `?google=no_brand_match`.
- listAccounts + listAvailableAccounts include brandCode in returned attributes.

**Gmail sync (`gmailSyncService.js`):**
- processMessage accepts accountBrandCode. New TriageItem rows get brandCode = account.brandCode (fallback 'SH' for orphans).
- rawEmailData.fromAccount stores the polling email for forensics.

**Reply send (`triageController.js`):**
- Accepts triageItemId + fromAccountId in body.
- Resolves brand from triageItem.brandCode → req.brandScope.defaultBrand → 'SH'.
- Enforces fromAccount.brandCode === resolvedBrandCode: 400 + audit `brand_account_mismatch_block`.
- fromAddress = fromAccount.email || Brand.senderEmail || SMTP_FROM.
- Egypt BCC via `applyEgyptBccIfNeeded` (new helper in emailService.js).
- Audits every send as `reply_sent` with brand/from/to/subject/bccCount/country.

**Egypt BCC single source of truth (`emailService.js`):**
- New `applyEgyptBccIfNeeded(brandCode, country, bccList)` helper.
- outreachController.js outreach send + campaign send + triageController.js reply all call it. Three near-duplicate inline checks collapsed into one helper.

**Desktop (`frontend/admin-portal/src/pages/CRM/TriageInbox.jsx`):**
- BrandBadge on every triage card.
- ComposeModal: header brand chip; sender-account picker `/api/google/accounts` filtered by thread brand (mismatched accounts visible but disabled).
- Cross-brand banner for super-admin in `brandScope.isCrossBrand` mode (list endpoint already merges via `brandScope.where = {}`).
- Reply state passes triageItemId + threadBrandCode through to send-email.

**Mobile (`mobile/sovern-ops-app/app/(tabs)/triage.tsx`):**
- BrandBadge on every card (size sm, no label).
- New Reply button + modal with brand-locked sender picker (touchable list).
- `listConnectedGoogleAccounts` + `sendTriageReply` added to src/services/api.ts.
- TriageItem + ConnectedGoogleAccount types extended with brandCode.

**Three-surface docs:**
- tooltipContent — new keys: `inboxBrandBadge`, `replySenderPicker`, `crossBrandTriage`, `egyptBccRule`.
- helpContent — new `/crm/inbox` section: brand-aware threading, replying, Egypt BCC rule.
- DEVELOPER_GUIDE — new "Inbox / email UX brand awareness (Phase 4, C17)" section: schema, migration, OAuth enforcement, gmail sync propagation, reply enforcement, Egypt BCC helper, desktop, mobile, audit actions, risks.
- USER_GUIDE — new "Replying to inbox emails (Phase 4, C17)" section.

**AuditLog actions added:**
- `reply_sent`, `brand_account_mismatch_block`, `phase4_connected_accounts_brand_backfilled`.

### C16 — Quote-to-SalesOrder + brand-aware SO/PI/Invoice (SHIPPED, commit `1e9f417`, live)

**Backend:**
- `backend/utils/statusMachine.js` — SO transitions reconciled with SalesOrder model enum: draft → confirmed → in_production → ready → shipped → in_transit → delivered → completed; cancellable from any non-terminal state. `processing` removed (pre-flight verified zero rows on live DB).
- `backend/routes/salesOrderRoutes.js` — `POST /create-from-quotation` adds brand-access gate (403 if `req.brandScope.accessibleBrands` doesn't include the quotation's brand and not in cross-brand mode). `PATCH /:id/status` specialized audit `sales_order_status_change`.
- `backend/routes/proformaInvoiceRoutes.js` — `POST /:id/send` hard-blocks when `pi.brandCode === 'FW'` with 400 and audit `fw_send_blocked`. Defense-in-depth alongside the UI disable.
- `backend/routes/invoiceRoutes.js` — same FW send-block on `PATCH /:id/send`.

**PDF templates:**
- New `addFwInternalRecordBanner(doc, entity)` helper in `backend/services/pdf/pdfHelpers.js`. 28px iron-deep bar with cream "FACTORY WILL SEND TO BUYER — INTERNAL RECORD" text. No-op for non-FW.
- Wired into `generateSalesOrderPDF` (`orderDocumentsPDF.js`), `generateProformaInvoicePDF` (`salesDocumentsPDF.js`), `generateInvoicePDF` (`financeDocumentsPDF.js`) — banner injected after `doc.pipe(stream)`, before `getCompanyHeader`.

**Desktop:**
- `QuotationDetail.jsx` — fixed pre-existing `'approved'` bug (the Quotation enum is draft|sent|revised|accepted|rejected|expired). Added Convert-to-SO button visible when status='accepted' and brand-accessible. Modal with factory picker (defaults to quotation factory), estimatedDelivery, shippingMethod, notes. Routes to new SO on success. Modal includes FW internal-record note when brand='FW'.
- `ordersAPI.createFromQuotation()` added to `services/api.js`.
- `ProformaDetail.jsx` — `isFwInternalRecord` flag disables Send button (+ tooltip) and renders an iron-deep banner below the action bar.
- `OrderDetail.jsx` + `InvoiceDetail.jsx` — render the same iron-deep FW internal-record banner below the workflow status bar.

**Mobile:**
- `mobile/sovern-ops-app/src/services/api.ts` — new `createSalesOrderFromQuotation` exported.
- `mobile/sovern-ops-app/app/quotation/[id].tsx` — FW iron-deep banner above PDF buttons. New Convert-to-Sales-Order button visible when status='accepted' and brand-accessible. Alert-driven confirm flow; uses quotation.factoryId (errors if missing). For FW, the confirm prompt repeats the internal-record framing.

**Three-surface docs:**
- tooltipContent — new keys: `convertToSO`, `fwInternalRecord`, `salesOrderStatuses`.
- helpContent `/quotations` — new "Quotation lifecycle (Phase 4, C16)" section.
- DEVELOPER_GUIDE — new "Quote-to-SalesOrder + brand-aware SO/PI/Invoice (Phase 4, C16)" section: status machine reconciliation, convert flow, FW send-block defense in depth, PDF banner wiring, mobile parity, audit actions, pre-existing bug fixed.
- USER_GUIDE — new "Converting a Quotation to a Sales Order" + "FlorWay internal documents" sections under Common Workflows.

**AuditLog actions added:**
- `sales_order_status_change`, `fw_send_blocked`.

### C15 — FW commission ledger + dashboard + accrual rewrite (SHIPPED, commit `908d21d`, live)

**Schema:**
- `CommissionTracking` — added `customerId`, `brandCode` (default 'FW'), `accrualDate`, `registeredBuyerSince`. Status enum widened to add `accrued`, `invoiced_to_factory`, `clawed_back`. Default for new rows: `'accrued'`. Indexes on customer_id, brand_code, brand_code+status, accrual_date.
- `Brand` — added `commissionRate DECIMAL(5,4) DEFAULT 0.0500`. seedBrands: SH = 0.0000, FW = 0.0500.
- `Quotation` — added `commissionRateOverride DECIMAL(5,4) NULL` + index `(status, brand_code)` for forecast scan.

**Migration `migrateCommissionsC15.js` (idempotent, sentinel-guarded):**
- Status enum remap: `approved → accrued`, `cancelled → clawed_back`.
- Field backfill: customerId / brandCode / accrualDate via joined SO; orphans default brandCode='FW'.
- Brand.commissionRate backfill: SH=0.0000, FW=0.0500.
- Wired into server.js after seedProductsIfEmpty.

**Accrual rewrite `commissionAccrual.js`:**
- New `accrueIfConfirmed(db, so, userId)` — no-op unless SO is at 'confirmed'.
- Rate resolution: quotation.commissionRateOverride → brand.commissionRate → legacy CommissionRule fallback.
- Sets customerId, brandCode, accrualDate, registeredBuyerSince. Status 'accrued' for new rows.
- Backwards-compat alias `accrueCommissionForOrder` preserved.
- `updateCommissionPercentage` now enforces 5% floor (cannot override).
- Exports `COMMISSION_FLOOR_DECIMAL = 0.05`, `COMMISSION_FLOOR_PERCENT = 5.0`.

**salesOrderRoutes.js:**
- `PATCH /:id/status` now hooks accrueCommissionForOrder when status transitions from non-confirmed to 'confirmed'.

**quotationController.js:**
- create + update validate `commissionRateOverride >= 0.05` (decimal). Update path audits `commission_rate_override` when the field changes.

**New endpoints (`backend/routes/personalization/commissionRoutes.js`):**
- `GET /api/personalization/commissions/dashboard?brand=FW` — KPIs (MTD/QTD/YTD/PendingPayment) + pipeline forecast + deals + outstanding. Gated by inline `requireFwAccess` (super_admin OR accessibleBrands.includes('FW')).
- `POST /commissions/:id/mark-paid` — super_admin only, status=paid + paidDate. Audit `commission_paid`.
- `POST /commissions/:id/claw-back` — super_admin + reason (≥ 5 chars). Audit `commission_clawed_back`.

**Backend brandScope hook:** `personalizationRoutes.js` now applies `requireAuth + brandScope` at the router so commission endpoints can read `accessibleBrands`.

**Desktop:**
- New `frontend/admin-portal/src/pages/Analytics/CommissionDashboard.jsx` — KPI strip, pipeline forecast card, outstanding > 30d section (super-admin Mark-paid actions), full deals table with inline percentage editor (super-admin only on accrued/pending rows). Status pills color-coded.
- App.jsx: new lazy route `/commissions`.
- Layout.jsx: user-menu entry "FlorWay commission" visible only for super_admin OR `accessibleBrands.includes('FW')`.

**Mobile:**
- `mobile/sovern-ops-app/src/components/CommissionWidget.tsx` rewired to use new `/dashboard` endpoint. Now tappable → navigates to `/commission` detail. Tiles show MTD Accrued + Pending payment.
- New `mobile/sovern-ops-app/app/commission.tsx` — read-only deals list with KPIs, outstanding section, status pills. Mobile-friendly card layout.

**Three-surface docs:**
- tooltipContent — new keys: `commissionRateOverride`, `commissionFloor`, `commissionStatuses`, `markPaid`, `clawBack`, `pipelineForecast`, `outstandingTracker`.
- helpContent — new "FlorWay commission tracking (Phase 4)" section under `/`.
- DEVELOPER_GUIDE — new "FlorWay commission tracking (Phase 4, C15)" section: schema deltas, migration, rate resolution, accrual trigger points, floor enforcement, API endpoints, percentage-vs-decimal note, UI, AuditLog actions, pipeline forecast notes.
- USER_GUIDE — new "Tracking FlorWay Commission (Phase 4)" walkthrough.

**AuditLog actions added:**
- `commission_rate_override`, `commission_paid`, `commission_clawed_back`, `phase4_commission_status_migrated`, `phase4_commission_fields_backfilled`, `phase4_brand_commission_rate_backfilled`.

### C14 — Brand-aware product catalog (SHIPPED, commit `8fb9a6a`, live)

**Backend:**
- `backend/models/Product.js` — added 8 fields: brandCode (default 'SH'), productType (enum), baseFobPrice (decimal FLOOR), currency, moqUnit, leadTimeDays, certifications (JSON), originCountry. Compound + brand_code indexes added; SKU stays globally unique (column-level UNIQUE can't ALTER on SQLite; deviation documented).
- `backend/models/index.js` + `backend/services/migrateBrands.js` — 'Product' added to BRAND_TX_MODELS + TX_MODELS so existing 31 rows backfill to brandCode='SH'.
- `backend/routes/productRoutes.js` — router-level `requireAuth + brandScope`. Every product request is brand-scoped.
- `backend/controllers/productController.js` — create accepts new fields, defaults brandCode from req.brandScope.defaultBrand, calls assertBrandWritable. getAll applies brandWhere(req) + productType filter. getById + update both 404 on wrong brand (no existence leak).
- `backend/controllers/quotationController.js` line 36-54 — line-item loop now enforces (a) brand match between product and quotation, (b) floor check (unitPrice >= product.baseFobPrice); below-floor requires super-admin role + belowFloorReason (>= 5 chars) per item, audited as `product_floor_override`. Defaults unitPrice from baseFobPrice when absent. Explicit no-markup invariant comment.
- New `backend/services/seedProducts.js` — idempotent on (brandCode, sku). 3 FW placeholders (FW-SPC-65 IronLite 6.5mm $5.80, FW-SPC-85 IronLite 8.5mm $7.20, FW-WPC-65 Generic WPC 6.5mm $6.40), 2 SH placeholders (SH-HW-14 Engineered Oak 14mm $24.00, SH-LAM-8 Laminate 8mm AC4 $6.80). PLACEHOLDER prices commented for replacement. Wired into server.js boot after seedCommissionRulesIfEmpty.

**Desktop:**
- New `frontend/admin-portal/src/pages/Settings/ProductCatalog.jsx` — admin page at /settings/products. Brand filter (BrandFilterPicker), DataTable with SKU/Name/Brand/Type/floor price/MOQ/Lead/Active columns, New/Edit modal with BrandPicker (locked on edit), deactivate toggle. Floor price column reads baseFobPrice.
- `App.jsx` lazy route + `Layout.jsx` user-menu link "Product catalog".
- `QuotationForm.jsx` — line-item Product dropdown is brand-filtered via re-fetch on brandCode change. Picking a product autofills unitPrice from baseFobPrice and unit from moqUnit. Below-floor reveals an amber warning + reason input; reason submitted as `belowFloorReason` per item.

**Mobile:**
- `mobile/sovern-ops-app/app/(tabs)/products.tsx` — BrandFilterPicker at top, BrandBadge on each row. baseFobPrice preferred over legacy ProductPrice.sellingPrice on display.
- `mobile/sovern-ops-app/src/services/api.ts` — Product type extended with new fields. getProducts accepts brandCode + status params.

**Three-surface docs:**
- `tooltipContent.js` PRODUCT — new entries: brandCode, productType, baseFobPrice, moqUnit, leadTimeDays, certifications, originCountry, floorOverride.
- `helpContent.js` `/products` — new "Brand-aware catalog (Phase 4)" section.
- `DEVELOPER_GUIDE.md` — new "Product catalog (Phase 4, C14)" section: schema delta, quotation flow integration, frontend, mobile, seed, AuditLog actions, no-markup invariant + grep blocklist.
- `docs/USER_GUIDE.md` — new "Managing the Product Catalog (Phase 4)" walkthrough.

**AuditLog action:**
- `product_floor_override` — entity Product, changes {sku, floor, quotedPrice, reason}.

**Plan deviation: SKU globally unique (not per-brand).** SQLite ALTER limitations + 31 live rows + many FK relations make the table rebuild unsafe for this commit. Brand-prefixed seed SKUs (FW-*/SH-*) sidestep collisions. Phase 5 ticket: rationalize Product+ProductPrice and do the per-brand SKU rebuild.

**Pre-existing bug fixed in-flight:** productController.create didn't call assertBrandWritable. Now it does.

---

## Phase 3 — COMPLETE ✅

Plan file: `C:\Users\Alex\.claude\plans\mutable-stargazing-bubble.md` (kept for reference)

**Commits shipped this session, in order:**

| Hash | Scope |
|---|---|
| `cbb308a` | C9 — FW quotation document template (IronLite / Generic / Private Label) + mobile Preview/Download PDF |
| `7e8a8f5` | C10 — SH brand-styled quotation renderer (forest / cream / ink) |
| `72c7844` | C11 — Per-brand reporting + FW commission widget (5% default, adjustable per order) |
| `e9c0938` | C12 — productBrandingMode picker + lock-after-sent + super-admin override |
| `14cd45b` | C13 — Phase 1 polish bundle (BrandBadge expansion, BrandPicker on create forms, cross-brand auto-add, 404-on-wrong-brand) |
| `ddf80a1` | Polish 1 — 404 extension (Inquiry/Activity/TriageItem/Document) + analytics brand-scope (7 endpoints) + desktop L-042 formatters |
| `e65f664` | Polish 2 — mobile L-042 (timezone Asia/Taipei on 28 call sites across 14 files) |

7 commits, all CI green, all deployed live on `erp.sovernhouse.co`.

---

## What Alex still owes manually (next time he's at his Windows machine)

1. **Mobile npm install** — `cd "C:\Users\Alex\Desktop\International Trade Company\Trading ERP\mobile\sovern-ops-app"` then `npm install`. Picks up `expo-file-system` + `expo-sharing` added in C9 for the mobile Preview/Download PDF feature. Without this, the mobile PDF buttons throw on tap.

2. **Optional: typography upgrade for PDFs** — drop these into `backend/assets/fonts/` to swap Helvetica fallback for the FW brand-spec fonts:
   - `Anton-Regular.ttf` (display)
   - `Inter-Regular.ttf` + `Inter-Bold.ttf` (body)
   - All free from fonts.google.com (OFL). The PDF renderer's `registerBrandFonts` already conditionally registers them; no code change needed when they appear.

3. **Optional: flex the FW commission rate** — set `FW_COMMISSION_RATE=<n>` (e.g. `7`) in the GCP VM's env and restart pm2 to seed a different default. Existing CommissionTracking rows keep their per-order rates.

4. **Auto-update error on the Claude Code CLI** — separate from the ERP. Run `! claude doctor` from this prompt to diagnose, then `npm i -g @anthropic-ai/claude-code` in an elevated PowerShell if needed.

---

## Smoke-test checklist Alex hasn't run yet (Phase 3 verification)

When you next have a phone in hand + a test customer in the DB, walk through:

**FW PDF variants (after `npm install`):**
1. FW customer with `productBrandingMode='ironlite'` + WPC quotation → Download PDF → I-Beam wordmark, OEM badge, construction diagram on page 2.
2. Same customer with `productBrandingMode='generic'` → FlorWay Sdn Bhd wordmark, no IronLite imagery.
3. Same customer with `productBrandingMode='private_label'` + a brand name → placeholder page with TODO banner.
4. SH customer + quotation → new SH brand-styled layout (forest/cream/ink). This is a visual change from the old pdfkit-classic layout for SH; flag if it doesn't match your taste.
5. Send FW quotation by email → PDF attached, sender `alexflorway@gmail.com`, no Mohanad BCC.
6. Footer middot (U+00B7) renders, no em dashes anywhere.
7. Mobile: open quotation detail → tap Preview PDF (opens in viewer) → tap Download PDF (share sheet).

**Brand-scoped reporting:**
8. Dashboard top-right brand picker → toggle SH / FW → KPIs and charts update.
9. FW commission widget renders three tiles (Accrued / Paid / Pending) for the current Taipei month.
10. Click "Show orders" → expand the per-order list → change a pending row's percentage → confirm the amount recalculates and saves.
11. As super-admin in cross-brand view → see the BrandRevenueComparison side-by-side bar.

**productBrandingMode lock:**
12. Add FW to a customer's brand relationships → picker appears on customer detail.
13. Set mode to `ironlite`, send an FW quotation → reload customer detail → picker locked with Asia/Taipei lock timestamp.
14. As super-admin → click Override → enter reason (min 3 chars) → confirm. Audit log entry should appear.

**Phase 1 polish:**
15. Create an FW lead/quote/deal against an existing SH-only customer → toast appears, customer brand relationships now include FW.
16. As an SH-only user, hit `/api/quotations/<FW-id>` directly → 404 (not 403).
17. BrandBadge visible on Order, Invoice, ProformaInvoice detail headers.
18. BrandPicker visible on LeadForm, QuotationForm, DealForm.

**Timezone:**
19. Every date and time on every screen, every PDF footer, every audit log timestamp → Taipei time.

---

## Deferred (not in Phase 3 — pick up in a future phase)

- **SO / PO / Invoice / Packing List brand-aware document templates** — factory currently sends FW docs per your standing decision. Pick up when factory hands off.
- **Full Private Label quotation template** — placeholder ships now; full template lands when the first OEM private-label buyer signs.
- **Calendar / Docs MCP integration extensions** — not blocking.
- **Quotation approval workflow** — Mr. Lee / Alice confirmed no sign-off needed.

---

## Stale memory note

`project_expenses_per_brand` memory says Phase 1 didn't tag Expense/Office/Trip/Submission with brandCode and that we owe a sub-commit. The Phase 3 Explore agent confirmed they ARE tagged from Phase 1 Commit 3b-A. Memory should be updated/deleted when convenient.

---

## Next session pickup

If you come back to ERP work, start by:

1. `git log --oneline -8` to confirm we're at `e65f664` on `main` (or further if anyone pushed).
2. Re-read this file and `lessons.md` per the standing protocol.
3. Either:
   - Smoke-test the checklist above and report findings, OR
   - Pick up one of the deferred items above, OR
   - Hit a new feature ask.

---

### Mobile L-042 follow-up (SHIPPED, commit `e65f664`, live)

Every per-screen mobile date formatter now passes `timeZone: 'Asia/Taipei'`. 14 files touched, ~28 call sites updated.

**Files:**
- `app/quotation/[id].tsx` (4 sites)
- `app/lead/[id].tsx` (1)
- `src/components/ChatterSection.tsx` (1)
- `app/dev-runs.tsx` (2)
- `app/(tabs)/assistant.tsx` (1 date formatter; currency `toLocaleString` calls left alone)
- `app/(tabs)/approvals.tsx` (3)
- `app/(tabs)/activities.tsx` (1)
- `app/(tabs)/dashboard.tsx` (1)
- `app/(tabs)/chat.tsx` (3)
- `app/(tabs)/inquiries.tsx` (1 date; currency left alone)
- `app/(tabs)/invoices.tsx` (1 date)
- `app/(tabs)/purchase-orders.tsx` (4 incl. share-link expiry)
- `app/(tabs)/research.tsx` (1)
- `app/(tabs)/sales-orders.tsx` (4 incl. share-link expiry)
- `app/(tabs)/triage.tsx` (2)
- `app/(tabs)/shipments.tsx` (1)

Currency `Number.toLocaleString` calls intentionally left as-is — they're number formatting, not date formatting, and don't need a timezone.

L-042 desktop migration (in commit `ddf80a1`) plus this mobile migration close the timezone loop for every user-facing surface in the ERP.

### Phase 3 mechanical follow-ups (SHIPPED, commit `ddf80a1`, live)

**404-on-wrong-brand extended:**
- `inquiryController.getById` — `isAccessibleByBrandCode` check after the findByPk.
- `activityController.getActivityById` — same.
- `triageController.getTriageItem` — same.
- `documentRoutes` GET `/:id` — same.
- OutreachEmail has no standalone get-by-id endpoint (only nested under leads) — nothing to lock down.

**Analytics brand-scoped:**
- `analyticsRoutes` — `order-funnel`, `top-products`, `customer-segments`, `factory-performance`, `payment-aging`, `shipment-timeline`, `profit-margins`, `forecast` all now use `brandWhere(req)` or `brandWhereSql(req, alias)`. Per-route `requireAuth` removed (router-level applies it).
- `shipment-timeline` joins to SalesOrder for brand-scoping (Shipment carries no brandCode directly).
- `factory-performance` brand-scopes PurchaseOrder side; Factory itself is shared across brands.
- `customer-segments` brand-scopes the SalesOrder join; customers with zero matching orders still appear with revenue=0 (Customer's JSON `brandRelationships` requires app-layer filtering, separate concern).

**L-042 desktop formatters:**
- `frontend/admin-portal/src/utils/formatters.js` — `formatDate` and `formatDateTime` now use `Intl.DateTimeFormat` with `timeZone: 'Asia/Taipei'`. Every existing call site auto-upgrades.
- Mobile screens use per-screen inline `toLocaleDateString` without timeZone — out of scope here; mark as future cleanup.

**SH PDF path confirmation:**
- No code change. `renderSovernHouseClassic` writes to `uploads/quotations/SH/classic/` since C10 (verified at `brandedQuotationRenderer.js:91`). The follow-up note in C13 was stale.

---

### C13 — Phase 1 polish bundle (SHIPPED, commit `14cd45b`, live)

**BrandBadge expansion (desktop detail headers):**
- `OrderDetail.jsx`, `InvoiceDetail.jsx`, `ProformaDetail.jsx` — added `<BrandBadge code={record.brandCode || 'SH'} size="sm" />` next to the StatusBadge.
- Customer, Lead, Quotation already had it from earlier phases.
- PurchaseOrder and Inquiry detail pages are stubs without real headers — deferred.

**BrandPicker on create forms:**
- New `frontend/admin-portal/src/components/BrandPicker.jsx` (from Phase 1) wired into:
  - `LeadForm.jsx` — picker above company info, brandCode in form state, disabled in edit mode.
  - `QuotationForm.jsx` — picker above customer section, brandCode in submitData payload.
  - `DealForm.jsx` — picker above deal information, brandCode in spread submitData.

**Cross-brand auto-add:**
- New `backend/services/crossBrandAutoAdd.js` — `addBrandIfMissing(db, customerId, brandCode, triggeredBy)` extends `customer.brandRelationships` dedup-safe and writes `cross_brand_relationship_added` AuditLog row. Fire-and-forget at call sites.
- Wired into `leadController.createLead`, `quotationController.create`, `dealController.createDeal`. All three now return `autoAddedBrand` in the response.
- Frontend create forms (LeadForm, QuotationForm, DealForm) show a toast / success banner when `autoAddedBrand` is present.

**404-on-wrong-brand:**
- New `backend/utils/notFoundOnWrongBrand.js` — `isAccessibleByBrandCode(req, brandCode)` and `isAccessibleByBrandRelationships(req, rels)` helpers.
- Applied to getById on: Quotation, Customer (brandRelationships pattern), Deal, SalesOrder, Invoice, ProformaInvoice.
- Remaining (Activity, OutreachEmail, TriageItem, Document, Inquiry) follow the same pattern — mechanical follow-up. Writes stay 403 via `assertBrandWritable`.

**brandCode propagation on quotation create:**
- `quotationController.create` now reads `brandCode` from body, falls back to `req.brandScope.defaultBrand` then `'SH'`, and persists it on the new Quotation. (Phase 1 model had brandCode but the create route wasn't passing it.)

**Audit log action:**
- New action `cross_brand_relationship_added` — entity=Customer, changes={oldBrands, newBrands, addedBrand, triggeredByEntity, triggeredByEntityId}.

**Three-surface docs:**
- `tooltipContent.js` — `BRAND.crossBrandAutoAdd`, `BRAND.brandPickerOnCreate`.
- `helpContent.js` — new "Cross-brand auto-add (Phase 3, C13)" section under `/customers`.
- `DEVELOPER_GUIDE.md` — new "Cross-brand auto-add + 404-on-wrong-brand (Phase 3, C13)" section with helper docs, endpoint coverage table, BrandPicker wiring notes.
- `docs/USER_GUIDE.md` — new "Cross-Brand Auto-Add (Phase 3)" subsection under Managing Customers.

---

### C12 — productBrandingMode picker UI + lock + super-admin override (SHIPPED, commit `e9c0938`, live)

**Schema:**
- `backend/models/Customer.js` — adds `productBrandingModeLockedAt` (DATE, nullable, default null). Auto-migrates on boot via alter-sync.

**Backend:**
- `customerController.update()` accepts `productBrandingMode` and `privateLabelProductName`. Rejects non-super_admin edits when locked. Validates `private_label` requires non-empty `privateLabelProductName`.
- New `customerController.overrideProductBrandingModeLock` + route `POST /api/customers/:id/override-branding-mode-lock` (super_admin only via bare-string requireRole per L-031). Body `{ newMode, newPrivateLabelProductName?, reason }`. Reason min 3 chars. Clears lock, writes `product_branding_mode_override` AuditLog row.
- `quotationController.send` — after status flip to 'sent', if `brandCode==='FW'` and the customer has a mode set and isn't already locked, sets `productBrandingModeLockedAt = new Date()` and writes `product_branding_mode_locked` AuditLog row. Idempotent.

**Desktop:**
- New `frontend/admin-portal/src/components/ProductBrandingModePicker.jsx` — three radio cards (IronLite / Generic / Private Label), required private-label name input, lock badge with Asia/Taipei timestamp, super-admin "Override lock" dialog (mode + name + reason).
- `frontend/admin-portal/src/pages/Customers/CustomerDetail.jsx` — renders the picker only when `customer.brandRelationships.includes('FW')`. Uses `useAuth()` for super_admin gating.

**Mobile:**
- New `mobile/sovern-ops-app/src/components/ProductBrandingModePicker.tsx` — pill toggle, private-label inline input, lock badge. Override stays desktop-only.
- `app/(tabs)/customers.tsx` — renders the picker inside the customer detail modal when FW is in brand relationships.
- `src/services/api.ts` Customer type — adds `productBrandingModeLockedAt`.

**Audit log:**
- New action `product_branding_mode_locked` — entity=Customer, changes={mode, lockedAt, triggeredBy:{entity:'Quotation', id, quotationNumber}}.
- New action `product_branding_mode_override` — entity=Customer, changes={oldMode, newMode, oldPrivateLabelProductName, newPrivateLabelProductName, oldLockedAt, newLockedAt:null, reason}.

**Three-surface docs:**
- `tooltipContent.js` — extends `CUSTOMER.productBrandingMode` with lock note, new `CUSTOMER.productBrandingModeLocked`.
- `helpContent.js` — new "FlorWay product branding mode (Phase 3)" section under `/customers`.
- `DEVELOPER_GUIDE.md` — new "Customer.productBrandingMode lock semantics (Phase 3, C12)" section with schema, trigger, enforcement, override flow, audit actions.
- `docs/USER_GUIDE.md` — new "FlorWay Product Branding Mode" subsection under Managing Customers.

### C11 — Per-brand reporting + FW commission widget (SHIPPED, commit `72c7844`, live)

**Backend:**
- New `backend/services/seedCommissionRules.js` — idempotently inserts `FW Sales Commission` rule (ruleType=percentage, baseValue=5, applicableRoles=['sales','super_admin']). Wired into `server.js` after the brand seed. Reads `FW_COMMISSION_RATE` env if you want to flex the default without a code change.
- New `backend/services/commissionAccrual.js` — `accrueCommissionForOrder(db, so, userId)` fire-and-forget helper. Idempotent per (userId, salesOrderId). Looks up the rule by `${brand.displayName} Sales Commission`. Also exports `updateCommissionPercentage(row, newPct)` used by the PATCH endpoint.
- `backend/routes/salesOrderRoutes.js` — both SO create paths now (a) propagate `brandCode` (body wins, else user defaultBrand, else 'SH'; the create-from-quotation path inherits from the source quotation) and (b) call `accrueCommissionForOrder` post-creation.
- `backend/routes/personalization/commissionRoutes.js` — three new endpoints:
  - `GET /commissions/summary?brandCode=FW&period=mtd` — Accrued / Paid / Pending tiles + contributing rows. Used by CommissionWidget.
  - `PATCH /commissions/:id` — per-order percentage edit. Super_admin any; owner only on pending rows.
  - `GET /commissions/brand-comparison` — super_admin only; SH vs FW revenue + commission for MTD. Used by BrandRevenueComparison widget.
- New `backend/utils/brandFilterUtils.js` — `brandWhere(req)`, `brandWhereSql(req, alias)`, `filterCustomersByBrand(rows, req)`. Layered on top of `brandScope` middleware to give a clean `?brandCode=` override.
- `backend/routes/dashboardRoutes.js` — `router.use(requireAuth, brandScope)` + brand-scoped admin dashboard + mobile summary.
- `backend/routes/analyticsRoutes.js` — `router.use(requireAuth, brandScope)` + revenue-trend brand-scoped via raw-SQL helper.
- `backend/routes/reportRoutes.js` — `router.use(requireAuth, brandScope)` + sales report brand-scoped.

**Desktop:**
- New `frontend/admin-portal/src/components/BrandFilterPicker.jsx` — top-of-page pill; hidden for single-brand users; persists choice to localStorage; "All Brands" option for super_admin in cross-brand mode.
- New `frontend/admin-portal/src/components/DashboardWidgets/CommissionWidget.jsx` — FW MTD tiles + expandable per-order table with inline percentage edit.
- New `frontend/admin-portal/src/components/DashboardWidgets/BrandRevenueComparison.jsx` — super_admin cross-brand only; Recharts grouped bar.
- `Dashboard.jsx` — BrandFilterPicker in header + both widgets above KPI row; `brandFilter` state passed as `?brandCode=` to all dashboard API calls.
- `services/api.js` dashboardAPI — every endpoint now accepts `{ brandCode }` params.
- `utils/formatters.js` — new `formatDateTaipei` + `formatDateTimeTaipei` (L-042 compliance for Phase 3 strings; legacy formatters unchanged).

**Mobile:**
- New `mobile/sovern-ops-app/src/components/BrandFilterPicker.tsx` — pill toggle, mirrors desktop logic.
- New `mobile/sovern-ops-app/src/components/CommissionWidget.tsx` — read-only summary (per-order edit stays desktop-only).
- `app/(tabs)/dashboard.tsx` — wires both above the pipeline metrics; `brandFilter` state passed to `getDashboard({brandCode})`.
- `src/services/api.ts` `getDashboard` — now accepts optional `{brandCode}`.

**Three-surface docs:**
- `tooltipContent.js` — `DASHBOARD.brandFilter`, `allBrands`, `fwCommission`, `brandRevenueComparison`.
- `helpContent.js` — new "Brand-filtered reporting (Phase 3)" section under `/`.
- `DEVELOPER_GUIDE.md` — new "Brand-Scoped Dashboards + FW Commission (Phase 3, C11)" section with wiring pattern, files of interest, FW commission accrual flow, endpoints, L-042 note.
- `docs/USER_GUIDE.md` — new "Brand Filter on Dashboards" + "FlorWay Commission Widget" paragraphs.

**Scope notes:**
- Brand-scope helper applied to the most-visible queries (admin dashboard, mobile summary, revenue-trend, sales report). Remaining analytics endpoints (order-funnel, top-products, customer-segments, factory-performance, payment-aging, profit-margins, forecast) inherit `req.brandScope` from middleware but the where-clause weaving on each handler is a mechanical follow-up — not blocking C11.
- Customer queries (JSON `brandRelationships`) require application-layer filtering via `filterCustomersByBrand`; the admin dashboard accepts a small under-scope until that follow-up.

### C10 — SH brand-styled quotation renderer (SHIPPED, commit `7e8a8f5`, live)

**What ships:**
- Replaced the C9 SH classic delegate with a native `renderSovernHouseClassic()` in `backend/services/pdf/brandedQuotationRenderer.js`. Same shared draw helpers as FW (brand-agnostic — they take a tokens bag) so the SH document has the same structural rigor as FW but with the Sovern House palette: forest #1D5A32 primary, cream #F1EEE7 accent, ink body text, with a clay/bronze accent reserved.
- SH wordmark header reads the `sovern-house-logo-light.png` asset; falls back to text "SOVERN HOUSE / INTERNATIONAL TRADE" when the asset is missing.
- Footer middot legal "New Route International Exchange Co., Ltd. · Taiwan".
- Sender block "Alexander McConnell / FOUNDER / alex@sovernhouse.co".
- Trading-house intro paragraph ("verified factories across Asia, ships under your preferred Incoterm").
- Output path moved from `uploads/quotations/quotation-{number}.pdf` to `uploads/quotations/SH/classic/quotation-{number}-{timestamp}.pdf` for consistency with the FW brand+variant convention.
- 3 SH logo PNGs copied into `frontend/admin-portal/public/brand-assets/sovern-house/` for consistency with the florway/ folder layout. The originals at `/public/` root are untouched.
- `legacySales` import removed from `brandedQuotationRenderer.js` (no longer used). `salesDocumentsPDF.js` retained for `generateProformaInvoicePDF` + `generateSalesNotePDF` which other phases will replace.
- Doc wording generalized: tooltips + helpContent + DEVELOPER_GUIDE no longer say "SH falls through to legacy"; they now describe SH as brand-styled.

**Visual regression accepted:** every existing SH quotation now re-renders with the new layout when re-downloaded. No data change.

### C9 — FW quotation document template (SHIPPED, commit `cbb308a`, live)

**What ships:**
- New `backend/services/pdf/brandedQuotationRenderer.js` — dispatch + 3 FW variants + SH classic delegate. Selects variant from `Customer.productBrandingMode` automatically.
- New `backend/services/pdf/brandStyleTokens.js` — FW iron-deep/cream palette, footer middot legal line, sender block, asset paths, conditional Anton/Inter font registration with Helvetica fallback.
- `backend/services/documentGenerator.js` — barrel override so `generateQuotationPDF` routes through dispatch.
- `backend/controllers/quotationController.js` — `send()` passes brand into PDF; `generatePDF()` fetches brand and now **streams binary** as `Content-Type: application/pdf` (fixes pre-existing bug where the frontend expected blob but backend returned JSON, producing corrupted downloads).
- `frontend/admin-portal/src/pages/Quotations/QuotationDetail.jsx` — variant hint banner for FW (IronLite / Generic / Private Label) and private-label "in development" notice.
- `mobile/sovern-ops-app/app/quotation/[id].tsx` — Preview PDF + Download PDF buttons, variant banner. Send via ERP button preserved.
- `mobile/sovern-ops-app/src/services/api.ts` — new `downloadQuotationPDF(id, {inline})` helper using lazy-loaded `expo-file-system`.
- `mobile/sovern-ops-app/package.json` — added `expo-file-system ~19.0.16` and `expo-sharing ~14.0.7`.
- 6 IronLite PNGs copied into `frontend/admin-portal/public/brand-assets/florway/` (versioned, deployable).
- `tooltipContent.js` — new `QUOTATION.documentPreview` + `QUOTATION.florWayVariants`.
- `helpContent.js` — new "Brand-aware quotation document" section under `/quotations`.
- `DEVELOPER_GUIDE.md` — new "Brand-Aware Quotation Documents (Phase 3, C9 / C10)" section with pipeline diagram, file index, variant selector code, asset path resolution, font registration, "Adding a new brand" recipe.
- `docs/USER_GUIDE.md` — new "Brand-Aware Quotation Documents" + "Downloading and Previewing the PDF" subsections under Managing Quotations.

**Manual steps before testing:**
1. `cd mobile/sovern-ops-app && npm install` (picks up expo-file-system + expo-sharing). Alex runs this on Windows.
2. (Optional) Drop `Anton-Regular.ttf` + `Inter-Regular.ttf` + `Inter-Bold.ttf` from fonts.google.com into `backend/assets/fonts/`. PDFs render fine without them (Helvetica fallback) — typography auto-upgrades when present.
3. Restart backend on GCP VM after deploy so the new renderer is loaded.

**Verification checklist (after commit + deploy):**
1. FW customer with `productBrandingMode='ironlite'` + WPC quotation → Download PDF → I-Beam wordmark header, OEM badge, construction diagram on page 2.
2. Same customer with mode `generic` → FlorWay Sdn Bhd wordmark, no IronLite imagery.
3. Same customer with mode `private_label` + `privateLabelProductName='OakCove Flooring'` → placeholder page with TODO banner.
4. SH quotation → existing pdfkit-classic layout (regression check; C10 replaces).
5. FW quotation `send` → email with PDF preview; sender `alexflorway@gmail.com`; no Mohanad BCC.
6. Footer middot (U+00B7) renders.
7. No em dashes anywhere.
8. Mobile Preview PDF + Download PDF buttons work after `npm install`.

### Remaining Phase 3 work (post-C9 commit)
- C10 — SH quotation template (replaces legacy SH pdfkit-classic with brand-styled SH layout).
- C11 — Per-brand reporting dashboards + FW commission widget.
- C12 — `productBrandingMode` picker UI on Customer detail + lock-after-sent + super-admin override.
- C13 — Phase 1 polish bundle (BrandBadge expansion, BrandPicker on create forms, cross-brand auto-add, 404-on-wrong-brand getById extension).

---

## Where We Are

### Phase 2 — Multi-Brand (SH + FlorWay) — COMPLETE ✅

All Phase 2 work is shipped. The ERP is now fully brand-aware for the SH and FW brands across every key surface.

#### What Phase 2 delivered (this session + the session that led into this one)

**C5 — Brand-aware email composer (carried from prior session, commit `e53e4c2`):**
- Outreach emails auto-select `fromAddress` and signature from `lead.brandCode → Brand.senderEmail`
- `From` header uses `brand.displayName | Alex` (e.g. "FlorWay | Alex" not hardcoded SH)
- Campaign send validation checks against live `Brand.senderEmail` values (enables `alexflorway@gmail.com`)
- Egypt BCC rule (`mohanadfanzey@gmail.com`) gated to `brandCode === 'SH'` only, never FW
- FW brand has its own `signatureHtml` and `signatureText` (iron-deep divider, generic FlorWay copy, FLORWAY SDN. BHD. footer)
- `Brand.signatureText` column added to model + auto-migrated on boot

**C6 — Brand-aware quotation email sender (commit `caca318`):**
- `emailService.js`: new `sendTransactionalEmail` (Gmail API, pre-built HTML/text) + `sendTransactionalEmailWithFallback` (SMTP fallback). Same connected-account lookup as outreach.
- `quotationController.js`: `send()` now looks up `quotation.brandCode → Brand`, builds brand-colored HTML email with line items table + totals + signature, routes via `sendTransactionalEmailWithFallback`. Replaces generic SMTP `sendQuotationEmail`.
- `QuotationDetail.jsx`: `BrandBadge` in header, Send dialog shows brand sender email.
- `api.ts` (mobile): `brandCode` on `Quotation` interface, `sendQuotation(id)` function.
- `quotation/[id].tsx` (mobile): `BrandBadge` in header, "Send via ERP" button (draft-only) with brand-aware confirmation prompt.

**C7 — Brand admin UI (commit `319189a`):**
- `GET /api/brands/:code` + `PUT /api/brands/:code` (super_admin only) — update displayName, senderEmail, primaryColor, accentColor, logoUrl, signatureHtml, signatureText, footerLegalText
- `Settings/BrandAdmin.jsx` (new): accordion card per brand, color pickers with hex inputs, textareas for HTML/plain-text signatures and footer legal, dirty-state guard, discard button
- Route `/settings/brands` (super_admin only); "Brands" link added to user dropdown menu
- `app/brands.tsx` (mobile, new): read-only brand info screen — colors, sender email, footer legal
- Settings screen: "Brands" row in System section → navigates to `/brands`

**C8 — FW email templates + brand-filtered picker (commit `553b303`):**
- `EmailTemplate` model: `brandCode STRING(8)` nullable, auto-migrated on boot
- `emailTemplateController`: GET accepts `?brandCode=` filter; POST/PUT accept + persist brandCode
- `seedEmailTemplates.js` (new): on boot, backfills existing templates to `brandCode='SH'`, then creates 6 FW templates idempotently:
  - FlorWay - US Flooring Importers (Touch 1) — Section 301 / ASEAN angle
  - FlorWay - EU Flooring Importers (Touch 1) — antidumping / CE angle
  - FlorWay - UK Flooring Importers (Touch 1) — UKCA angle
  - FlorWay - Australia / NZ Flooring Importers (Touch 1) — short ANZ lead time angle
  - FlorWay - LATAM Flooring Importers (Touch 1) — Spanish/Portuguese offer
  - FlorWay - Middle East Flooring Importers (Touch 1) — CIF Gulf / hospitality angle
- `ComposePanel` in ClientContacts.jsx: loads `?brandCode=${leadBrandCode}` — FW lead sees FW templates only
- `BulkSendModal`: template fetch is reactive to `form.fromAddress`; switches brand → template list refreshes
- Both panels tag any saved templates with the current brandCode

---

## How the Multi-Brand System Works (reference)

| Layer | Where it lives | How it works |
|---|---|---|
| Brand table | `backend/models/Brand.js` | SH + FW rows. `code`, `senderEmail`, `displayName`, `primaryColor`, `accentColor`, `signatureHtml`, `signatureText`, `footerLegalText`, `logoUrl` |
| Brand seeding | `backend/services/seedBrands.js` | Idempotent on boot. FW has its own signature HTML/text. SH signature is `null` (served by EmailSignature flow) |
| Brand scope middleware | `backend/middleware/brandScope.js` | Injects `req.brandScope.where` for list filtering. Super_admin sees all. |
| brandCode FK | All transactional models (Lead, Quotation, Deal, etc.) | `STRING(8)`, FK to Brand.code, auto-migrated on boot, backfilled to 'SH' |
| BrandsContext (desktop) | `frontend/admin-portal/src/contexts/BrandsContext.jsx` | `useBrands()` hook: `getBrand(code)`, `accessibleBrands`, `defaultBrand` |
| useBrands (mobile) | `mobile/sovern-ops-app/src/hooks/useBrands.ts` | Module-level cache, same API surface |
| BrandBadge | Both surfaces | Color-coded pill: green = SH, blue = FW |
| Email composer | `ClientContacts.jsx` ComposePanel + BulkSendModal | Auto-selects fromAddress from brand; filters templates by brandCode |
| Campaign validation | `outreachController.js` sendCampaign | Validates fromAddress against live `Brand.senderEmail` values (not static domain list) |
| Quotation email | `quotationController.js` send | Looks up brand, builds brand-colored HTML email, routes via Gmail API |
| Egypt BCC | `outreachController.js` | `brandCode === 'SH' && country === 'Egypt'` only — never FW |
| Brand admin UI | `/settings/brands` (desktop) | Super_admin only. Edit all brand fields via accordion. |
| Brand view (mobile) | `app/brands.tsx` | Read-only. Linked from Settings > System > Brands |
| Template filtering | `emailTemplateController` + composer | `?brandCode=X` returns brand-specific templates; seed backfills existing to SH, creates FW on boot |

---

## Phase 1 Deferred Polish (still outstanding)

These were explicitly deferred during Phase 1 and not addressed in Phase 2:

- **BrandPicker in create forms** — LeadForm, QuotationForm, DealForm. Users can brand-override an existing entity via `/admin/brand-override` (audit-logged) but the create form doesn't have a picker yet. Low urgency while super_admin creates all new entities.
- **BrandBadge on deal/SO/PO/invoice headers** — added to Lead, Lead list, Quotation. Still missing from Deal, SalesOrder, PurchaseOrder, Invoice, ProformaInvoice detail pages.
- **404-on-wrong-brand for get-by-id** — implemented for Lead detail. Not yet on Quotation, Deal, SO, PO, Invoice endpoints (they return the record regardless of brand scope mismatch).
- **Mobile EAS native rebuild** — Blocked on Apple Developer account. Items 2 (voice) + 3 (camera/doc picker) from the prior AI UX session still need a native rebuild to ship on mobile. Until then those buttons throw on tap.

---

## Outstanding From Previous Sessions

### Scan-Receipt flow (staged, never committed)
The SESSION.md before this session noted these files were staged but not committed:
- `backend/routes/aiRoutes.js`
- `frontend/admin-portal/src/pages/Expenses/ExpensesPage.jsx`
- `mobile/sovern-ops-app/src/services/api.ts`
- `mobile/sovern-ops-app/app/(tabs)/expenses.tsx`

**Check the working tree first thing next session.** Run `git status` and `git diff --staged`. If the staged changes are still there, test the flow (real receipt photo on desktop, confirm Drive upload + AI extract + pre-fill banner) then commit + push.

### VM kernel update pending
`*** System restart required ***` on VM login. Schedule a reboot when convenient. pm2 handles restart cleanly.

---

## Next Task

**Start of next session — in order:**

1. `git status` — check if the scan-receipt staged changes are still there. If yes, test + commit.
2. Pick a Phase 1 polish item from the list above, or start the next major feature.

**Likely next major feature candidates (Alex to confirm direction):**
- **BrandPicker in create forms** — LeadForm, QuotationForm, DealForm. Straightforward UI addition.
- **Customer profitability page UI** — backend endpoint (`GET /api/customers/:id/profitability`) is live. Needs a chart-y breakdown page under `/customers/:id`.
- **Mobile EAS native rebuild** — requires Apple Developer account. Unblocks voice + camera features.
- **FW Touch 2 / Follow-up templates** — follow-up outreach copy for non-responders. Same template structure, different timing and hook.

---

## Deploy Process

Deploys are **fully automated** via GitHub Actions. After every push to `main`:
1. CI runs tests (auto)
2. Deploy workflow builds frontend on runner, SCPs dist to VM, restarts backend (auto)
3. Health check passes → green deploy

**Manual emergency restart:** `vm_exec: pm2 restart sovern-erp`

---

## Infrastructure Notes

- **ERP server:** GCP VM `sovern-erp`, project `local-iterator-495008-e6`, zone `us-central1-f`
- **DB:** SQLite at `/home/alex/sovern-erp/data/erp.db`
- **Git repo:** `github.com/SovernHouse/sovern-erp` (public — never commit keys/credentials)
- **Admin login:** `alex@sovernhouse.co` (`.co` not `.ca`)
- **Mobile app:** `mobile/sovern-ops-app/` — Three-Surface Rule: every desktop feature ships to mobile same commit
- **VM SSH (MCP):** Two keys in VM `~/.ssh/authorized_keys` — `sovern-mcp@claude` (Windows Cowork) + `alex-mac@sovern-erp` (Mac)
- **Claude `-p` invocation rules:** `--system-prompt`, `--strict-mcp-config`, `--permission-mode bypassPermissions`, user prompt via stdin
