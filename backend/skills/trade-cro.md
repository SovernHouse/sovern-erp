# CRO Reference: B2B International Trade Website

## Purpose

This document guides CRO decisions for an international trade company website (commodities, manufactured goods, services, consulting). It covers conversion mechanics specific to B2B/B2G buying processes, international audiences, and high-touch sales environments. Use this as a reference to audit pages, propose tests, and challenge assumptions.

---

## CRO Mindset for B2B International Trade

### What's Different from B2C

- **Longer buying cycles**: 69 days is typical. Visitors aren't ready to "buy" on first visit; they're gathering intelligence across multiple sessions, teams, and channels.
- **Multiple stakeholders**: A procurement manager, technical spec reviewer, CFO, and compliance officer may visit separately. Each needs different information.
- **High transaction values**: A mispriced page or unclear term triggers deal loss or renegotiation. Precision matters more than persuasion.
- **Compliance-first trust**: International buyers fear tariff miscalculations, sanctions list hits, and document gaps. Trust signals must address regulatory competence, not just testimonials.
- **Account-level optimization**: Track engagement at the company level (IP, domain, repeat visitors), not individual clicks. One contact may visit product pages; another reviews certifications; a third downloads compliance docs. All are signals the account is engaged.

### The CRO Question

For every page element, ask:
- **Does this build credibility with international buyers?** (certifications, client logos, regulatory compliance statements)
- **Does this reduce friction in the decision process?** (clear spec tables, currency display, accessible RFQ flows)
- **Does this serve the right stakeholder at the right moment?** (technical specs for engineers; pricing frameworks for procurement; compliance docs for legal)
- **Would removing this increase conversions?** (clutter kills B2B conversion; simplicity wins)

---

## Page Hierarchy: What Visitors Need to See & In What Order

### Above-the-Fold Priority (First Screen)

The first screen must answer three questions in order, using the **Clarity-Credibility-Momentum (CCM)** framework:

#### 1. Clarity: "Am I in the right place?"
- **Positioning statement** (below nav, above all else): "We do [service/products] for [buyer archetype]."
  - Example: "We source certified commodities and manufactured goods for tier-1 industrial importers globally."
  - Must be specific to the trade industry; generic "We're your trusted partner" fails.
- **Sub-headline** (supporting clarity): One sentence explaining the main problem you solve.
  - Example: "Navigate tariffs, certifications, and logistics with a single supplier."

#### 2. Credibility: "Should I believe you?"
- **Logo bar** (recognizable clients/partners with permission)
  - Position: below clarity statement, still above fold if space allows
  - Shows account-level proof (the companies that trust you)
- **Single, highest-impact certification or award**
  - ISO, trade compliance badge, or regulatory approval
  - NOT a wall of logos; one credible signal beats five weak ones
- **Callout stat** (if genuinely strong): "X years serving Y countries" or "Z certifications held"
  - Must be verifiable; weak claims destroy trust

#### 3. Momentum: "What's the next small step?"
- **Primary CTA** (upper right quad converts 17% better than center for B2B)
  - Copy: action-driven, time-bound, or benefit-specific
    - ✓ "Request a Quote" (clear intent)
    - ✓ "Explore Our Catalog" (low-friction entry)
    - ✗ "Submit" (passive, meaningless)
    - ✗ "Learn More" (too vague; used by 90% of B2B sites, converts worst)
  - Button: high contrast, prominent but not aggressive
  - Proximity: adjacent to the value prop, within 50px

#### Visual Hierarchy Enforcement
- Headline: largest, darkest, most prominent
- Sub-headline: 60% headline size
- Credibility signals: mid-weight, visually subordinate
- CTA button: highest color contrast, strategically placed (not center)
- Supporting copy: 80% of headline size, light gray or secondary color

### Above-the-Fold Checklist
- [ ] Positioning statement (specific to your business, not generic)
- [ ] Logo bar (3–5 recognizable clients, if available; remove if none credible)
- [ ] One primary trust signal (single cert, award, or compliance badge)
- [ ] Primary CTA with benefit-driven copy
- [ ] All four elements fit in viewport without scrolling (test at 1024×768 and mobile)
- [ ] No video auto-play, pop-ups, or live chat auto-engage (kills conversion)

---

## What Kills Conversion on Trade Websites

### High-Impact Conversion Killers (Fix Immediately)

1. **Unclear value proposition or positioning**
   - "Solutions for industry" doesn't work; international buyers need specificity
   - Fix: Replace generic claims with specific service/product + buyer archetype
   
2. **Missing compliance or certification signals**
   - Buyers assume you're unvetted if no credentials are visible
   - Fix: Add ISO, export compliance, or relevant trade certifications prominently
   
3. **Slow page load (>3 seconds)**
   - 50%+ of mobile users abandon sites loading >3s
   - Sites loading in 1s convert 3x higher than 5s sites
   - Fix: Run Lighthouse audit, prioritize image optimization and CDN caching
   
