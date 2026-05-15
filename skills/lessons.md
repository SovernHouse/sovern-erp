# International Trade Company — Lessons Learned

Running record of mistakes, corrections, and non-obvious patterns discovered in this project.
**Updated after every user correction.** Read this at the start of every session.

---

## Process & Workflow

**L-001 — Commit only when Alex explicitly says to commit**
Never auto-commit. Only commit when Alex explicitly says he is happy with the work and asks to commit. Alex pushes from his own Windows terminal — never push from the Linux VM.

**L-002 — Verify behavior, not just code changes**
Before marking any task done, verify the system behaves differently (correctly) — not just that the code changed. Load the page, test the form, check the API response. "It compiles" is not "it works."

**L-003 — Fix root causes, not symptoms**
When debugging, resist the urge to patch the visible symptom. Trace the issue to its source. A symptom fix today creates two bugs tomorrow. Document the root cause in this file.

---

## International Trade — Domain Lessons

*(This section will grow as the project progresses. Add lessons about Incoterms errors, compliance missteps, documentation mistakes, pricing/margin miscalculations, and supplier/logistics issues.)*

**L-010 — Always verify HS/HTS codes with a licensed customs broker**
Never guess or rely on AI-generated tariff classifications. Misclassification can result in penalties of 20-400% of the goods' value. The HS code determines duty rates, FTA eligibility, and export control applicability. Get it verified before any cost calculation.

**L-011 — Landed cost calculations must include ALL cost components**
A "profitable" deal on paper can be a loss once you add: freight, insurance, customs duties, port handling, inland transport, customs broker fees, bank charges (LC fees), currency conversion costs, and warehousing. Never quote a margin without a complete landed cost model. Use the CFO skill's landed cost framework.

**L-012 — Incoterms are not interchangeable — each shifts cost and risk differently**
CIF and FOB look similar but have fundamentally different risk transfer points. Using the wrong Incoterm in a contract vs. what was quoted can create uninsured gaps. Always confirm the Incoterm matches across: quote, contract, insurance policy, and shipping instructions.

**L-013 — Sanctions screening must happen BEFORE engagement, not after**
Screen every new customer, supplier, and intermediary against OFAC SDN, EU Consolidated List, and UN lists before sending a quote or signing anything. Retroactive screening after a deal is in progress creates legal exposure. Use the compliance skill's screening checklist.

**L-014 — Malaysia LVT/SPC campaign: speak as the factory, not as a middleman**
Sovern House has a direct factory relationship with a Malaysian LVT/SPC manufacturer. Outreach copy must reflect this: say "we're shipping from our factory in Malaysia" — never "I have an agency agreement," "I work with a factory," or "there's a factory I know." Those phrases reintroduce a middleman layer that doesn't exist. The buyer should feel they are going direct. Also: never use "buying house" framing for this campaign. See the updated Malaysia LVT/SPC template in trade-outreach-copy.md Section IV.

**L-015 — No em dashes in any written output, ever**
Em dashes (—) are prohibited in all copy, emails, documents, and communications written for Alex. Use periods, commas, colons, semicolons, or parentheses instead. This rule has been violated repeatedly. Check every draft before presenting it.

---

## Website & Technical Lessons

*(This section will grow as the website is built. Add lessons about platform issues, integration bugs, performance problems, and UX discoveries.)*

**L-032 — Git identity: always use VendettaGamesHQ / thevendettadao@gmail.com — never commit as "Alex"**
The correct git identity for all Sovern House commits is:
- `user.name = VendettaGamesHQ`
- `user.email = thevendettadao@gmail.com`

This is the GitHub account linked to the Vercel project. Commits with any other identity (including "Alex" / vendettadaogames@gmail.com) show as an unrecognized user and Vercel blocks the deployment.

**Preferred workflow:** stage files with `git add`, then tell Alex to commit and push from his Windows terminal — his local git config already has the correct identity. If committing from the sandbox is unavoidable, set config with `git config user.name "VendettaGamesHQ"` and `git config user.email "thevendettadao@gmail.com"` BEFORE running `git commit`. Never guess the identity — if unsure, run `git log --format="%an %ae" -1` on a known-good commit to verify.

