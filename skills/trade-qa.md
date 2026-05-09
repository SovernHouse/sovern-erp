# Trade QA — Pre-Ship Quality Assurance

**Version:** 1.0 | **Created:** 2026-04-18
**Depends on:** `trade-content-editor.md`, `trade-trust-architecture.md`, `trade-frontend.md`, `Branding/BRAND-GUIDELINES.md`
**Use for:** Systematic QA pass before ANY public artifact ships — website page, email, outreach copy, contract, proposal, deck, PDF, image, or any branded document.

---

## Why this skill exists

"It compiles" is not "it ships-ready." On 2026-04-17, an auto-parts page was shipped with tier language that leaked internal strategy, an image placeholder that would have 404'd, and claims unsupported by evidence. Every one of those would have been caught by a pre-ship QA pass. This skill defines the pass.

---

## The four-gate model

Every artifact goes through four gates. Skip a gate = skip a check = risk a mistake making it into production.

### Gate 1 — Content integrity
Does the content itself meet our standards?

- [ ] **Brand voice filter** — passed `trade-content-editor.md` audit (no clichés, no exclamation marks, no internal jargon leakage)
- [ ] **Commercial sensitivity filter** — no margin data, no supplier names, no pricing tiers, no internal strategy sequencing visible to public
- [ ] **Substantiation** — every claim in the copy is checkable or removable (no "industry-leading" without proof)
- [ ] **Accuracy** — every stat, figure, date, name, certification is verified against a current authoritative source
- [ ] **Language + spelling** — proofread, no typos, no awkward phrasing, Oxford comma consistent with existing site
- [ ] **Translations (if applicable)** — professional translation for legal/commercial content, not machine translation

### Gate 2 — Trust integrity
Does the artifact support buyer trust, or undermine it?

- [ ] **Seven-pillar audit** per `trade-trust-architecture.md` — score each pillar Present / Partial / Missing
- [ ] **Any "Missing" score** — must be justified or resolved before ship
- [ ] **Third-party verification** — if making a credential claim, is the issuing body named and linkable?
- [ ] **Legal entity visibility** — is Sovern House's parent entity identifiable where appropriate?
- [ ] **Response-time commitment** — if there's a contact surface, is the expected reply time explicit?
- [ ] **Compliance visibility** — if relevant to the artifact, is sanctions / ethics / compliance posture visible?

### Gate 3 — Technical integrity
Does the artifact render and function as expected across real conditions?

- [ ] **Desktop render** — at 1280px, 1920px widths, looks correct
- [ ] **Mobile render** — at 390px (iPhone baseline), 360px (common Android), layout holds
- [ ] **No broken assets** — images resolve (no 404s on image paths), fonts load, icons visible
- [ ] **Interactive elements work** — links navigate correctly, forms submit, buttons are reachable
- [ ] **Lighthouse Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO = 100** — run in incognito to avoid extension noise
- [ ] **Keyboard navigation** — tab order is logical, focus visible, skip-links present if needed
- [ ] **Screen reader spot-check** — critical content has proper semantic HTML + alt text
- [ ] **Production env** — if the artifact depends on env vars, they're set in production (not just dev)

### Gate 4 — Structural integrity
Does the artifact fit the site / brand / document system patterns?

