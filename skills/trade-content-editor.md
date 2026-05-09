# Trade Content Editor / Brand Voice Guardian

**Version:** 1.0 | **Created:** 2026-04-18
**Depends on:** `Branding/BRAND-GUIDELINES.md`, `Branding/Sovern House — Brand Guidelines.pptx`, `trade-cmo.md`
**Use for:** Translating internal research into public-facing copy without leaking commercial sensitivity, breaking brand voice, or introducing unsubstantiated claims.

---

## Why this skill exists

On 2026-04-17, internal market-entry research (margin data, tier-based sequencing, commercial-sensitive pricing) was reflexively published to the public auto-parts page. The structural error: "research document" and "buyer-facing marketing copy" are two fundamentally different artifacts, and nothing in the prior skill stack enforced the separation.

This skill is the explicit filter between them. Every draft — public page, email, landing page, press release, deck, investor update — goes through this filter before anything ships.

---

## Core principle: the three-audit test

Before any draft goes live, ask three questions. If the answer to any is NO, rework.

1. **Would I publish this in a press release?** If the language is too casual, too internal, or too specific to Sovern's strategy for a formal trade-press announcement, it doesn't belong on a public page.

2. **Would I publish this in a pitch deck to a partner or investor?** Related but different — investor audiences want strategic clarity, not marketing fluff. If a sentence reads like generic marketing ("industry-leading solutions"), investors see through it. Cut.

3. **Would I be comfortable if a competitor downloaded this from our site and analyzed it in a due-diligence file?** This is the commercial-sensitivity test. Margin data, supplier names, pricing tiers, tactical sequencing — none of it survives this test.

---

## The never-publish list

These items are ALWAYS internal. Never on the public site, never in outbound emails, never in decks that might leak:

| Category | Examples | Why |
|---|---|---|
| **Cost & margin data** | "FOB $1-4 per unit," "gross margin 65-75%," "landed cost," "our commission" | Competitors use this in negotiations; buyers assume the worst when they see your margin |
| **Supplier identities** | Factory names, city-level supplier locations, verified-supplier counts | Suppliers are the moat — don't hand them to competitors |
| **Internal sequencing language** | "Tier 1/2/3," "Stage 1/2/3," "Phase A/B," "first container," "beachhead product," "market entry sequence" | Reads as commodity-trader internal jargon; customers don't organize their buying this way |
| **Commercial terms before negotiation** | Payment terms, credit limits, MOQs on public pages (these are deal-specific) | Locks you into terms before the conversation |
| **Buyer segmentation language** | "Small buyer," "mid-market," "tier 3 customer," "SMB segment" | Nobody wants to be classified as "mid-market" on a vendor site |
| **Win-rate and conversion stats** | "We close 40% of RFQs," "average deal size," "our funnel" | Commercial information; erodes buyer leverage |
| **Specific client names** | Client logos without permission, named case studies without sign-off | Legal and relational risk |

---

## The brand-voice filter

Sovern House brand voice per official guidelines: **sovereign clarity.** Condensed, architectural, monumental. Monochrome palette. Restraint over decoration. Forest green is the one chromatic accent — unowned in the Asia sourcing category.

Voice rules that follow from this:

- **No marketing clichés.** Ban list: "industry-leading," "solutions-oriented," "best-in-class," "synergy," "leverage," "unlock value," "strategic," "seamless," "holistic," "paradigm," "circle back," "reach out," "pain points," "one-stop shop." If a line reads like LinkedIn content marketing, cut it.
- **No exclamation marks.** Sovern House is institutional. Institutions don't shout.
- **No emojis.** Period.
- **Short declarative sentences.** "We source from verified factories" beats "Our comprehensive sourcing solutions leverage a vetted factory network." The short version trusts the reader.
- **Proof over claim.** "Over 30 years on the ground" + "fluent in Mandarin, French, Italian, Portuguese" + "active supplier relationships since 1994" — these are checkable. "World-class expertise" is not. Always prefer the checkable version.
- **Specifics over abstractions.** "Active supplier relationships across China, Vietnam, Thailand, and Taiwan since 1994" beats "Deep Asian sourcing expertise." Numbers, dates, places, names always beat abstractions.

---

## Structural discipline — match existing patterns

Every new page must match the site's established structural patterns. Do NOT invent new structures for each page.

### Product page structure (established by `/products/bathroom-hardware`)

1. Hero — full-bleed image OR typographic cover, with: eyebrow ("Product Category") → H1 display heading → supporting subtitle
2. Categories section — "What we source" intro, then 2x2 or 2x3 text grid of sub-categories with checkmark-bullet lists
3. Certifications section — dark ink background, 3-column grid of certification cards
4. Market context section (optional, category-specific) — lane or region framing
5. CTA bar — forest green bar with "Request a sourcing consultation" + CTA button

If the new page doesn't fit this structure, ask whether the content belongs elsewhere, not whether to invent a new pattern.

### Page copy structure rules

- **Eyebrow text** above H1s: tiny, tracking-widest, uppercase, forest green. Two to four words max.
- **H1 display headings**: Big Shoulders Bold, ALL CAPS, 2-3 words per line, break lines with `<br />` at natural breath points
- **Body copy**: Lowercase sentence-case, Georgia/serif for long-form text, max 2-3 sentences per paragraph
- **Lists**: 4-5 items per section, each item 1 line long, checkmark bullets in forest green

---

## The research-to-copy translation playbook

