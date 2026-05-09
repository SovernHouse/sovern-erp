# Trade Polish — Final Finishing Pass

**Version:** 1.0 | **Created:** 2026-04-18
**Depends on:** `trade-qa.md`, `trade-content-editor.md`, `Branding/BRAND-GUIDELINES.md`
**Use for:** The final "make it beautiful" pass AFTER QA gates pass. Polish is what separates shippable work from premium work. Trading houses compete on perceived premium-ness.

---

## Why this skill exists

After QA passes (content accurate, trust signals in place, technical integrity clean, structural match), work can still feel unfinished. The difference between "correct" and "premium" is often a collection of micro-refinements that individually seem trivial but cumulatively define the brand's polish level. Alex's brand is Hallmark Authority — institutional, restrained, precise. Polish is non-optional for that positioning.

---

## The polish hierarchy

Polish happens in this exact order. Skip or reorder at risk.

### 1. Typographic refinement

The single biggest polish lever. Get type right, everything else looks better.

- [ ] **Line lengths** — display headings: 2-4 words per line. Body copy: 60-75 characters per line for readability. Never wider.
- [ ] **Line breaks in headings** — manual `<br />` at natural breath points, not at accidental text-wrap boundaries
- [ ] **Widow / orphan control** — avoid single words on their own line at end of paragraphs (non-breaking spaces or rewording fixes this)
- [ ] **Tracking / letter-spacing** — eyebrow text: `tracking-widest` (0.1em); body: default; headings: `tracking-tight` for display
- [ ] **Leading / line-height** — body copy: 1.5-1.6; display headings: 1.0-1.1 (leading-none)
- [ ] **Hierarchy** — is there clear visual order between H1, H2, H3, body? Each level visibly different but harmonious
- [ ] **Em dashes vs en dashes vs hyphens** — em dash (—) for asides, en dash (–) for ranges, hyphen (-) for compounds. Consistency matters.
- [ ] **Quote marks** — curly "smart quotes" (" "), not straight (" "). Apostrophes curly too (').
- [ ] **Ellipses** — single character (…) not three periods (...)
- [ ] **Multiplication sign** — × not x (in dimensions, spec sheets)
- [ ] **Registered / trademark marks** — ® and ™ sized smaller and positioned correctly if used

### 2. Spatial refinement

- [ ] **Section spacing** — consistent `py-` values across all sections (16/20/24/28 Tailwind units as appropriate)
- [ ] **Grid gaps** — consistent `gap-` values (px, 4, 6, 8) — don't mix arbitrary pixel values with Tailwind scale
- [ ] **Container max-width** — consistent `max-w-7xl` (or whatever the site standard is) on every section's inner container
- [ ] **Horizontal padding** — consistent `px-6` on mobile, larger on desktop as needed
- [ ] **Vertical whitespace** — does each section breathe? Sovern House brand is restrained — err toward more whitespace not less
- [ ] **Edge alignment** — all sections' left edges align vertically down the page; no random indents
- [ ] **Rhythm** — alternate bg-cream and bg-ink sections create rhythm; avoid three same-background sections in a row

### 3. Visual hierarchy

- [ ] **Focal point per viewport** — every screen (hero, section, card) has one clear focal element
- [ ] **Eye flow** — natural F-pattern or Z-pattern scan reads the right content in the right order
- [ ] **Button hierarchy** — primary CTA (forest green, filled) vs secondary (outline or text link) clearly distinguished
- [ ] **Color weight** — bold ink headings vs muted cream/60 body creates hierarchy without introducing new colors
- [ ] **Scale contrast** — H1 visibly dramatically larger than H3; body visibly smaller than H3
- [ ] **Active vs passive elements** — links clearly styled differently from body text; buttons clearly clickable

### 4. Color refinement

- [ ] **Contrast ratios** — verify WCAG AA (4.5:1 normal, 3:1 large) on every text-on-background combination
- [ ] **Opacity discipline** — cream/60, cream/70, cream/80 for tiered hierarchy (never introduce new hex values for "slightly different" shades)
- [ ] **Hover states** — every interactive element has a visible hover state; hover transitions are 150-300ms
- [ ] **Focus states** — keyboard focus visible on every interactive element (usually a forest-green outline)
- [ ] **Active states** — buttons have pressed/active visual feedback

### 5. Image refinement

- [ ] **Resolution** — 2x source resolution for retina (e.g., 600×400 rendered = 1200×800 source)
- [ ] **Compression** — WebP or AVIF where supported, quality 85 for hero images, 80 for in-body
- [ ] **Aspect ratios** — consistent across similar image slots (all product card thumbnails same ratio, all hero images same ratio)
- [ ] **Crop / framing** — key visual element in upper-third or rule-of-thirds intersection, not center
- [ ] **Overlay gradients** — gradient over photos where text sits — ink/90 to ink/20 is the site standard
- [ ] **Alt text** — descriptive and specific, not "image" or "photo"
- [ ] **Lazy loading** — all non-above-the-fold images have `loading="lazy"`; hero image has `priority` prop

### 6. Interaction refinement

- [ ] **Transition timing** — 150-300ms for most micro-interactions, 500-700ms for section transitions (hero reveals, etc.)
- [ ] **Easing functions** — `ease-out` for things entering, `ease-in` for things leaving, `ease-in-out` for things moving across
- [ ] **Reduced motion respect** — any substantial animation wrapped in `@media (prefers-reduced-motion: no-preference)`
- [ ] **Scroll behavior** — smooth scroll to anchors, not jarring jumps
- [ ] **Form field interactions** — focus rings, validation feedback, inline error states
- [ ] **Loading states** — skeleton screens or spinners for async content, never blank spaces

### 7. Microcopy refinement

- [ ] **Button labels** — action verbs + specific outcomes ("Request a Quote" beats "Submit"; "Start an Inquiry" beats "Send")
- [ ] **Placeholder text** — specific examples, not generic ("e.g., 40ft container of hardwood flooring" beats "Enter details")
- [ ] **Error messages** — what's wrong + how to fix ("Email must include @" beats "Invalid input")
- [ ] **Success messages** — what happened + what's next ("Inquiry sent. We'll reply within 24 hours." beats "Success!")
- [ ] **Empty states** — helpful prompts, not dead ends ("No products match your filters — try broadening the category" beats "No results")
- [ ] **Tooltips (if used)** — substantive, not restating the label

---

## The polish declaration format

After polish pass, output this block:

```
✨ POLISH DECLARATION — [artifact name]

Typographic: [Pass / Issues remaining]
  Notes: [specific refinements made]

Spatial: [Pass / Issues remaining]
  Notes: [section spacing, grid consistency]

Hierarchy: [Pass / Issues remaining]
  Notes: [focal points, eye flow, button weight]

Color: [Pass / Issues remaining]
  Notes: [contrast verified, opacity scale consistent]

Image: [Pass / Issues remaining]
  Notes: [resolution, compression, alt text]

Interaction: [Pass / Issues remaining]
  Notes: [transitions, focus, loading states]

Microcopy: [Pass / Issues remaining]
  Notes: [buttons, errors, empty states]

Overall: [SHIPPED / MORE POLISH NEEDED]
```

---

## Polish anti-patterns

### Over-polishing at the cost of shipping
Symptom: 6th revision of button hover animation while a content error sits unfixed.
Reality: Diminishing returns. Polish serves shipping, not vice versa.
Fix: Time-box polish. 30-60 minutes per polish pass. Then ship.

### Polishing the wrong layer
Symptom: Pixel-perfect button corners while the headline reads like a LinkedIn ad.
Reality: Content errors dwarf visual polish. Fix content first, polish last.
Fix: Polish is Gate 5 in the ship sequence. Never before Gates 1-4.

### Under-polishing "because users won't notice"
Symptom: Leaving subtle drift because "it's fine."
Reality: Users DO notice cumulative polish level. It's the difference between a trading house and a freelance middleman.
Fix: Every gate in the polish hierarchy above gets explicit attention. Not shortcut.

### Inconsistent polish across pages
Symptom: Home page is polished, About page is rough.
Reality: Inconsistency erodes trust more than uniform-lower-polish would.
Fix: Polish passes ALWAYS include a cross-page consistency check. All product pages polished same rhythm. All transactional emails polished same rhythm.

---

## Sovern House polish signature

The brand has specific polish signatures that make Sovern-specific work recognizable:

- **Big Shoulders Display Bold** on `<br />` line breaks at natural breath points (e.g., "Your buying office<br />in Asia")
- **Eyebrow text** in forest green, tracking-widest, uppercase, before every H1
- **Middle-dot separator** (·) for inline item lists, never comma (e.g., "Taiwan · Mainland China · Vietnam · Thailand")
- **Forest-green accent rule** on hover states for CTAs
- **Cream-on-ink** sections alternate with cream background sections for rhythm
- **Generous vertical breathing** — section py-20 minimum, often py-24 or py-28 on hero / major sections

When polishing Sovern work, reinforce these signatures. Cutting one for convenience degrades the brand.

---

## How to invoke this skill

1. **After QA passes all four gates** — run polish pass before final commit
2. **When Alex says "polish this"** — run the full hierarchy
3. **When reviewing another agent's work** — use this skill as the checklist
4. **Before any deck / PDF / email template is finalized** — the polish hierarchy applies to non-web artifacts too (sections 1, 2, 3, 7 especially)

---

## Relationship to other skills

- `trade-qa.md` — runs BEFORE this skill; QA is correctness, polish is craft
- `trade-content-editor.md` — brand voice; polish can't fix bad voice
- `trade-cro.md` — polish often improves conversion (clearer CTAs, better hierarchy)
- `Branding/BRAND-GUIDELINES.md` — the source of truth for color / typography / spacing decisions