**Recovery if wrong identity is used:** `git commit --amend --reset-author --no-edit` (after correcting git config) then `git push --force-with-lease`. If sandbox lock files block the amend, Alex must delete `.git/index.lock` from his Windows terminal first.

**L-031 — Always write website files directly to the mounted website codebase**
The Next.js website codebase is mounted and directly accessible at:
`/sessions/nifty-keen-feynman/mnt/International Trade Company/Website/`
Never create a "pending changes" staging folder or write files to a separate location. Read and write files directly in the Website directory. The design system uses custom tokens: `ink`, `cream`, `forest`, `font-display` (Big Shoulders). No hardcoded hex values — always use the design system tokens. Confirmed 2026-04-21.

**L-020 — Never trust comments or variable names — read the actual code**
Code comments become stale. Variable names can mislead. Before making any change, read the actual implementation at the specific file:line. Cite file:line references in any verification.

**L-021 — Multi-currency display must use locale-appropriate formatting**
Different locales use different decimal separators, thousands separators, and currency symbol positions. Always use `Intl.NumberFormat` with the correct locale. Never hardcode comma/period assumptions. EUR in Germany: 1.234,56 €. USD in US: $1,234.56.

**L-022 — Test forms with international input patterns**
International users have different name formats (no first/last split in some cultures), phone formats (+country code), and address structures (no ZIP code in some countries). Test with real international data, not just US-format inputs.

**L-041 — Never transplant tariff framing between markets without re-running the duty stack from scratch**

In May 2026, drafted two cross-market cold-email batches that copied tariff language across borders without recomputing the actual duty picture. First, Section 301 framing leaked into Canada emails (Section 301 is a US statute, irrelevant to Canadian importers). Second, "China still wins on price for the right volume" leaked into US emails (China-origin SPC/LVT into the US faces MFN 6.5% + Section 301 7.5% + IEEPA 20% + reciprocal 10% under May 2025 truce = roughly 44% combined, vs Malaysia duty-free, so China is not a viable US origin at any volume today).

- **Root cause:** Cross-market template reuse without per-pair duty-stack recomputation. Treated "tariff context" as transferable text, not as a fact set bound to a specific (origin, destination, HS code) triple.
- **Fix:** Before any cross-market sourcing run, build the duty stack from scratch per (origin × destination × HS code) pair. Confirm: MFN base, FTA preferences, Section 301 / 232, IEEPA, reciprocal, AD/CVD, and any active investigations. Do not reuse copy across markets.
- **Rule:** When reframing email templates between markets, treat each (origin, destination) pair as a new compliance problem. Verify with a web search of the current tariff stack on the day before locking the template into a brief.

**L-042 — All user-facing timestamps are Asia/Taipei (UTC+8). Never display UTC anywhere.**

Every timestamp surfaced to Alex (or to any user of any Sovern surface) must be rendered in Asia/Taipei. This applies to the desktop ERP, customer portal, factory portal, mobile app, AI chat output, transactional emails, XLSX/PDF exports, audit logs, push notification bodies, and any future surface. The database can store UTC freely; the display layer is the one responsible for converting.

- **Root cause:** Multiple surfaces have rendered raw UTC ISO strings (`...Z`) or appended "UTC" to timestamps because the formatter at the leaf component used `toISOString()` or `toString()` instead of a localised formatter. The mismatch creates daily friction (Alex sees an 8-hour-off timestamp, has to mentally convert) and looks unprofessional to clients on shared documents.
- **Fix:** Default formatter for any user-facing timestamp is `date.toLocaleString('en-GB', { timeZone: 'Asia/Taipei' })`, or an equivalent that explicitly passes `timeZone: 'Asia/Taipei'`. Never call `.toISOString()` for display. Never concatenate `'UTC'` as a suffix. The AI chat assistant's system prompt now carries a global timezone rule covering every field returned by ERP tools.
- **Rule:** No raw UTC, no `Z` ISO suffix, no `UTC` label in any user-visible string. Audit before merging: search the diff for `toISOString()`, `'UTC'`, and naked `Date.toString()` calls in render paths. If you find one in code you are touching, fix it.

