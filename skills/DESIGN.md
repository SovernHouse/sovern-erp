---
name: Sovern House
description: Design system for Sovern House — an Asia-based international trade buying office. Three-color brand with editorial typography. Every visual decision serves credibility, trust, and cross-cultural professionalism.

colors:
  ink: "#0E0D0C"
  cream: "#F1EEE7"
  forest: "#1D5A32"
  forest-light: "#2A7040"
  cream-dark: "#E4E0D8"
  ink-muted: "rgba(14,13,12,0.6)"
  cream-muted: "rgba(241,238,231,0.7)"
  cream-subtle: "rgba(241,238,231,0.1)"

typography:
  brand-display:
    family: "Big Shoulders Display"
    weight: 700
    usage: "Brand name (SOVERN HOUSE wordmark) only. Never use for body copy, headings, or labels."
  display:
    family: "Arsenal SC"
    weight: 400
    letter-spacing: "0.1em"
    text-transform: "uppercase"
    usage: "All headings, navigation labels, buttons, tags, section labels, and UI copy. Small-caps font — renders uppercase regardless of input case."
  body:
    family: "Arsenal SC"
    weight: 400
    letter-spacing: "0.01em"
    text-transform: "none"
    usage: "All body/prose text. Same family as display but without tracking and without uppercase transform."

spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  2xl: "64px"
  section-y-mobile: "64px"
  section-y-desktop: "96px"

rounded:
  none: "0px"
  note: "Sovern House uses zero border-radius across all components. No rounded corners anywhere."

components:
  wordmark:
    description: "The SOVERN HOUSE logotype lockup. Three stacked elements sharing identical width."
    elements:
      - "SOVERN in Big Shoulders Display Bold, large (~64px at full size)"
      - "A solid 3px horizontal rule in forest green, full width of SOVERN"
      - "HOUSE in Arsenal SC, distributed across the same width using flex space-between"
    critical-rule: "HOUSE must use display:flex; justify-content:space-between with each letter as a <span>. Never use letter-spacing to match width — it drifts at different sizes. The rule and HOUSE share the exact horizontal extent of SOVERN."
    size-ratio: "SOVERN height to HOUSE height is approximately 4:1 (e.g., 28px SOVERN, 8px HOUSE at sidebar scale)"

  button-primary:
    background: "{colors.forest}"
    color: "{colors.cream}"
    font: "{typography.display}"
    padding: "10px 20px"
    border: "none"
    border-radius: "{rounded.none}"
    hover-background: "{colors.forest-light}"

  button-secondary:
    background: "transparent"
    color: "{colors.ink}"
    border: "1px solid {colors.ink}"
    font: "{typography.display}"
    padding: "10px 20px"
    border-radius: "{rounded.none}"

  nav:
    background: "{colors.ink}"
    link-color: "{colors.cream-muted}"
    link-hover-color: "{colors.cream}"
    font: "{typography.display}"
    font-size: "14px"
    height: "80px"

  card-dark:
    background: "{colors.ink}"
    color: "{colors.cream}"
    border-radius: "{rounded.none}"

  card-light:
    background: "{colors.cream}"
    color: "{colors.ink}"
    border-radius: "{rounded.none}"

  section-label:
    font: "{typography.display}"
    font-size: "12px"
    color: "{colors.forest}"
    letter-spacing: "0.15em"

  divider:
    color: "{colors.forest}"
    weight: "3px"
    usage: "Used in wordmark and as section separators. Forest green only."
---

## Overview

Sovern House is an Asia-based international trade buying office — 30 years on the ground, Mandarin-fluent, built for buyers who need a credible partner in Asia. The visual identity communicates precision, authority, and cross-cultural trust. It is deliberately restrained: three colors, two typefaces, zero decorative elements.

Every design decision answers one question: *would a serious international buyer trust this?*

## Colors

**Ink** (`#0E0D0C`) is near-black with a warm undertone. It is the primary background for headers, navigation, hero sections, and dark-mode panels. It reads as sophisticated and intentional — not generic web dark mode.

**Cream** (`#F1EEE7`) is the primary light background and body text-on-dark color. It is warm, not sterile. Used for content sections, card backgrounds, and as text against ink.

**Forest** (`#1D5A32`) is the brand accent. It appears on: the horizontal rule in the wordmark, CTA buttons, hover states, section label text, bullet markers, and border accents. It should never dominate a layout — it earns its impact through restraint.

**The three-color rule is absolute.** No grays, blues, reds, or secondary palette colors are permitted in any brand context. Variations (opacity, lighter tints) are allowed but must derive from these three base values only.

## Typography

Two typefaces only: **Big Shoulders Display Bold** and **Arsenal SC Regular**.

Big Shoulders Display Bold is reserved exclusively for the SOVERN HOUSE wordmark. It appears nowhere else — not in headings, not in pull quotes, not in the tagline. Its heavy slab-serif geometry belongs only to the brand name.

