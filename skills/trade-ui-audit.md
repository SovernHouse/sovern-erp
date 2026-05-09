# Trade UI Audit — Systematic User Interface Review

**Version:** 1.0 | **Created:** 2026-04-18
**Depends on:** `trade-cro.md`, `trade-frontend.md`, `trade-qa.md`, `trade-polish.md`, `Branding/BRAND-GUIDELINES.md`
**Use for:** Systematic review of any UI surface — pages, forms, emails, modals, navigation, interactive elements. Catches interaction, accessibility, mobile, and usability problems that QA and polish gates don't fully cover.

---

## Why this skill exists

QA checks correctness. Polish checks craft. UI audit checks how users actually interact with the interface — what works, what's confusing, what breaks on real devices, what screen readers can navigate. For trade sites serving international buyers on mixed devices and connections, this is non-optional.

---

## The six UI audit dimensions

### 1. Information architecture

- [ ] **Navigation hierarchy** — is the mental model obvious? Can a visitor find Products → Flooring in under 3 clicks?
- [ ] **Active state** — does the nav show where you are? Breadcrumbs on deep pages?
- [ ] **URL structure** — are URLs semantic? `/products/flooring` beats `/page?id=47`
- [ ] **Sitemap completeness** — sitemap.xml up to date, includes every indexable page, excludes admin routes
- [ ] **robots.txt** — allows indexing of public pages, disallows admin/dev routes
- [ ] **Internal linking** — related products / related pages linked naturally; orphan pages fixed
- [ ] **Footer links** — mirror the top nav + add legal pages + contact

### 2. Visual hierarchy per page

- [ ] **Hero section** — one clear focal point, one primary CTA, optional secondary CTA
- [ ] **Progressive disclosure** — complex content revealed in stages (intro → categories → details → CTA)
- [ ] **Scan-ability** — headings, pull-quotes, bold text, bullet points where appropriate
- [ ] **CTA rhythm** — multiple CTAs per long page (hero + mid-page + bottom), all pointing to consistent destination
- [ ] **Visual weight** — primary content heavier than secondary; destructive actions visually distinct

### 3. Mobile experience (non-negotiable)

Trade buyers increasingly mobile-first, especially in emerging markets.

- [ ] **360px viewport** — common Android, tight constraint; layout must hold
- [ ] **390px viewport** — iPhone baseline
- [ ] **768px viewport** — tablet
- [ ] **Text readability** — minimum 16px base font (never smaller body text)
- [ ] **Touch targets** — minimum 44×44px (Apple HIG) or 48×48px (Material), spacing between tappable items
- [ ] **No horizontal scroll** — unless an intentional gallery, never
- [ ] **Mobile menu** — hamburger or similar, clearly discoverable, closes easily
- [ ] **Forms on mobile** — input types correct (tel, email), keyboard types match, no zoom-on-focus issues
- [ ] **Images scale appropriately** — no 3200px images served to a 390px viewport (responsive srcset / next/image)
- [ ] **Hero text legibility** — contrast holds when the gradient overlay is weaker on smaller screens

### 4. Accessibility (WCAG AA minimum)

- [ ] **Color contrast** — 4.5:1 normal, 3:1 large text (≥24px or ≥18.66px bold)
- [ ] **Keyboard navigation** — every interactive element reachable via tab, focus visible, tab order logical
- [ ] **Focus indicators** — visible outline on focused elements (often brand-colored outline, not default browser)
- [ ] **Semantic HTML** — `<nav>`, `<main>`, `<article>`, `<section>` used appropriately; not all `<div>`
- [ ] **Heading hierarchy** — one `<h1>` per page, `<h2>` / `<h3>` nested logically, no skipped levels
- [ ] **Alt text on images** — descriptive, not empty, not "image of"
- [ ] **Form labels** — every input has a `<label>` (visible or visually-hidden but associated)
- [ ] **Form errors** — announced to screen readers (aria-live), visible inline, not just color-coded
- [ ] **Link text** — descriptive, not "click here" or "read more" (screen readers flatten link lists)
- [ ] **Skip links** — "Skip to main content" link at top of page for keyboard users
- [ ] **ARIA labels** — where native semantics are insufficient, aria-label or aria-labelledby present
- [ ] **Reduced motion** — respects `prefers-reduced-motion`; no parallax / auto-play videos without opt-in
- [ ] **Language attribute** — `<html lang="en">` present; switches for multi-language pages
- [ ] **Forms navigable** — logical tab order through fields, submit button reachable

### 5. Interaction fidelity

- [ ] **Hover states** — every interactive element has a clear hover state
- [ ] **Active states** — pressed / being-clicked feedback
- [ ] **Focus states** — keyboard-focus distinct from hover
- [ ] **Disabled states** — clearly distinct from active, with explanation if destructive context
- [ ] **Loading states** — any async action shows loading feedback within 100ms
- [ ] **Success / error feedback** — after actions, user knows what happened
- [ ] **Form validation timing** — on-blur for individual fields, on-submit for the whole form
- [ ] **Error recovery** — users can recover from errors without losing entered data
- [ ] **Undo or confirm for destructive actions** — "Are you sure?" or reversible soft-delete
- [ ] **Transitions** — entering / leaving / moving elements use appropriate easing and duration