**L-043 — Literal backticks inside a JS template literal must be escaped, even in the middle of a "string" of markdown copy**

When editing a long template literal (e.g. the AI assistant system prompt in `backend/services/aiContextService.js`, which starts with `` return ` `` and runs hundreds of lines), any unescaped backtick inside the body terminates the outer string. The rest of the file then parses as code, the parser throws a confusing error on the first identifier after the rogue backtick, and Jest fails ALL test suites that import the file. CI on `a6fc36f6` failed with 148/219 tests broken; symptom was a `SyntaxError: Unexpected identifier 'ai_assistant_'` 30 lines below the actual bug.

- **Root cause:** Phase 4.5 C19 v2 added a markdown bullet that styled a tool name with backticks: `` `ai_assistant_<tool_name>` ``. Inside a template literal, those backticks closed the literal early. The author saw the markdown reading correctly and missed that the surrounding code context was already a template literal, not a regular Markdown file.
- **Fix:** Use the file's existing convention: escape the literal backtick with a leading backslash, `` \` ``. The existing prompt at lines 507 and elsewhere already shows the pattern: `` \`/new-clients <brief>\` ``. After the hotfix at commit `c71eb25`, backend tests are 219/219 pass.
- **Rule:** Before editing any large template literal (look for `` return ` `` or `const X = ` `` near the top of the file), check whether the inner content uses backticks. If you add backtick-styled tokens inside, escape with `` \` ``. Same hazard applies to `$` (template interpolation) and unescaped `${...}` blocks: prefix with `\` if literal. After ANY edit to such a file, run `node -e "require('./path/to/file.js')"` locally before pushing. Jest will catch it eventually, but the round-trip through CI burns a minute and a hotfix commit.

**L-044 — React Native horizontal ScrollView clips its children unless flexGrow is pinned to zero**

When a React Native horizontal `<ScrollView>` sits between two flex children (e.g. a sort-toggle row above and a `<FlatList>` below), the ScrollView inherits the parent's flex distribution behavior. Without `style={{ flexGrow: 0, flexShrink: 0 }}`, RN allots it a vertical height that does not include the pills' full padding+border, and the bottom half of the pills (and bottom of their text) renders behind the FlatList that follows. Reads to the user as "washed out" or "low contrast" because only the top half of each pill is visible. Confirmed visually on iOS in Phase 4.8 Commit 3c.

- **Root cause:** RN ScrollView's default flex behavior in a flex column container assumes vertical scrolling. Setting `horizontal={true}` does not also imply `flexGrow: 0`. The ScrollView claims more vertical space than its content's intrinsic height, then renders content at the top and lets the FlatList beneath cover the remainder.
- **Fix:** Always set `style={{ flexGrow: 0, flexShrink: 0 }}` on horizontal ScrollViews used as a row inside a column-flex parent. `contentContainerStyle` alone does NOT pin height; the outer `style` does.
- **Rule:** Any horizontal `<ScrollView>` between flex siblings gets `style={{ flexGrow: 0, flexShrink: 0 }}`. Verify on an actual iOS device, not just the simulator — iOS sometimes renders this differently between the two.

---

## Verification Checklist (Before Marking Any Task Done)

- [ ] Read the actual code at file:line, not just the comment or variable name
- [ ] If the change touches pricing or margins, verify the full landed cost calculation
- [ ] If the change touches compliance, verify against the compliance skill's checklist
- [ ] If the change touches the website, test on mobile (390px) and desktop (1280px+)
- [ ] If the change involves a trade document, verify all required fields per the operations skill
- [ ] Would a senior engineer / experienced trade professional approve this? If no, keep going.
- [ ] If the fix involved a correction from Alex — add it to this file before moving on

---

*Last updated: 2026-04-09 (Initial setup — adapted from Vendetta Saloon lessons framework)*