When Alex or anyone else shares internal research (ChatGPT-style bullet lists with pricing, tiers, strategic framing), NEVER paste it into a page directly. Translate it:

### Step 1 — Extract what's PUBLIC

From internal research, the only things that belong on the site:
- Product names and what they are (e.g., "oil filters," "brake pads")
- Market-demand rationale at a general level (e.g., "high-frequency replacement" — NOT "every 3-6 months across every vehicle" if that specificity reveals trading-cadence strategy)
- Compliance and certification requirements (these are genuinely public and build trust)
- Market-size statistics from citable sources (e.g., "Egyptian aftermarket valued at $1.6 billion in 2024") — always with attribution or a public source
- Geographic/lane positioning (e.g., "China → Egypt lane")

### Step 2 — Archive what's INTERNAL

The rest goes to an internal playbook file. Keep it in `Instructions & Skills/` with a name like `[lane]-playbook.md` or `[market]-entry-plan.md`. This includes:
- Tier/sequencing frameworks
- Margin and pricing structure
- Supplier identification
- Buyer segmentation and targeting criteria
- Tactical execution sequences (first container, second container, etc.)
- Commercial terms and payment preferences

### Step 3 — Rewrite to BUYER-FACING voice

Every sentence that survives Step 1 needs to be rewritten from trader-voice to buyer-voice.

| Trader voice (internal) | Buyer voice (public) |
|---|---|
| "Tier 1 — Fast-Moving Consumables" | "Consumables & Filters" |
| "Easiest product to build repeat orders around" | *cut entirely — internal strategy* |
| "Chinese brands widely accepted by workshops" | "Chinese brands hold significant share in the Egyptian aftermarket" |
| "Ideal first container filler product" | *cut entirely — internal strategy* |
| "Best suited for slightly more sophisticated buyers" | *cut — implies buyer hierarchy* |
| "Gross margin 65-75%" | *never publish* |
| "FOB $2-8, Egypt wholesale $8-28" | *never publish* |
| "Start with a mixed container to test the market" | *never publish — internal tactical advice* |

### Step 4 — Structural fit check

The final draft must fit the existing page structure (see above). If it doesn't, restructure the content, not the site.

---

## Audit checklist — before any page ships

Every new or revised page must pass this audit:

- [ ] Read the draft against `Branding/BRAND-GUIDELINES.md` — does it honor the three-color palette, two-typeface discipline, and the brand voice?
- [ ] Three-audit test — press release, pitch deck, competitor due-diligence — does every sentence pass?
- [ ] Never-publish list — grep for margin percentages, cost ranges, supplier names, tier language
- [ ] Brand voice filter — no clichés, no exclamation marks, no emojis, proof over claim, specifics over abstractions
- [ ] Structural match — does the page use the same section rhythm, typography, and color usage as existing pages?
- [ ] Mobile render — does the layout hold up at 390px?
- [ ] Trust implication — does any claim require a footnote, citation, or documented proof? If yes, include it or cut it
- [ ] Cross-check with existing pages — does any wording contradict what's on Flooring, Bathroom-Hardware, About, or Services?

Run through the list verbatim, not from memory.

---

## Common failure modes and how to avoid them

### Failure mode 1: "Paste the research"
Symptom: Someone shares internal research in a message. The reflexive move is to copy it into a page. The error: research is written for the writer's thinking, not the reader's decision.
Fix: Always run Steps 1-3 above. Never paste research directly.

### Failure mode 2: "Invent a new structure because this content is special"
Symptom: A new product category "needs" a different page structure than existing ones.
Fix: No. The structure is the brand. Force the content into the existing structure; cut what doesn't fit.

### Failure mode 3: "Claim without proof"
Symptom: "We're the leading buying office in Asia," "Our suppliers are the best," "We have unmatched expertise."
Fix: Every claim needs a proof point. If you can't substantiate it, cut it. Substituting a specific, checkable statement is almost always stronger: "Active supplier relationships since 1994" > "leading expertise."

### Failure mode 4: "Stock phrases to fill space"
Symptom: "Transparent pricing. No hidden markups. No middlemen." Three phrases saying almost the same thing to add length.
Fix: Pick the strongest one phrase. Cut the rest. Whitespace is a brand asset for Sovern House.

### Failure mode 5: "Internal jargon leakage"
Symptom: "Tier 1," "SKU," "MOQ," "our funnel," "first-touch," "closed-lost," "qualified lead."
Fix: Translate to buyer-facing language. See the voice filter table above.

---

## How to invoke this skill

When starting any content work, read this skill first. Then:

1. Before drafting: ask "what's the internal research here, and what's public-safe?" — extract only the public items
2. While drafting: run against the brand voice filter in real time
3. Before shipping: run the full audit checklist
4. After shipping: if the team raises any of the Common Failure Modes, log it to `lessons.md` and update this skill

---

## Relationship to other skills

- `trade-cmo.md` — sets marketing strategy; this skill executes it editorially
- `trade-cro.md` — sets conversion hypotheses; this skill ensures copy doesn't undermine them with weak language
- `trade-trust-architecture.md` (pending) — defines trust signals; this skill ensures copy supports rather than contradicts them
- `trade-attorney.md` — sets legal boundaries; this skill ensures copy doesn't overclaim in ways that create liability
- `sovern-email-writer.md` — similar editorial discipline for outbound email

**Conflict resolution:** If this skill's guidance conflicts with another skill's suggested copy, this skill wins for anything on the public site. The public site is the brand's most permanent and most-visible artifact.