4. **Forms longer than necessary**
   - Each additional form field drops B2B conversion by 7%
   - 4-field forms convert 50% worse than 3-field forms
   - Fix: Reduce to Name + Email + Company for top-of-funnel; add fields only at demo/quote stage
   
5. **Confusing currency or pricing**
   - International buyers don't convert without seeing prices in their currency
   - Dynamic currency conversion increases conversion 40%+
   - Fix: Display both local and base currency, or implement DCC system
   
6. **Mobile-unfriendly layout**
   - Desktop converts 2–3x higher than mobile; mobile often <2% conversion
   - But 84% of industrial buyers start research on mobile
   - Fix: Ruthless mobile-first testing; ensure CTAs are thumb-accessible (lower right)
   
7. **Missing or broken product specifications**
   - Industrial buyers need datasheets, tolerances, certifications per product
   - "Contact sales" for every spec kills self-serve research
   - Fix: Build spec templates; link datasheets; make technical info scannable
   
8. **Generic "Contact Us" as sole CTA**
   - Doesn't signal what will happen next (response time, information needed, etc.)
   - Fix: Replace with "Request a Quote (24hr response)" or "Schedule a Product Demo"
   
9. **No visible response time commitment**
   - International buyers fear dead leads or slow follow-up
   - Fix: Display "We respond within 2 business hours" or offer live chat with timezone info
   
10. **Blocking content behind forms too early**
    - Datasheets, spec sheets, and compliance docs must be freely accessible
    - Fix: Offer downloads without gate, or gate only the advanced/custom content

### Medium-Impact Killers (Address in Next 2–4 Weeks)

- Typos, currency mismatches, or stale product listings (damages credibility in international context)
- Testimonials from unknown companies or without specific metrics (weak social proof)
- Abandoned shopping carts or RFQ flows (no recovery email sequence)
- Missing language selector or RTL support (if serving MENA, Asia markets)
- Broken links to compliance docs, certificates, or datasheets
- Contact form without a privacy policy link or explanation of data use

---

## Trust Signals Ranked by Impact

### Tier 1: Highest Conversion Impact (40–60% lift potential)

1. **Industry certifications** (ISO 9001, ISO 45001, export compliance, sanctions screening)
   - Placement: Above the fold or adjacent to CTAs
   - Format: Icon + short label ("ISO 9001 Certified" + logo)
   - Why: International buyers assume regulatory risk; certifications prove competence
   
2. **Recognizable client logos** (3–5, with permission)
   - Placement: Above fold, center-aligned or left-justified
   - Format: Grayscale, 60–80px height, with statement "Trusted by 200+ importers globally"
   - Why: Account-level proof; social proof from known companies > unknown testimonials
   - Caution: Remove logos if clients are unwilling or deal confidential
   
3. **Specific client testimonial with metrics**
   - Format: Name, Title, Company, Quote with measurable outcome
   - Example: "Cut landed costs 12% and reduced delivery time by 3 weeks. — Maria Rodriguez, Procurement Director, TechImports Inc."
   - Placement: Near CTAs, product pages, or case study sections
   - Why: Specificity and metrics beat vague praise
   
4. **Response time guarantee**
   - Placement: Near contact form or RFQ form
   - Format: "We respond within 24 business hours" or "Live chat: Mon–Fri, 8am–6pm CET"
   - Why: Reduces fear of abandoned leads; signals operational competence

### Tier 2: Medium Impact (20–40% lift potential)

5. **Compliance statement or trade documentation capability**
   - Placement: Footer or "Compliance" page
   - Format: List key docs your company prepares (bills of lading, certificates of origin, commercial invoices, etc.)
   - Example: "We manage all INCOTERMS documentation and customs clearance support."
   - Why: Differentiates from suppliers who only sell; signals full-service competence
   
6. **Video testimonial** (client site visit, unscripted)
   - Placement: Homepage hero or product page
   - Format: 30–60 sec, client speaking, authentic setting
   - Why: Emotional connection + authenticity
   
7. **Case study with process & outcome**
   - Placement: Dedicated section or linked from products
   - Format: Problem → Solution → Metrics (cost saved, time reduced, compliance achieved)
   - Why: Serves technical buyers who need proof the approach works
   
8. **Awards or industry recognition**
   - Placement: Footer or sidebar
   - Format: Single, most relevant award
   - Why: Third-party validation
   - Caution: Remove dated or irrelevant awards (damages credibility)

### Tier 3: Supporting Signals (5–20% lift potential)

9. **Team credentials** (executive profiles, certifications)
   - Placement: "About Us" page
   - Format: Name, Title, Key Credential (e.g., "20+ years in import compliance")
   - Why: Builds confidence in people managing deals
   
10. **Security/privacy badges** (GDPR compliance, SSL, data privacy statement)
    - Placement: Footer (required by law)
    - Format: Text link + logo
    - Why: Required legal signal; necessary but not a motivator for trade decisions
    
11. **Press mentions or media coverage**
    - Placement: Sidebar or "News" section (if recent)
    - Format: Publication name + headline (link to article)
    - Why: Third-party validation
    - Caution: Remove if >6 months old