### 6. Content load and performance

- [ ] **Largest Contentful Paint (LCP) ≤ 2.5s** — hero image or headline renders quickly
- [ ] **First Input Delay (FID) / Interaction to Next Paint (INP) ≤ 200ms** — interactive quickly
- [ ] **Cumulative Layout Shift (CLS) ≤ 0.1** — nothing jumps as it loads
- [ ] **Time to Interactive ≤ 3.5s** — user can engage with the page quickly
- [ ] **No render-blocking resources** — critical CSS inlined or deferred JS
- [ ] **Image formats** — WebP/AVIF where supported, quality 80-85
- [ ] **Font loading** — `font-display: swap` to avoid FOIT (flash of invisible text)
- [ ] **Third-party scripts** — minimal, loaded async/defer, regularly audited

---

## The UI audit declaration format

After a UI audit, output this block:

```
🔍 UI AUDIT — [page name or artifact]

1. Information architecture: [Pass / Issues: list]
2. Visual hierarchy: [Pass / Issues: list]
3. Mobile experience: [Pass / Issues: list]
4. Accessibility: [Pass / Issues: list]
5. Interaction fidelity: [Pass / Issues: list]
6. Content load & performance: [Pass / Issues: list]

Critical issues (blockers): [list, or None]
Non-critical issues (backlog): [list, or None]

Overall: [SHIPPABLE / REVISIONS REQUIRED]
```

---

## Device matrix — what to test on

Minimum test matrix before ship:

| Device category | Example | Notes |
|---|---|---|
| Small Android | 360×640 | Most restrictive common viewport |
| iPhone | 390×844 (14/15 Pro) | Baseline iOS |
| iPad | 768×1024 | Tablet baseline |
| Desktop common | 1280×800 | Laptop common |
| Desktop large | 1920×1080 | Desktop monitor |

For Sovern House specifically, prioritize Android + iPhone because Egyptian / Vietnamese / Chinese mobile buyers are often on Android, and Western institutional buyers often on iPhone / iPad.

---

## Browser matrix

- Chrome (latest) — most common globally
- Safari iOS (latest) — iPhone/iPad
- Edge (latest) — Windows enterprise common
- Firefox (latest) — smaller share but matters for feature detection
- Samsung Internet (latest) — common on Samsung Android in emerging markets

---

## Common UI problems on trade sites

### Problem: Menus too deep
Symptom: Products → Flooring → Hardwood → Certification → Downloads — 4 clicks to PDF
Fix: Flatten. Most trade-site products categories can collapse into 2 clicks.

### Problem: Inquiry forms too long
Symptom: 15-field RFQ form when 6 would suffice; users bail at field 8
Fix: Progressive profiling — minimal first touch (name, company, email, primary product interest); detailed follow-up after first response.

### Problem: Mobile hero layout breaks at 390px
Symptom: Display heading wraps to 4+ lines, CTA falls below the fold, image is zoomed oddly
Fix: Test at 390px explicitly; reduce hero H1 to max 2 lines at that width; CTA always above the fold.

### Problem: No loading feedback on form submit
Symptom: User clicks Submit, nothing visibly happens, they click again, double-submission
Fix: Disable button on first click + show loading spinner within 100ms.

### Problem: Inaccessible color contrast in brand accent
Symptom: Forest green on cream is fine, but forest green on other backgrounds drops below 4.5:1
Fix: Verify every instance; use opacity adjustments or font-weight changes instead of new colors (per `trade-content-editor.md`).

### Problem: Sitemap / robots.txt not synced with site
Symptom: New pages exist but aren't in sitemap; old pages in sitemap 404
Fix: Automate sitemap generation (Next.js `app/sitemap.ts`); audit quarterly.

### Problem: External links open in same tab
Symptom: User clicks a link to a supplier, leaves Sovern site, doesn't return
Fix: External links open in new tab (`target="_blank" rel="noopener"`).

---

## How to invoke this skill

1. **Before shipping any new page** — run full audit
2. **Quarterly** — audit the entire live site against this skill
3. **When Alex types "ui audit"** — run audit on the current artifact
4. **After any major content / layout change** — re-audit the changed sections
5. **When onboarding a new product category or page type** — audit at end of development

---

## Relationship to other skills

- `trade-qa.md` — runs BEFORE this skill; QA is correctness, UI audit is user experience
- `trade-polish.md` — runs AFTER this skill; polish is craft refinement atop working UI
- `trade-cro.md` — conversion optimization; UI audit surfaces CRO issues
- `trade-frontend.md` — implementation; UI audit identifies implementation gaps
- `trade-trust-architecture.md` — trust signals; UI audit ensures signals render correctly across devices