Arsenal SC is the workhorse: all headings, navigation, buttons, labels, body copy, and UI text. It is a small-caps typeface, which means it renders in small capitals at any case. Heading/UI usage applies `tracking-widest uppercase` via Tailwind. Body prose drops tracking and case transform.

**Loading**: Both fonts must be loaded from Google Fonts. Import at the layout level, not component level. Big Shoulders Display should only be loaded with weight 700. Arsenal SC should be loaded with weight 400.

```
Big Shoulders Display: https://fonts.google.com/specimen/Big+Shoulders+Display
Arsenal SC: https://fonts.google.com/specimen/Arsenal+SC
```

## Layout

The grid is `max-w-7xl mx-auto px-6` — a 1280px max-width container with 24px horizontal padding. All sections use this container.

Section vertical rhythm:
- Mobile: `py-16` (64px)
- Desktop: `py-20 lg:py-28` (80px / 112px)

The navigation bar is fixed, `z-50`, 80px tall, ink background. The logo intentionally overflows the nav bar height (155px tall image) for a bold brand statement — this overflow is a deliberate design choice, not a bug.

Alternating section backgrounds (ink / cream) create rhythm and prevent visual fatigue on long pages.

## Elevation & Depth

No box shadows. No drop shadows. No blur effects. Depth is created through background color contrast (ink vs cream), border lines (`border border-cream/10`), and layered overlays on image sections.

Image hero overlays use a directional gradient: `bg-gradient-to-r from-ink/92 via-ink/80 to-ink/40` (left-heavy) or `bg-gradient-to-t from-ink/90 via-ink/40 to-ink/10` (bottom-heavy). This ensures readable text while allowing the image to breathe.

## Shapes

Zero border-radius, universally. No pill buttons, no rounded cards, no circular avatars. Sharp corners are a deliberate part of the brand's architectural precision. This applies to buttons, cards, inputs, dropdowns, modals, and images.

The one exception: user-uploaded profile images in the client portal may use `rounded-full` as a UX convention.

## Components

### Wordmark

The SOVERN HOUSE lockup requires three co-equal horizontal elements:

```
SOVERN          ← Big Shoulders Display Bold, ~64px
━━━━━━━━━━━━━━  ← 3px solid forest rule, full width
S O V E R N    ← Arsenal SC, flex space-between, ~16px
```

The flex space-between layout on HOUSE is mandatory. Letter-spacing drifts at different container sizes; space-between does not. HOUSE uses each letter as a separate `<span>` inside a flex container with `justify-content: space-between; width: 100%`.

### Buttons

Primary CTA: forest background, cream text, Arsenal SC, tracking-widest, uppercase, no border-radius. Hover: lighten to `forest-light`.

Secondary/ghost: transparent background, ink border and text. Hover: ink background, cream text.

Never use rounded corners on buttons.

### Navigation

Fixed top bar, ink background, 80px height. Links in Arsenal SC, tracking-widest, uppercase, cream/80 opacity default, cream on hover. Dropdowns: absolute positioned, ink background, cream/10 border, no border-radius.

CTA button in nav uses forest background (same as primary button).

### Cards

Two variants: dark (ink bg, cream text) and light (cream bg, ink text). Both use sharp corners. Left border accents use `border-l-2 border-forest` for callout/highlight cards.

### Section Labels

Small uppercase text that appears above section headings: `text-forest text-xs font-display tracking-widest uppercase`. Example: "Product Category" above a page title, or "Why Sovern House" above a section heading.

## Do's and Don'ts

**Do:**
- Use ink and cream as the primary pairing for every section
- Let forest green do the heavy lifting as an accent — it earns trust through restraint
- Use Arsenal SC tracking-widest uppercase for all UI labels, nav, and buttons
- Keep the wordmark lockup exact — HOUSE must span SOVERN's width exactly
- Apply `Your buying office in Asia.` as the brand tagline (italic, cream/60, below the wordmark in signatures and footers)

**Don't:**
- Add border-radius to any component
- Use any color outside ink, cream, and forest (and their opacity variants)
- Use Big Shoulders Display for anything except the SOVERN HOUSE wordmark
- Include Taiwan, China, or any specific country in taglines or positioning copy
- Use letter-spacing on the HOUSE lockup — use flex space-between instead
- Add drop shadows, glows, or blur effects
- Write "Alex", "Alexander", or any name sign-off in outbound email body copy — the ERP signature block handles this automatically

## Email Signature

The confirmed Sovern House email signature layout (rendered by the ERP — never written manually in email body):

1. Forest-green horizontal rule
2. Handwritten signature image (`alex-signature.jpg`)
3. **Alexander McConnell** — bold
4. FOUNDER — uppercase, tracked (role only; wordmark below establishes the brand)
5. `sovernhouse.co · +886 970 781 818`
6. SOVERN HOUSE CSS wordmark (Big Shoulders Display + forest rule + Arsenal SC HOUSE)
7. *Your buying office in Asia.* — italic, cream/60
8. Thin divider
9. Legal line: "Sovern House is a brand of New Route International Exchange Co., Ltd. — Taiwan." (10px, muted)
