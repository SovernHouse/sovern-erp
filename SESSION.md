# SESSION.md — Current Work State

> Maintained at end of every session so a fresh Claude Code instance can pick up without losing context. Read this first.

---

## Last Updated — 2026-05-16 Taiwan time

**Latest:** Phase 4.18 — add missing `ai_assistant_create_product` AuditLog write. The 9 IronLite SKUs created 2026-05-16 had zero corresponding audit rows even though sibling `create_product_spec` (9) and `create_product_price` (18) audited correctly. Added `auditAiWrite('create_product', 'Product', product.id, {...key fields...}, USER_ID)` in the MCP handler after the row succeeds. Convergence test runs the handler in-process (new `__testing.callTool` shim) and asserts the audit row lands. Forward-only; existing 9 rows intact, no backfill. Suite 622/622 green.

**Session arc (deployed unless noted):**

| Commit | Phase | What |
|---|---|---|
| `b06d6f7` | 4.17 sweep | Drop no-op `ProductPrice.isActive` update + fix misleading status text in `create_product` response. CI in progress. |
| `8ee420b` | 4.17 follow-up | Orphan-FK audit on prod found ProductAttribute had the same broken FK as Product — rebuilt the table (0 rows). Dropped inline `references` from the model per L-034. Patched `migrate415c1ProductCubicMeters.js` plural-vs-singular table name. Wrote retroactive sentinel so the migration stops looping on every boot. |
| `821dd19` | 4.17 | Product approval modal + 3 endpoints (`/approve`, `/reject`, `/request-revision`) + handler-noise gate. Activity pills for `entityType='Product'+type='approve'` now open a full-detail modal with the 3 actions instead of routing nowhere. `create_product` skips the approval activity when `active:true` was passed. Cleared 9 stale IronLite chips on prod via direct UPDATE. 12 new endpoint tests. |
| `baa018f` | 4.16.3 | Widened `create_product` MCP inputSchema from ~12 to ~25 fields. Handler now writes `base_fob_price`, `lead_time_days`, `origin_country`, `origin_variants`, `cubic_meters`, `certifications_list` to the row. Unblocked IronLite Turn 1 with a single tool call per product. |
| `a5d2033` | 4.16.2 | `claude -p` now invoked with `--output-format stream-json --verbose`. Each tool call / model text chunk emits a JSON event → the Phase 4.16 heartbeat watchdog finally gets a real signal. SSE `onProgress` forwards real assistant text chunks to the browser (not raw bytes). |
| `50ebf87` | 4.16.1 | `IDLE_TIMEOUT_MS` 30s → 120s. Single MCP tool calls (xlsx parse + multi-row DB writes) routinely silence stdout 30–60s — was killing legitimate turns. |
| `445f1d6` | 4.16 | SSE streaming chat + heartbeat-based subprocess liveness. Replaces flat 240s kill + 150s Express middleware. Bulk turns now have unlimited wall-clock as long as the subprocess emits progress. SSE branch on `/api/ai/chat` for streaming clients; JSON-buffer branch for mobile + offline replay. |
| `ff68428` | 4.13.6 | Sanctions URL repair (OFAC SLS canonical paths, `cons_prim.csv` → `consolidated.csv`, EU `==` padding dropped) + UA header added (root cause of 403s was Node's default UA) + failure-streak alert (Notification + email at 3+ consecutive failures) + weekly Monday URL-probe CI workflow. |
| `6f1d22b` | 4.15 docs | DEVELOPER_GUIDE + tooltipContent + helpContent for Phase 4.15b-2 + 4.15c-1/2/3. |
| `4668020` | 4.15 wrap | Container (5) + Inspection (9) + Sample (6) + LC (7) MCP tools + 4 services. **Phase 4.15 complete** (~70 tools across the sprint). |

**Direct prod-DB fixes this session (no commit, applied via `vm_exec`):**
- `4.16.4` — Rebuilt `Product` table to drop the broken `REFERENCES ProductCategory_orphan_20260515` FK. 4 rows preserved. Backup at `erp.db.pre-4_16_4-fk-rebuild.backup`.
- `4.17 fu` — Rebuilt `ProductAttribute` table to drop the same orphan FK. 0 rows. Backup at `erp.db.pre-4_17fu-fk-rebuild.backup`. Wrote retroactive Phase 4.15c-1 sentinel.
- Cleared 9 stale IronLite ScheduledActivity rows (Product, type='approve', status='pending') after the products were activated by IronLite Turn 1.

**Orphan-FK audit:** `sqlite_master WHERE sql LIKE '%_orphan_%' AND name NOT LIKE '%_orphan_%'` returns 0 tables.

---

## CI Status

- **Latest deployed commit:** `8ee420b` (Phase 4.17 follow-up). `b06d6f7` (sweep) in flight.
- **Backend health:** live at `https://erp.sovernhouse.co/api`. All boot-time migrations sentinel-recorded through `phase4_15c1_product_cubic_meters_added`. Parity check reports "checked 104 model(s) clean, 0 with mismatch(es)".
- **Tests:** 619 passing + 4 skipped (real-URL probes — gated on `RUN_SANCTIONS_URL_CHECK=true`, fired weekly by `.github/workflows/sanctions-url-check.yml`).
- **Mobile parity:** Phase 4.16 SSE branch is desktop-only opt-in via `Accept: text/event-stream`; mobile keeps the JSON-buffer branch and inherits the heartbeat watchdog + 900s budget automatically. No EAS rebuild needed for the 4.16/4.17 wave.
- **Frontend:** Vercel auto-deploys on push. Phase 4.17 added `ProductApprovalModal.jsx` to the bundle; verify post-deploy by clicking any Product activity pill.

---

## Carry-over (still open)

### #18 — Prod verification step 3 (your manual, ~5 min)
After the 4.16+4.17 wave settled, query AuditLog for `ai_assistant_*` rows to confirm the new MCP tools (~20 from the 4.15 wave + the 6 from 4.15c-3 + the 5 from 4.15b-2) are writing audit rows correctly in prod usage. Spot-check:
```
SELECT action, COUNT(*) AS n, MAX(created_at) AS last_seen
FROM AuditLog
WHERE action LIKE 'ai_assistant_%' AND created_at > date('now', '-1 day')
GROUP BY action ORDER BY n DESC;
```

### EU sanctions URL — webgate upstream still 500
The Phase 4.13.6 failure-streak alert will trip at the 3-day mark if webgate doesn't recover. First failure 2026-05-15; alert fires on or after the 2026-05-18 daily refresh run. **Scheduled in-session check-in** at `2026-05-18 09:37 TPE` (cron job `97e3fbfc`) to verify whether the alert fired and propose the OpenSanctions / data.europa.eu mirror swap if webgate is still down.

### Three-Surface Rule audit pending for Phase 4.17
The new approval modal is desktop-only. Mobile chat surface currently has no equivalent action — clicking a Product-typed approval activity on mobile does nothing useful. Not blocking (the AI assistant can call the new endpoints directly via REST through `aiAPI` from chat), but worth a small mobile-screen approval view in a future phase.

### SESSION.md compaction passed (2026-05-16)
Previous file was 1217 lines of per-phase detail. Now ~150 lines focused on recent + open work; full per-phase history lives in `git log` + commit messages.

---

## Open business carry-over (preserved from prior compaction)

- **Brands on prod:** SH active commission=0%, FW active commission=7% (HanHua Sales Rep Agreement), HH inactive.
- **Taxonomy on prod:** Flooring → Resilient → SPC/WPC/Engineered SPC/LVT/Vinyl Sheet (Resilient sortOrder=2, EngSPC=3, LVT=4, Vinyl Sheet=5). Engineered Wood + remaining flooring rows direct children of Flooring. IronCore Flooring + WPC Hybrid Flooring archived. Orphan `ProductCategory` (singular) renamed to `ProductCategory_orphan_20260515`; 18 rows preserved (~30 day retention; safe to DROP after 2026-06-15).
- **Factories on prod:** Anhui HanHua + FlorWay SDN. BHD. both `brandCode='FW'`.
- **IronLite SKUs on prod:** 9 active `IL-180x1220-{6.5..12.0}mm` products under FW brand, all category=Engineered SPC, primary factory=HanHua, origin_variants=[China, Malaysia], lead_time=30 days. 18 ProductPrice rows (2 per SKU, China + Malaysia FOB from xlsx dated 2026-05-14, validTo=+15 days). 9 ProductSpecification rows.
- **Phase 4.13d still open:** JurisdictionRule DB table + admin CRUD + full OFAC/EU/UK/UN authority matrix + Customer/Quotation parameterization + mobile UI for jurisdiction warnings (L-035). Not blocking; Phase 4.13c override route + 4.13a comprehensive jurisdictions cover the immediate need.
- **Phase 4.14.1 follow-up — Cowork sovern-mcp-server parsers**: shipped local-only at `C:\Users\Alex\Desktop\International Trade Company\sovern-mcp-server\` (initial commit `3ac9b0a` on local-only `main`). Repo has no remote. Restart Cowork app after build to load the new dist.
- **Phase 4.13a step-3 prod verification** still nominally open per task #18 — bundle with the post-4.17 audit.
- **VM kernel restart pending:** `*** System restart required ***` on last VM login. Schedule a reboot when convenient. pm2 restarts cleanly.

---

## Deploy Process

Fully automated via GitHub Actions. After every push to `main`:
1. CI runs tests (auto)
2. Deploy workflow builds frontend on runner, SCPs dist to VM, restarts backend (auto)
3. Health check passes → green deploy

**Manual emergency restart:** `vm_exec: pm2 restart sovern-erp`

---

## Infrastructure Notes

- **ERP server:** GCP VM `sovern-erp`, project `local-iterator-495008-e6`, zone `us-central1-f`
- **DB:** SQLite at `/home/alex/sovern-erp/data/erp.db` (WAL mode, 64MB cache, foreign_keys=ON)
- **Git repo:** `github.com/SovernHouse/sovern-erp` (public — never commit keys/credentials)
- **Admin login:** `alex@sovernhouse.co` (`.co` not `.ca`)
- **Mobile app:** `mobile/sovern-ops-app/` — Three-Surface Rule: every desktop feature ships to mobile same commit (or explicit deferral with companion task)
- **VM SSH (MCP):** Two keys in VM `~/.ssh/authorized_keys` — `sovern-mcp@claude` (Windows Cowork) + `alex-mac@sovern-erp` (Mac)
- **Claude `-p` invocation rules (Phase 4.16.2):** `--system-prompt`, `--strict-mcp-config`, `--permission-mode bypassPermissions`, `--output-format stream-json --verbose`, user prompt via stdin. Constants in `aiController.js`: `IDLE_TIMEOUT_MS=120_000`, `IDLE_CHECK_INTERVAL_MS=5_000`, `HARD_CAP_MS=900_000`, `SIGTERM_TO_SIGKILL_MS=3_000`. Express middleware on `/api/ai/chat` matches at 900_000ms.
- **Sanctions sources:** OFAC SLS `PublicationPreview/exports/SDN.CSV` + `consolidated.csv`, EU webgate `csvFullSanctionsList_1_1`, UN `scsanctions.un.org/.../consolidated.xml`. UA header sent on download. Streak alert at 3+ consecutive failures (Notification + email).

---

## Lessons captured this session

See `International Trade Company/Instructions & Skills/lessons.md` for full text.

- **L-048** — pdf-parse 1.1.4 on Node 22 throws "bad XRef entry"; wrap `Buffer` as `new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)`.
- **L-049** — SheetJS `sheet_to_csv` silently ignores its `range` option. Walk cells manually.
- **L-050** — Two callers applying the same one-line bugfix → extract a shared helper before the third caller forgets.
- **L-051** — Sequelize silently drops unknown attributes on `Model.create()`. "Expected X, Received 0" on a numeric round-trip = check the model column exists.
- **Architectural pattern surfaced (no L-number yet, candidate L-052):** orphan-FK rot. SQLite `REFERENCES` inline on Sequelize models pin a specific table name; archive/rename migrations on the parent don't update the FK target. With `foreign_keys=ON` this breaks every INSERT silently. Audit pattern: `SELECT name FROM sqlite_master WHERE sql LIKE '%_orphan_%' AND name NOT LIKE '%_orphan_%'`.