### Signal Placement Rules

- **Logo bars**: Above-fold, if 3+ recognizable clients available; otherwise remove
- **Certifications**: Icon + text, visible on every major page (homepage, product pages, about, contact)
- **Testimonials**: Position near CTAs and pricing; avoid clustered in one section
- **Response time**: Visible wherever a visitor might decide to contact (form, footer, chat)
- **Case studies**: Linked from product pages and offered as lead-gate content (email gate only)
- **Compliance statement**: Footer + dedicated compliance page

---

## RFQ/Inquiry Funnel Optimization

### What an RFQ Does

An RFQ (Request for Quote) is the B2B/international trade equivalent of "Add to Cart." It:
- Captures structured product/service inquiry with buyer specs
- Triggers a quote generation and sales follow-up
- Allows buyers to specify quantities, countries, timelines, terms
- May include custom terms, certifications, or compliance requirements

Baseline RFQ conversion rate: **1–2%** (low bar for entire site; targeted RFQ pages can hit 30%+)

### RFQ Form Field Strategy

#### Minimal Form (Top of Funnel, Product Browse)
**Goal**: Capture bare minimum to initiate contact; minimize abandonment

Fields (in order):
1. Email address (required)
2. Company name (required)
3. Product/service of interest (dropdown or autocomplete)

Conversion expectation: 15–25%

Why this works: Low cognitive load; visitor can complete in <20 seconds; no company verification required yet

#### Standard Form (Dedicated RFQ Page)
**Goal**: Gather enough info for sales to prepare a meaningful quote

Fields (in order):
1. First + Last Name (required)
2. Email (required)
3. Company Name (required)
4. Job Title (optional but recommended; signals decision-maker)
5. Country (required; critical for trade/tariff/Incoterms)
6. Product(s) of interest (dropdown, multi-select)
7. Quantity or volume (required if product-specific; e.g., "containers," "units," "MT")
8. Timeline (when needed? required)
9. Special requirements or notes (optional text area; e.g., certifications, Incoterms preference)

Conversion expectation: 8–12%

Why: Balances data quality (sales can quote accurately) with friction (enough fields to feel real, not so many that visitors bounce)

#### Gatekeeping: Build Qualification into the Form
- After email + company + country, use conditional logic: if country is on sanctions list or high-risk, trigger a compliance screen ("We verify all buyers for trade compliance. This may take 24–48 hours.")
- Separate "commercial" from "technical" inquiry paths (e.g., commodities ask for volume; manufacturing goods ask for spec sheet upload)

### RFQ Flow Optimization: Button Copy & CTAs

**Current CTA (Weak)**:
- "Submit" → 1–2% conversion
- "Click Here" → converts 5–12% higher (but unprofessional tone)
- "Next" → ambiguous; doesn't signal commitment

**Optimized CTA (Recommended)**:
- "Request a Quote"
- "Get a Custom Quote (24hr Response)"
- "Start Your Inquiry"
- "Tell Us Your Requirements"

Test: "Get a Quote" vs. "Request Custom Pricing" — benefit-driven versions outconvert neutral ones by 15–25%

### Post-Submission: The RFQ Thank-You Page

**Standard (Weak)**:
- Generic "Thank you! We'll be in touch soon."
- No next steps, no estimated timeline

**Optimized (Recommended)**:
- Confirmation message: "Your quote request received. We respond within [24 hours / 2 business days]."
- Estimated next step: "A sales specialist will prepare a detailed quote and contact you by email."
- Secondary CTA: "While you wait, explore our [product catalog / compliance documentation / case studies]." (re-engagement; lowers bounce)
- Live chat option: "Have questions? Chat with a specialist now" (if available)
- Calendar link: "Prefer to schedule? Book a time here." (high-intent visitors)
- Expected items: "Your quote will include: Pricing in your currency, delivery Incoterms, compliance certifications, and lead times."

This turn-around page typically re-engages 10–15% of visitors who otherwise would leave.

### RFQ Mobile Optimization

Mobile users account for 84% of industrial research starts but convert at 1.8% vs. 3.9% on desktop.

Fixes:
- Form fields must be large (min 44px touch targets)
- Avoid multi-select dropdowns (use radio buttons or checkboxes)
- Single-column layout; no side-by-side fields
- Sticky CTA button (bottom of screen, thumb-accessible)
- Progress indicator: "Step 1 of 3" (reduces perceived friction)
- Allow email/auto-fill to pre-populate

### RFQ Abandonment Recovery

