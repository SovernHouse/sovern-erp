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