- [ ] **Matches existing section rhythm** — hero → categories → certifications → CTA (or whatever the page type's established pattern is)
- [ ] **Typography discipline** — Big Shoulders Display Bold for wordmark/display only, Arsenal SC Regular for supporting copy
- [ ] **Color discipline** — ink, cream, forest only (no introduced colors)
- [ ] **Clear space** — per brand guidelines (cap-height of "H" in HOUSE around the logo lockup)
- [ ] **Section spacing** — matches existing pages; no custom margins/padding that breaks the site rhythm
- [ ] **CTA pattern match** — forest green bar + "Start an Inquiry" or equivalent, matching existing product pages
- [ ] **Footer + header consistency** — the artifact doesn't introduce new footer/header elements inconsistent with the site

---

## The QA declaration format

Before any artifact is declared ready to ship, output this block:

```
✅ QA DECLARATION — [artifact name / page name / email subject]

Gate 1 — Content integrity: [Pass / Conditional / Fail]
  Notes: [specific issues found or confirmed clean]

Gate 2 — Trust integrity: [Pass / Conditional / Fail]
  Notes: [pillar scores per audit]

Gate 3 — Technical integrity: [Pass / Conditional / Fail]
  Notes: [desktop/mobile render, Lighthouse scores, any 404s or broken assets]

Gate 4 — Structural integrity: [Pass / Conditional / Fail]
  Notes: [structural pattern match, typography, color discipline]

Overall: [READY TO SHIP / NEEDS REVISION — LIST BLOCKERS]
```

Alex reads the block to validate work is actually ready. No block = not QA'd = not ready.

---

## Category-specific QA checklists

### Website pages

Run all four gates. Additionally:
- [ ] Metadata: title, description, canonical URL correct
- [ ] OG / Twitter card tags present
- [ ] Internal links to other site pages use relative paths (`/products/...` not full URLs)
- [ ] External links open in new tab (`target="_blank" rel="noopener"`) where appropriate
- [ ] Image `alt` attributes are descriptive, not empty, not "image of" filler

### Emails (transactional or outbound)

Run Gates 1, 2, 4 + technical:
- [ ] From, Reply-To, Subject clear and brand-aligned
- [ ] Preview text set (not "View this email in browser" filler)
- [ ] Images have fallback for disabled-image clients
- [ ] Links are HTTPS, not HTTP
- [ ] Unsubscribe mechanism (if marketing) is present and compliant
- [ ] Rendered test in Gmail, Outlook, iOS Mail — visible in all three
- [ ] Legal entity footer matches the brand standard

### PDFs / documents / proposals

Run Gates 1, 2, 4:
- [ ] Typography: Big Shoulders Display Bold for wordmark/headings, Arsenal SC Regular for body
- [ ] Page margins match brand system
- [ ] Wordmark used correctly (light variant on light, dark variant on dark, never recreated)
- [ ] Legal entity statement at end
- [ ] File name follows convention: `SovernHouse_[DocType]_[ClientOrProject]_[Date].pdf`

### Outreach copy (LinkedIn, cold email, WhatsApp)

Run Gate 1 primarily:
- [ ] Personalized — references something specific to the recipient
- [ ] No generic sales clichés
- [ ] No tracking pixel, no marketing-flag words ("synergy," "leverage," "opportunity")
- [ ] Single clear CTA
- [ ] Signature matches brand standards
- [ ] For Egypt lane: appropriate greeting, Arabic where needed, reviewed by Egyptian Country Manager

---

## Common failure modes

### "I'll fix it in a follow-up commit"
Symptom: Knowingly shipping something imperfect with promise to fix later.
Reality: Follow-ups rarely happen. The imperfection ships and stays.
Fix: Don't ship until all four gates pass. If the imperfection is acceptable, document WHY in the QA declaration.

### "It looks fine on my screen"
Symptom: Only checking on one device / viewport / browser.
Reality: Most traffic is mobile, and mobile regressions are common when a page is designed on desktop.
Fix: Gate 3 is not optional. Minimum 390px mobile + 1280px desktop every time.

### "The placeholder will get fixed later"
Symptom: Shipping with broken image paths, "lorem ipsum," TODO comments, or placeholder links.
Reality: These stay in production for weeks. Prospects see them.
Fix: Either the real asset ships OR the placeholder section is removed entirely until the real asset is ready.

### "Close enough to the brand"
Symptom: Pages that mostly follow brand guidelines but have small drifts (wrong accent color, custom typography choice, new section pattern).
Reality: Drift compounds. Each page's exception becomes the next page's reference.
Fix: Gate 4 explicitly. Reject any drift not justified and documented.

### "The QA block is boilerplate"
Symptom: Filling out the QA declaration as a checkbox exercise without actually running the checks.
Reality: The audit is the audit. Pretending to audit is worse than no audit because it creates false confidence.
Fix: Actually run each gate. If you can't, say so and flag it — don't fake Pass.

---

## How to invoke this skill

1. **Before any public artifact ships** — run all four gates and output the QA declaration
2. **When Alex types "gates checked?"** — re-output the QA declaration for the current artifact
3. **During review / before final commit** — use this skill as the final filter
4. **As part of every new skill's development** — make sure the new skill's outputs can be audited with this skill

---

## Relationship to other skills

- `trade-content-editor.md` — drives Gate 1 (content integrity)
- `trade-trust-architecture.md` — drives Gate 2 (trust integrity)
- `trade-frontend.md` — drives Gate 3 (technical integrity) for web artifacts
- `trade-polish.md` (pending) — drives the final polish pass AFTER QA passes all four gates
- `Branding/BRAND-GUIDELINES.md` — drives Gate 4 (structural + brand integrity)

**Gate precedence:** If gates disagree, Content Integrity wins over Structural if the structural pattern would require a commercial-sensitivity breach. If gates agree all Pass, ship.