**In-form abandonment** (visitor starts form, doesn't submit):
- Capture email + product of interest for 74% of form visitors who drop off
- Send email: "We noticed you started a quote request. Would you like us to send you a quick quote template or connect with a specialist?"

**Post-abandon follow-up** (visitor left site):
- Email 1 (4 hours): "Your quote is ready — here's what we can deliver" + calendar link
- Email 2 (48 hours): "Questions about pricing or Incoterms?" + FAQ link + live chat option
- Email 3 (7 days): "Still interested? Here's what other importers are ordering this month" + top products

---

## Product Page Conversion Elements

### Product Page Structure (Ranked by Conversion Impact)

#### 1. Product Name + Clarity Headline
- Headline: Product name + key differentiator
  - ✓ "Certified Coffee Beans — Fair-Trade & Rainforest Alliance Certified"
  - ✗ "Coffee Beans"
- Subheading: One-sentence buyer benefit
  - Example: "Sourced from 12 countries; direct-to-importer pricing; USDA-certified organic available"

#### 2. Primary Product Image + Gallery
- Large hero image (high resolution, product in context, not just isolated)
- Gallery: 4–6 views (side view, detail close-up, in-use context, certification mark, packaging)
- Mobile: Swipeable gallery, large tap targets
- Caution: Avoid auto-play video; let user control

#### 3. Proof of Compliance & Certification (Above pricing)
- Icons + list: "ISO 9001 Certified | FDA Approved | USDA Organic | GMP Compliant"
- Format: Small icons (20–30px) + text label
- Link to: Full certificate or compliance statement (downloadable)

#### 4. Product Specifications (Scannable Table)
- Format: Two-column table (Spec Name | Value)
  - Example: "Product Origin | Vietnam | Certification | Rainforest Alliance | Shelf Life | 18 months"
- Critical specs: Sourcing country, certifications, lead time, minimum order quantity (MOQ)
- Optional: PDF datasheet link
- Mobile: Convert table to stacked cards or collapse/expand sections

#### 5. Pricing (Transparent, Multi-Currency)
- Display: Base price + currency (e.g., USD)
- Add: "Price in your currency: [GBP, EUR, JPY, etc.]" with toggle
- Volume tiers: "1–10 units: $X | 11–50: $Y | 50+: Custom quote"
- Caveat: "Pricing subject to current tariff rates" (if applicable)
- Shipping: "FOB [Port] | CIF [Destination Port] — inquire for custom Incoterms"

#### 6. Lead Time / Availability
- Clear statement: "In stock | Ships within 2 weeks | Custom: 6–8 weeks"
- Link to: "Shipping & Incoterms FAQ"

#### 7. Social Proof (Client Testimonial or Use Case)
- Format: Quote + company name + industry
  - Example: "Reduced our sourcing time by 40% and improved compliance confidence. — Procurement Manager, Global Goods Inc."
- Placement: Below specifications, above CTA

#### 8. Primary CTA (Request Quote or Add to Cart)
- Copy: "Request a Quote" or "Get Custom Pricing" (not "Add to Cart" unless e-commerce enabled)
- Button: High contrast, 44px+ height on mobile
- Proximity: Sticky position (stays visible while scrolling) on mobile; fixed position on desktop

#### 9. FAQ / Hidden Content (Expand Sections)
- Collapsible Q&A below CTA
  - "What certifications are included?"
  - "Can you customize specifications?"
  - "What are typical lead times to [Country X]?"
  - "Do you provide compliance documentation?"
  - "How do payment terms work?"

#### 10. Related Products (Below Fold)
- 3–4 product cards (title, image, price, CTA)
- Link to: Product category or "View Similar Items"

### Product Page Mobile Checklist
- [ ] Specifications table is readable (not squeezed into columns)
- [ ] All certifications visible above fold on mobile
- [ ] Pricing displays in local currency (tested for 3+ countries)
- [ ] CTA button is sticky and thumb-accessible (lower right, 44px+)
- [ ] Form pop-ups don't auto-trigger (or trigger after 50% scroll)
- [ ] Page loads in <3 seconds (run Lighthouse audit)

---

## A/B Testing Backlog (Prioritized by Expected Impact)

### High-Priority Tests (Run First; 2–4 weeks each)

#### Test 1: Above-the-Fold Clarity Statement
**Current State**: Generic positioning ("We're your trusted trade partner")
**Hypothesis**: Specific positioning increases homepage conversion 15–20%
**Variant A (Control)**: Current positioning
**Variant B**: Trade-specific claim ("We source certified commodities & manufactured goods for tier-1 importers; manage tariffs, compliance, and logistics end-to-end")
**Metric**: Homepage → RFQ form submission rate
**Sample Size**: 1,000 visitors/variant (minimum)
**Duration**: 2 weeks
**Decision Rule**: Variant B wins if +10% uplift, p<0.05

#### Test 2: RFQ Form Fields (Friction Reduction)
**Current State**: 8-field RFQ form (Name, Email, Company, Title, Country, Product, Quantity, Notes)
**Hypothesis**: Reducing to 4 fields increases RFQ submission 30–40%
**Variant A (Control)**: Full 8-field form
**Variant B**: Minimal 4-field form (Email, Company, Product, Quantity)
**Variant C**: Progressive form (Email + Company → Product & Quantity → detailed requirements)
**Metric**: RFQ form completion rate (% who submit after starting)
**Sample Size**: 500 completers/variant
**Duration**: 3 weeks
**Decision Rule**: Implement lowest-friction variant with >20% uplift

#### Test 3: RFQ Button Copy
**Current State**: "Submit Quote Request"
**Hypothesis**: Benefit-driven button copy increases submissions 15–25%
**Variant A (Control)**: "Submit Quote Request"
**Variant B**: "Get Custom Pricing in 24 Hours"
**Variant C**: "Request a Quote"
**Metric**: Button clicks / page visitors (CTR)
**Sample Size**: 2,000 visitors/variant
**Duration**: 2 weeks
**Decision Rule**: Run both B and C; pick winner (likely B or C)

#### Test 4: Product Page CTA Placement (Sticky vs. Scroll)
**Current State**: Single CTA button at end of spec table
**Hypothesis**: Sticky CTA button (visible while scrolling) increases quote requests 20–30%
**Variant A (Control)**: Standard button below specs
**Variant B**: Sticky button (bottom-right, mobile; upper-right, desktop)
**Metric**: Quote request click rate (per page visitor)
**Sample Size**: 1,500 visitors/variant
**Duration**: 2 weeks
**Decision Rule**: Implement B if +15% uplift

#### Test 5: Trust Signal Prominence (Certifications Above Fold)
**Current State**: Certifications listed in footer
**Hypothesis**: Moving certifications to above-fold increases form completion 10–15%
**Variant A (Control)**: Footer certifications only
**Variant B**: Certifications above fold (next to CTA)
**Metric**: Form submission rate (on all forms)
**Sample Size**: 2,000 form attempts/variant
**Duration**: 2 weeks
**Decision Rule**: Implement B if +8% uplift

### Medium-Priority Tests (Run Next; 3–4 weeks each)

#### Test 6: Currency Display (Dynamic vs. Static)
**Current State**: USD only
**Hypothesis**: Displaying prices in visitor's local currency increases product page engagement & quote requests 20%+
**Variant A (Control)**: USD only
**Variant B**: USD + auto-detected local currency (GBP, EUR, JPY, etc.)
**Metric**: Time on product page, scroll depth, quote request rate
**Sample Size**: 1,000 unique visitors/variant (non-US, non-UK-dominant)
**Duration**: 3 weeks
**Notes**: Requires currency detection + conversion API

#### Test 7: Form Auto-Fill via LinkedIn
**Current State**: Manual form entry
**Hypothesis**: LinkedIn sign-in auto-fills form; increases RFQ submission 10–15%
**Variant A (Control)**: Manual entry
**Variant B**: "Sign in with LinkedIn" option + auto-fill name, company, title, email
**Metric**: Form completion time, submission rate
**Sample Size**: 1,000 form starts/variant
**Duration**: 2 weeks

#### Test 8: Product Specification Layout (Scannable vs. Descriptive)
**Current State**: Text-heavy spec descriptions
**Hypothesis**: Scannable spec table (icon + value) increases comprehension & quote requests 15%
**Variant A (Control)**: Current descriptive format
**Variant B**: Icon + spec name + value (table format)
**Metric**: Scroll depth (do spec sections get read?), quote request rate
**Sample Size**: 1,000 visitors/variant
**Duration**: 2 weeks

#### Test 9: RFQ Thank-You Page Engagement
**Current State**: Generic thank you + wait for email
**Hypothesis**: Offering related products & re-engagement CTA on thank-you page increases follow-up engagement
**Variant A (Control)**: Current thank you + empty state
**Variant B**: Thank you + "While you wait" carousel (related products) + calendar booking link
**Metric**: Click-through rate on thank-you page, follow-up email open rate
**Sample Size**: 500 RFQ submissions/variant
**Duration**: 2 weeks

#### Test 10: Testimonial Format (Metric-Driven vs. Vague)
**Current State**: Generic testimonial ("Great supplier!")
**Hypothesis**: Metric-specific testimonials increase credibility & quote requests 10%
**Variant A (Control)**: Vague testimonial
**Variant B**: Metric testimonial ("Reduced costs 15%, cut lead time 3 weeks — TechImports Inc.")
**Metric**: Quote request rate (near testimonial location)
**Sample Size**: 1,000 visitors/variant
**Duration**: 2 weeks

### Lower-Priority Tests (Run When High/Medium Done; 2 weeks each)

#### Test 11: Page Speed Impact (Measure; Don't Test)
- Segment users by page load speed (<1s, 1–3s, 3–5s, >5s)
- Metric: Conversion rate by speed bucket
- Expected: 1-second pages convert ~3x better than 5-second pages
- Action: Optimize to <2 seconds; measure conversion lift

#### Test 12: Mobile-Specific CTA Position (Bottom Sticky vs. Floating)
- Variant A: Bottom sticky button (always visible)
- Variant B: Floating button (lower-right corner)
- Metric: Mobile form submission rate
- Expected: ~5–10% difference

#### Test 13: Compliance Guarantee Copy
- Variant A: "ISO 9001 Certified"
- Variant B: "ISO 9001 Certified + Full Trade Compliance Verified"
- Metric: Form submission rate
- Expected: ~5% uplift

---

## International UX Considerations

### Language & Content Localization

#### Language Selector Design
- **Placement**: Top-right corner (desktop) or hamburger menu (mobile)
- **Format**: Language name in native script
  - ✓ "Deutsch" (not "German")
  - ✓ "中文" (not "Chinese")
  - ✓ "Español" (not "Spanish")
- **Flag icons**: Optional but use only if accurate (avoid ambiguity; e.g., US flag for English)
- **Current language indicator**: Bold or highlighted
- **Number of languages**: Start with 3–5; add only if you can maintain translation quality

#### Translation Standards
- **Depth**: Translate key pages (homepage, product catalog, RFQ form, compliance info) before secondary pages
- **Currency precision**: If translating to Euro, display EUR, not generic €
- **Incoterms**: Translate or provide side-by-side explanation (e.g., "FOB Shanghai (Free on Board)")
- **Legal/compliance docs**: Must be officially translated; never rely on machine translation
- **Avoid cultural missteps**: Red = luck in some cultures, mourning in others; research color use per market

#### Regional Content Variations
- Display import/tariff considerations specific to visitor country
  - Example (for UK visitor): "BREXIT NOTE: See our tariff mapping tool for updated duties."
- Adjust lead time estimates per region (e.g., "Ships to EU: 2–3 weeks | Ships to Asia: 4–6 weeks")
- Highlight certifications relevant to region (e.g., CE marking for EU visitors)

### Multi-Currency Implementation

#### Display Strategy
- **Always show local currency**: Dynamic currency conversion increases conversion 40%+
- **Dual display**: Base currency (USD) + local currency
  - Example: "$100 USD (€92 EUR as of today)"
  - Or: "£85 GBP | View in USD ($108)"
- **Transparency**: Explain exchange rate source and update frequency ("Updated hourly via [provider]")

#### Technical Implementation
- **Currency API**: Stripe, OpenExchange, or Wise for real-time rates
- **Geo-detection**: Detect visitor country via IP; default to local currency but allow manual override
- **Cart/Quote**: Maintain currency consistency (don't mix currencies in single transaction)
- **Payment**: Accept payments in local currency; settle in your base currency

#### Pricing Transparency
- Display total landed cost where possible (product + tariff estimate + shipping)
  - Not always feasible for international trade, but build if you have tariff data
- Link to "Pricing FAQ" explaining additional costs (duties, customs clearance, handling)

### Timezone & Timing Considerations

#### Response Time Commitment
- Display response window in **visitor's timezone** (not your company timezone)
  - Example: Visitor in Tokyo; you're in GMT. Show: "We respond within 24 hours (by 9am Japan Time)"
  - Use geo-detection + timezone library (e.g., moment-timezone.js)
- Avoid: "We respond within 24 business hours" without timezone clarity (ambiguous for international)

#### Business Hours Transparency
- If offering live chat: "Live chat available Mon–Fri, 8am–6pm CET" (state your timezone explicitly)
- Add clock showing current time in your timezone
- Set expectations: "Inquiries received outside business hours will be addressed within [X] hours of business day start"

### Cultural Design Considerations

#### Visual Design Preferences
- **Color**: Research cultural meanings (red, white, black vary significantly across regions)
  - Generally safe: Blue (trust), green (growth, environment), orange (energy)
  - Avoid: White = mourning in some Asian cultures; red = stop/risk in Western contexts
- **Imagery**: Use diverse, representative photography; avoid stereotypes
  - Show actual client offices/people (if possible with permission) from multiple countries
  - Avoid: Stock photos of "international business" that all look the same (handshake, globe, etc.)
- **Typography**: Test readability in non-Latin scripts; ensure Web fonts support extended character sets
  - Use Google Fonts or similar for multi-language support
- **Icons**: Test icons in multiple cultures (e.g., mailbox design varies; use text labels)

#### Communication Style
- **Formality**: B2B/international trade requires formal tone; avoid casual slang or colloquialisms
  - ✓ "Request a quotation" (formal, international)
  - ✗ "Snag a quote" (casual, English-centric)
- **Abbreviations**: Spell out "Certificate of Origin" before using "CoO"; avoid industry jargon without explanation
- **Dates & numbers**: Always use ISO format (YYYY-MM-DD) for dates; use periods (not commas) for thousands in EU
  - Example: 1.234.567,89 (EU format for 1,234,567.89 USD)

### Mobile-First for International Audiences

#### Why Critical
- 92% of internet users in emerging markets access via mobile-only
- Industrial buyers in Asia, Africa, LATAM often start research on mobile

#### Mobile-Specific Optimizations
- Page load <3 seconds on 4G (test in Chrome DevTools throttling)
- Responsive images: Serve smaller files to mobile; 2x assets for Retina
- Touch targets: 44px minimum for all interactive elements (form fields, buttons, links)
- Form design: Single-column, large input fields, avoid dependent dropdowns
- Sticky CTA: Keep quote/contact button visible while scrolling
- Avoid: Sliders, auto-playing video, complex filtering (test on actual mobile devices, not just desktop browsers)

---

## Items the CRO Blocks

As CRO specialist, **you have authority to flag and slow down** the following changes until conversion impact is assessed:

### Blocked Without A/B Test

1. **Form field additions** — Any new field on RFQ/inquiry form must be A/B tested first
   - Exception: Required legal/compliance field (e.g., "Confirm you're not on sanctions list")
   - Test protocol: Compare completion rates; revert if >5% drop

2. **CTA button changes** (copy, color, placement, size)
   - Must test for 2 weeks before full rollout
   - Even "obvious" improvements (e.g., changing "Submit" to "Request Quote") need data
   - Color changes especially: test on different screens/lighting

3. **Navigation restructuring** — Menu changes, category reorganization, taxonomy shifts
   - Blocks: Redirects, 404s, lost product discoverability
   - Test: Internal user behavior, SEO impact, completion rates
   - Timing: Stagger changes; don't move multiple product categories at once

4. **Pricing display changes** (currency format, tier visibility, hiding prices)
   - High impact on conversion; must have baseline before change
   - A/B test for 3 weeks minimum (large sample size needed for confidence)

5. **Removing trust signals or certifications** (even if they're "outdated")
   - Test variant with signal removed for 2 weeks
   - Expect 5–15% drop; measure before deciding

6. **Pop-ups or modal overlays** (email capture, offer, notification)
   - Pop-ups can kill conversion; must test placement, timing, copy
   - Best practice: Trigger after 50% scroll, allow easy close, don't auto-trigger
   - Never auto-trigger on page load

7. **Changing product image or spec layout** — Even minor reordering can affect scannability
   - Test reorder of specs (most important first vs. alphabetical vs. current)
   - Test image gallery changes

### Flagged (Requires Business Case & CRO Review Before Approval)

8. **New product launches** — Impact homepage real estate; must have promotion strategy tested
9. **Discount or promotional campaigns** — Test baseline before & after; measure cannibalization
10. **Seasonal or regional pricing changes** — Currency updates, tariff adjustments; test transparency
11. **New integrations** (payment, shipping, currency conversion) — Test for conversion impact post-launch
12. **Removing products from catalog** — Measure if visitors search for it; consider 301 redirects first
13. **Changing response time guarantee** (e.g., "24 hours" → "48 hours") — Test for form abandonment impact

### Always Escalate to Alex (CEO) Before Proceeding

- Any change affecting pricing, payment terms, or Incoterms language
- Changes to compliance or certification claims (legal/regulatory risk)
- Removing or downplaying trade/regulatory trust signals
- Major messaging or brand positioning shifts
- Changes to privacy policy or data collection (GDPR impact)
- Changes to international shipping or delivery claims

---

## Key Metrics & Benchmarks

### Core Conversion Metrics

| Metric | B2B Benchmark | Trade/Industrial Typical | Target (Alex's Site) |
|---|---|---|---|
| **Homepage → RFQ Click** | 2–5% | 1–3% | *TBD after baseline* |
| **RFQ Form Completion** | 8–15% | 5–10% | *TBD after baseline* |
| **Product Page → Quote Request** | 2–5% | 1–4% | *TBD after baseline* |
| **Landing Page Conversion** | 5–15% | 3–8% | *TBD after baseline* |
| **Overall Website Conversion** | 2–3% | 1–2% | *TBD after baseline* |

### Supplementary Metrics (Track in GA4/analytics)

| Metric | Purpose | International Context |
|---|---|---|
| **Scroll Depth** | Do visitors read specs, testimonials, compliance info? | Test per language/region; may vary |
| **Time on Page** | Are visitors engaging or bouncing? | Expect longer dwell on product pages (specs review) |
| **Form Start Rate** | % visitors who click into RFQ form (don't necessarily submit) | Indicates interest; measure by traffic source |
| **Form Abandonment Rate** | % who start form but don't submit | Each abandoned field should be analyzed |
| **Mobile vs. Desktop Conversion** | Performance gap indicator | Typically 2–3x gap; track as priority |
| **Bounce Rate by Landing Page** | Which pages are resonating? | >60% is poor; <40% is strong for B2B |
| **Session Duration** | Are visitors exploring or leaving immediately? | >3 min typical for product-research behavior |
| **Return Visitor Rate** | Account-level engagement tracking | Track IP/domain; expect 20–40% returning visitors in 30 days |
| **Traffic Source Performance** | Which channels convert best? | Organic typically outconverts paid in B2B |
| **Geographic Conversion Variance** | Do conversion rates differ by region? | Critical for international site; test USD vs. multi-currency per region |

### KPI Benchmarks (2025–2026)

- **B2B website conversion (all traffic)**: 1.8–2.3% (median); top 25% hit 4.3%+
- **RFQ/form submission (dedicated page)**: 8–12% (if optimized); baseline often 1–2%
- **Mobile conversion**: 1.6–2.9% (significant gap to desktop's 4.8–5%)
- **Landing page conversion**: 5–15% (with specific offer; homepage typically 2–3%)
- **Sales cycle length**: 69 days average (track from first visit to closed deal)
- **Customer acquisition cost (CAC)**: $500–$2,000 per client (varies by deal size)
- **Page load time target**: <2 seconds (industry average still >3 sec, especially mobile)
- **Form field optimal count**: 3–4 for top-of-funnel; 6–8 for dedicated RFQ

### How to Establish Alex's Baseline

Before any optimization, measure:

1. **Current conversion rate** (all traffic → RFQ/contact submission)
   - Goal: Know your starting point; even 1% baseline is useful
   
2. **Conversion by traffic source** (organic, direct, referral, paid)
   - Organic often converts better in B2B; paid may be lower
   
3. **Conversion by device** (mobile vs. desktop)
   - Expect 2–3x gap; this is your biggest optimization opportunity
   
4. **Conversion by landing page** (homepage, product pages, landing page, FAQ, etc.)
   - Identify which pages work, which don't
   
5. **Form abandonment rate** (by field)
   - Identify which field(s) cause drop-off
   
6. **Geographic conversion variance** (if data available)
   - Does US convert different than EU? Asia? Emerging markets?

---

## Appendix: Data Sources & Benchmarks

All benchmarks cited in this document are sourced from 2025–2026 industry research:

### References
- B2B Conversion Rate Statistics: [Unbounce 2025](https://unbounce.com/conversion-rate-optimization/b2b-conversion-rates/), [Directive 2026](https://directiveconsulting.com/blog/blog-b2b-conversion-rate-optimization-guide/), [First Page Sage 2025](https://firstpagesage.com/seo-blog/b2b-conversion-rate-optimization-cro-best-practices-for-2025/)
- Trust Signals & Certification Impact: [Trajectory Web Design](https://www.trajectorywebdesign.com/blog/b2b-website-trust-signals), [ProVisors 2025](https://www.provisorsthoughtleadership.com/2025/05/7-trust-signals-to-boost-b2b-conversions/)
- RFQ Optimization & Form Field Benchmarks: [Unbounce, Brixon Group](https://brixongroup.com/en/lead-forms-in-b2b-the-perfect-balancing-act-between-data-depth-and-conversion-rate), [LeadSquared](https://www.leadsquared.com/learn/marketing/lead-capture-forms-best-practices/)
- Mobile Conversion Gap & Performance: [Landbase 2026](https://www.landbase.com/blog/conversion-rate-statistics), [Ruby Roid Labs 2026](https://rubyroidlabs.com/blog/2026/03/mobile-optimization-b2b-websites/)
- Landing Page & Above-the-Fold Best Practices: [Windmill Strategy](https://www.windmillstrategy.com/the-web-design-fold/), [Omniconvert](https://www.omniconvert.com/blog/above-the-fold-design/), [HD Copywriting](https://hdcopywriting.com/news/above-the-fold-messaging-b2b-framework-clarity-credibility-momentum/)
- International Localization & UX: [UXPin](https://www.uxpin.com/studio/blog/ui-localization/), [Phrase](https://phrase.com/blog/posts/how-to-create-good-ux-design-for-multiple-languages/), [NN/G](https://www.nngroup.com/articles/language-switching-ecommerce/), [Smashing Magazine](https://www.smashingmagazine.com/2022/05/designing-better-language-selector/)
- Currency Localization Impact: [Shopify Localization Guide](https://www.shopify.com/blog/website-localization)
- Product Page Optimization: [Catsy](https://catsy.com/blog/b2b-product-pages-shopify/), [Trajectory Web Design](https://www.trajectorywebdesign.com/blog/b2b-product-page-design), [Sellers Commerce](https://www.sellerscommerce.com/blog/b2b-ecommerce-product-catalog-management-best-practices/)
- A/B Testing for Manufacturers: [Thomas Net](https://blog.thomasnet.com/a-b-testing-examples-for-manufacturers-and-industrial-companies), [VWO](https://vwo.com/ab-testing/), [Data-Mania](https://www.data-mania.com/blog/10-ab-testing-tips-for-b2b-campaigns/)
- KPI & Metrics Benchmarks: [Shopify Enterprise B2B KPIs](https://www.shopify.com/enterprise/blog/b2b-ecommerce-kpis), [WebStacks](https://www.webstacks.com/blog/b2b-website-metrics), [Smart Insights 2025](https://www.smartinsights.com/ecommerce/ecommerce-analytics/ecommerce-conversion-rates/)

---

## Usage Notes

This document is a **reference guide** for the CRO specialist. Before making changes or recommendations:

1. **Read the standing instructions** in CLAUDE.md (risk assessment, team perspectives)
2. **Establish baselines** for all metrics (don't optimize blind)
3. **Run tests before rollout** (even "obvious" improvements need data in B2B)
4. **Measure account-level engagement**, not just clicks (international trade deals involve multiple stakeholders over weeks)
5. **Prioritize trust and compliance** over conversion volume (a 10% form increase with unqualified leads is worse than a 2% increase with qualified buyers)
6. **Challenge weak claims** — Generic positioning and vague testimonials hurt more than they help

The goal: **Sustainable, defensible conversion growth grounded in data and international trade best practices**, not vanity metrics.
