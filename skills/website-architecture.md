# Sovern House — Website Architecture Plan
**Domain:** sovernhouse.co  
**Version:** 1.1 — April 2026 (rebranded from New Route)  
**Status:** Draft for Review

---

## Executive Summary

sovernhouse.co is a credibility-first B2B website whose primary conversion action is an RFQ inquiry (Request for Quote). It is not a traditional e-commerce store and not a brochure site — it is a trust-building and lead-capture engine for a high-touch buying house service. The ERP system serves as the backend for all inquiry and order flows. Every page must answer one implicit buyer question: *"Can I trust these people to be my eyes and ears in Asia?"*

---

## Strategic Objectives (Ranked)

1. **Generate qualified RFQ leads** — procurement managers, small/mid importers, distributors, private label buyers in North America, Europe, Latin America
2. **Establish credibility** — 30-year Asia presence, native Mandarin, on-the-ground QC, transparent 5% commission model
3. **Differentiate from trading companies** — explicitly position as a buying house; remove buyer suspicion about hidden markups
4. **Serve as ERP proof-of-concept** — the live deployment of the ERP is a product asset; the site demonstrates it to prospective SaaS buyers
5. **SEO presence in target markets** — rank for sourcing-intent keywords across North America and Europe

---

## Site Architecture — Page Map

```
sovernhouse.co/
│
├── / (Homepage)
├── /about
├── /how-it-works
├── /services
│   ├── /services/sourcing
│   ├── /services/quality-control
│   ├── /services/private-label
│   └── /services/logistics
│
├── /products
│   ├── /products/flooring
│   ├── /products/garments-fabrics
│   ├── /products/bathroom-hardware
│   ├── /products/travel-accessories
│   └── /products/logs (Europe→China)
│
├── /client-portal (login gate → ERP Customer Portal)
├── /rfq (Request for Quote — core conversion page)
├── /contact
├── /blog (Phase 2 — SEO + thought leadership)
└── /legal
    ├── /legal/terms
    ├── /legal/privacy
    └── /legal/cookies
```

---

## Page-by-Page Content Plan

### 1. Homepage `/`

**Goal:** Qualify the visitor instantly, build trust, drive RFQ or exploration.  
**Primary CTA:** "Request a Quote" (upper-right nav + hero)  
**Secondary CTA:** "How It Works" (below hero fold)

#### Section Breakdown

**Hero (Above the Fold)**
- Headline: *"Your buying office in Asia."*
- Sub-headline: *"We source, inspect, negotiate, and ship — in Mandarin, on the ground, with 30 years of QC experience. Flat 5% sourcing fee. No hidden markups."*
- CTA button: **Request a Quote** (high-contrast, upper right of hero, not centred — data shows 17% better B2B conversion upper-right)
- Visual: Clean, professional — factory floor / container port / product quality inspection photo. Real photography when available, curated stock in the interim.
- Trust bar below hero: "30 Years in Asia · Native Mandarin & Taiwanese · Certified QC · Transparent 5% Fee"

**Buying House Positioning Block**
- 3-column or icon-grid: *"We work for you, not the factory"* / *"You see the factory price"* / *"We earn only if you benefit"*
- Short paragraph explaining buying house vs. trading company distinction — this directly disarms the biggest buyer objection

**Service Overview**
- 4 cards: Sourcing | Quality Control | Private Label | Logistics Coordination
- Each links to `/services/[service]`

**Product Categories**
- 2 primary cards (Flooring, Garments) + 3 secondary cards
- Flooring and Garments get hero images; others get icon treatment
- Links to `/products/[category]`

**The Sovern House Advantage (Trust Section)**
- 4 pillars with supporting evidence:
  - 30 Years on the Ground — *"Not a Western buyer who visits twice a year. We live here."*
  - Native Language Access — *"Negotiating directly in Mandarin and Taiwanese. No interpreter, no filtering."*
  - Built-in Quality Control — *"We catch problems before goods leave origin. Every shipment."*
  - Full-Service Partner — *"Sourcing to delivery. You have one contact, not five."*
- Each pillar should have a specific, verifiable proof point when possible

**RFQ Micro-Form (Mid-page Lead Capture)**
- Fields: Name, Company, Email, What are you looking to source?
- 4 fields maximum. Framed as: *"Tell us what you need. We'll respond within 24 hours."*
- Explicitly label it as non-binding; reduce friction

**How It Works (Preview)**
- 4-step visual: *Tell us what you need → We source and negotiate → QC and documentation → Delivered to your door*
- CTA: "See the full process →" → `/how-it-works`

**Client Portal Callout**
- Compact section: *"Already a client? Track your orders, review documents, and communicate directly through the client portal."*
- CTA: "Log In to Client Portal" → `/client-portal` (ERP Customer Portal)

**Footer**
- Logo + tagline
- Navigation links
- Contact: Taiwan address (<TAIWAN_ADDRESS>), phone (<TAIWAN_PHONE>), email (info@sovernhouse.co when ready, or existing)
- Fine print: "Sovern House is a brand of Sovern House International Exchange. Registered in Taiwan."
- Social: LinkedIn (primary), others if active
- Legal links: Terms, Privacy, Cookies

---

### 2. About `/about`

**Goal:** Tell Alex's story. This is the most powerful trust-building page on the site. Competitors cannot replicate it.

**Sections:**
- **Founder story** — 30 years in Asia, Canadian, native Mandarin + Taiwanese, started in flooring, built across categories. Written in first person or third person with a photo. Human, not corporate.
- **The buying house philosophy** — Why we operate this way. Working for the buyer, not the factory. Transparent pricing. Long-term relationships.
- **What we believe** — 3-4 commitments: quality is non-negotiable / transparency is the foundation / complexity is our problem, not yours / we're your team, not your vendor
- **Where we operate** — map or list: sourcing from China/Taiwan, selling to North America/Europe/Latin America
- **The company** — Legal entity (Sovern House International Exchange, Taiwan). Fine print displayed openly — not hidden.
- **CTA:** "Start a Conversation" → `/rfq`

**Do not:** Use stock photos of people. Use a real photo of Alex in the field, at a factory, or at his desk. This page converts when it's real.

---

### 3. How It Works `/how-it-works`

**Goal:** Reduce buyer anxiety by making the process completely legible. Many buyers have never used a sourcing agent.

**Sections:**
- **Step-by-step process** (5-7 steps with icons):
  1. You tell us what you need (product specs, quantities, budget, timeline)
  2. We source qualified factories in Mandarin — no Alibaba browsing
  3. We negotiate price and terms directly; you see the factory price
  4. We inspect production — pre-shipment QC to your standards
  5. We coordinate freight, documentation, and customs paperwork
  6. Your goods arrive. You track everything through the client portal.
- **What we handle** vs. **What you handle** — clear table/columns. Reduce ambiguity.
- **Pricing transparency** — "We earn a flat 5% sourcing commission on the FOB factory price. You see the factory price. Nothing is hidden." Explain variable rates briefly (smaller orders, private label).
- **FAQs** — 6-8 questions that real buyers ask:
  - *How long does sourcing take?*
  - *What if the goods don't meet spec?*
  - *Do you work with small orders?*
  - *What documents will I receive?*
  - *How do I pay the factory?*
  - *What if something goes wrong?*
- **CTA:** "Ready to start? Request a Quote" → `/rfq`

---

### 4. Services

#### 4a. Sourcing `/services/sourcing`
- How we find and vet suppliers (Mandarin-language sourcing, factory visits, relationship network vs. Alibaba)
- What a sourcing engagement looks like end-to-end
- Product categories we source
- CTA: Request a sourcing consultation

#### 4b. Quality Control `/services/quality-control`
- This deserves its own full page — 30-year QC expertise is a primary differentiator
- What our QC process includes: pre-production review, in-process inspection, pre-shipment inspection, container loading check
- What we inspect for: dimensions/specs, materials, workmanship, labelling, certifications, packing integrity
- Documentation we produce: inspection reports, defect photo records, pass/fail certificates
- Why this matters: cost of a rejected container vs. cost of QC
- Optional: QC as a standalone service (buyers who already have suppliers but want third-party inspection)
- CTA: "Add QC to your next order" / "Request a standalone inspection"

#### 4c. Private Label `/services/private-label`
- Product development from concept to finished branded product
- Sampling, tooling, packaging design coordination
- MOQ considerations, timeline, certification support
- Who this is for: retailers, brands, e-commerce sellers
- CTA: "Tell us about your product idea"

#### 4d. Logistics Coordination `/services/logistics`
- What we coordinate (not what we do directly — we are not a freight forwarder)
- Freight mode selection (FCL, LCL, air, multimodal)
- Documentation: commercial invoice, packing list, bill of lading, certificate of origin, phytosanitary (where relevant)
- Incoterms explained simply (FOB, CIF, EXW — with plain English descriptions)
- Customs considerations and when to engage a customs broker
- CTA: "Ask us about your shipment"

---

### 5. Product Categories `/products`

**Architecture rule:** Product pages serve SEO first, trust second, and RFQ third. They are not webstore pages — there is no shopping cart. The goal is to rank for category-level sourcing keywords and convert browsers into RFQ submitters.

#### Structure for each product page:

**Header:** Category name + positioning statement ("We source certified [category] directly from verified [China/Taiwan] manufacturers.")

**Why source [category] through Sovern House:**
- Specific expertise points for this category
- Compliance / certification requirements for this category
- Common problems buyers have with this category (quality issues, mislabelling, certification failures) — and how we address them

**What we source:**
- Sub-categories with brief descriptions
- Representative products (not an exhaustive catalog — keep it curated)
- No pricing on product pages; RFQ-based

**Certifications relevant to this category:**
- Flooring: formaldehyde (CARB/E1/E0), slip resistance, fire rating, FSC
- Garments: fiber content compliance, REACH, restricted substances, country of origin rules
- Bathroom/hardware: CE, ANSI, WaterSense (where applicable)
- Ironmongery: CE, ANSI/BHMA, fire rating

**CTA:** "Request a Quote for [Category]" → `/rfq?category=[category]` (pre-populates the RFQ form)

#### Priority order for build:
1. `/products/flooring` — strongest supply chain, most developed
2. `/products/garments-fabrics` — second strongest
3. `/products/bathroom-hardware` — combine bathroom + ironmongery (overlapping buyer profile)
4. `/products/travel-accessories`
5. `/products/logs` — reverse flow, separate buyer profile; last

---

### 6. Client Portal `/client-portal`

**This page is a thin wrapper around the ERP Customer Portal.**

**Content:**
- Brief description: "Existing clients access real-time order tracking, documents, and communication through the Sovern House client portal."
- Feature list:
  - Track your order from inquiry to delivery
  - Download commercial invoices, packing lists, bills of lading, inspection reports
  - Communicate directly with your account manager
  - Review QC reports and approval documents
  - Payment tracking and history
- Login button → redirects to ERP Customer Portal (subdomain: `portal.sovernhouse.co` or `app.sovernhouse.co`)
- "Not yet a client? Request a quote" → `/rfq`

**Note for CTO:** The ERP customer portal should be hosted at a subdomain, not `/portal` path, for clean separation and easier SSL management. Single sign-on is aspirational; at launch, separate credentials are acceptable.

**This page serves a dual purpose:** Trust signal for prospective buyers (shows operational sophistication) + ERP product demonstration for prospective SaaS customers.

---

### 7. RFQ Page `/rfq`

**This is the most important conversion page on the site.**

**Form Fields (Phase 1 — keep short):**
1. Full Name *
2. Company Name *
3. Email Address *
4. Country *
5. What are you looking to source? (text area) *
6. Estimated quantity / order value (optional — don't block submission if blank)
7. Timeline (optional dropdown: ASAP / 1-3 months / 3-6 months / Exploring)

**Do not add:** Phone (friction, especially international), company size, industry codes, or any field that doesn't directly help triage the inquiry.

**Confirmation:**
- Inline confirmation (no redirect): "Thank you. We'll review your inquiry and respond within 24 hours."
- Email auto-reply with what to expect and a contact number for urgent enquiries

**Backend:** Form POST → ERP Inquiry Module API → creates an inquiry record, assigns to admin queue, triggers email notification to Alex.

**Trust signals on this page:**
- "We respond to all inquiries within 24 hours"
- "No obligation — this is a conversation, not a commitment"
- The 4 value pillars condensed to a side column
- Phone number visible (reduces anxiety for buyers who want to know there's a real person)

---

### 8. Contact `/contact`

- Full contact details: address, phone, email
- Business hours and timezone (Taiwan Standard Time, UTC+8)
- Simple contact form (Name, Email, Message) — distinct from RFQ; for general enquiries
- LinkedIn link
- Map embed (optional, lends credibility)
- Language note: *"We communicate in English, Mandarin, French, Spanish, Italian, and Portuguese."*

---

## Tech Stack Decision

### Recommended Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Framework** | Next.js 15 (App Router) | Server-side rendering for SEO; PPR for speed; React ecosystem; cleanest integration with ERP API |
| **Styling** | Tailwind CSS 4 | Rapid development; responsive; RTL-capable for future Arabic/Farsi audiences |
| **CMS** | Payload CMS | Next.js-native; self-hosted; no recurring SaaS fees; editors can update product/service pages without developer |
| **Hosting** | Vercel (website) + existing ERP infrastructure | Vercel gives zero-config Next.js deployment, global CDN, automatic SSL; ERP stays on its own Docker infrastructure |
| **CDN** | Cloudflare | DDoS protection; Speed Brain prefetching; image optimization; global delivery for international buyers |
| **Database (website)** | Payload's managed DB (SQLite initially, PostgreSQL when scaling) | Website doesn't need its own heavy DB at launch — Payload handles content storage; ERP handles all transactional data |
| **Email** | Resend or Postmark | Transactional email for RFQ confirmations; reliable delivery, clean APIs |
| **Analytics** | Plausible (privacy-first) | GDPR-compliant; no cookie consent bloat for EU visitors; simple dashboard |
| **Forms** | Native Next.js server actions → ERP API | No third-party form service; form data goes directly into ERP inquiry module |

### What We Are NOT Building

- A shopping cart or checkout (all orders flow through ERP after RFQ)
- A separate user auth system for the website (login goes to ERP portal)
- A product database in the website (product content is CMS-managed, not synced from ERP catalog)

---

## ERP Integration Points

The ERP is the operational backbone. The website integrates at exactly two points at launch:

### Integration 1: RFQ → ERP Inquiry Module

**Flow:**
```
Visitor fills /rfq form
→ Next.js server action validates input
→ POST to ERP API: POST /api/inquiries
→ ERP creates Inquiry record with status "New"
→ ERP sends internal notification to admin dashboard
→ Website shows inline confirmation to visitor
→ Resend/Postmark sends auto-reply email to visitor
```

**ERP API requirements:**
- `POST /api/inquiries` — accepts: name, company, email, country, description, quantity, timeline
- Returns: inquiry ID and success/error status
- Authentication: API key (not user-token; this is a server-side call from Next.js backend)
- Rate limiting: implement on ERP side to prevent spam

### Integration 2: Client Portal SSO / Link

**At launch (simple):**
- `/client-portal` page on website shows feature overview + "Login" button
- Login button links to ERP Customer Portal URL (subdomain: `portal.sovernhouse.co`)
- Credentials are managed inside the ERP (no SSO at launch)

**Phase 2 (when justified by volume):**
- OAuth2/OIDC single sign-on between website and ERP
- "Track your order" deep-links from website to specific order screens in ERP

### Future Integration Points (Phase 2+)

- Order status widget embedded on website for logged-in customers
- Public product catalog synced from ERP inventory (only if catalog model is adopted)
- Factory portal promotion page (if ERP SaaS strategy moves forward)

---

## SEO Architecture

### URL Structure
- Short, descriptive, hyphenated
- No dates in URLs (blog posts excepted)
- Category pages: `/products/flooring` (not `/product-categories/flooring-tiles-asia`)

### Priority Keywords (Phase 1 Research Required)

**High Intent (bottom of funnel — these convert):**
- "asia sourcing agent"
- "buying agent China"
- "flooring importer from China"
- "quality control services China"
- "garment sourcing agent Asia"
- "buying house Taiwan"

**Mid Intent (research phase):**
- "how to import flooring from China"
- "what is a buying house"
- "sourcing agent vs trading company"
- "China QC inspection services"

**Brand / Trust:**
- "Sovern House sourcing"
- "sovernhouse.co"

### On-Page SEO Requirements

- `<title>` and `<meta description>` unique per page (managed in Payload CMS)
- H1 per page, H2/H3 hierarchy
- `hreflang` tags if/when Spanish or French versions are added
- Open Graph tags for LinkedIn sharing (buyers share sourcing resources)
- Structured data: Organization schema on homepage; FAQ schema on `/how-it-works`
- Sitemap.xml auto-generated by Next.js
- `robots.txt`: block `/client-portal` and API routes; allow all public pages

### Content Calendar (Phase 2 Blog)

Target 2-4 posts/month. Priority topics:
- "Trading company vs. buying house — what you're actually paying for"
- "How to read a pre-shipment inspection report"
- "Incoterms explained for first-time importers"
- "The real cost of importing flooring from China (landed cost breakdown)"
- "CARB certification: what flooring importers need to know"
- "Why Mandarin matters when sourcing from Taiwan"

---

## Brand Application on Website

### Logo
- Use existing NR mark (stylised N with flooring texture + ship icons)
- Update tagline from "N Export — Flooring Export" to "Sovern House" only (no category qualifier)
- SVG format on website for crisp rendering at all sizes
- Dark version on white background (primary); light/white version for dark headers

### Colour Palette
- **Define before build:** Pull 2-3 brand colours from the existing logo. Likely a deep navy or charcoal (trust, B2B credibility) + an accent (action colour for CTA buttons).
- Avoid: red (danger associations in some Asian markets), bright green (cheap/discount signal in B2B)
- Recommend: deep navy primary + gold or warm amber accent (premium, international)

### Typography
- Headline: clean, modern sans-serif (Inter, Syne, or Neue Haas — need to check logo font)
- Body: high readability at small sizes for international audiences
- No decorative or script fonts — they don't localize or translate well

### Photography Principles
- Real over stock wherever possible
- Alex on the ground: factory floors, ports, product inspection
- Products: clean, well-lit product shots
- Do not use: Western office stock photos, diversity stock imagery, generic "handshake" business photos

---

## Build Phases

### Phase 1 — Launch (Target: 6 weeks)

**Pages:** Homepage, About, How It Works, RFQ, Contact, Client Portal (wrapper)  
**Products:** Flooring, Garments (2 category pages only)  
**Services:** Sourcing, Quality Control (2 service pages only)  
**Integrations:** RFQ → ERP API, Client Portal link  
**SEO:** Meta tags, sitemap, robots.txt, Organization schema  
**Infrastructure:** Vercel, Cloudflare, domain → sovernhouse.co

**Prerequisites before build starts:**
- [ ] Alex registers `sovernhouse.co` and `newroute.trade`
- [ ] ERP rebranded from "FloorTrade" to "Sovern House"
- [ ] ERP Inquiry API endpoint documented and accessible
- [ ] NR logo exported as SVG with updated tagline
- [ ] Brand colours confirmed

### Phase 2 — Depth (Months 2-3)

- Remaining product pages (Bathroom/Hardware, Travel, Logs)
- Remaining service pages (Private Label, Logistics)
- Blog launch (4 cornerstone articles)
- Google Analytics / Plausible setup with conversion tracking on RFQ submissions
- LinkedIn integration (share blog to company page)
- Case studies (anonymised — even 2 strong case studies shift conversion)

### Phase 3 — Scale (Months 4-6)

- Multilingual: Spanish (Latin America) and French (French-speaking markets)
- ERP SaaS landing page — separate positioning for selling the ERP to other trading companies
- Gated content (sourcing guides, Incoterms checklists) for lead nurture
- Email sequence for RFQ leads who don't convert immediately
- Enhanced client portal with order tracking widget

---

## Risk Flags

| Risk | Severity | Mitigation |
|---|---|---|
| ERP not rebranded before portal is live | High | Block client portal link until rebrand complete |
| RFQ form delivers to wrong email / no email | High | Test end-to-end flow in staging before go-live |
| `database.sqlite` in ERP contains real data exposed in deployment | High | Review ERP DB before any public deployment; ensure it's not accessible via web |
| GDPR compliance for EU visitors | Medium | Cookie consent (use Cookiebot or Klaro); Privacy policy; Plausible analytics is GDPR-safe |
| `asiaflooringexporter.com` email still in use | Medium | Plan email migration to info@sovernhouse.co; don't break existing contacts |
| Logo tagline not updated before launch | Low | Cosmetic but signals lack of professionalism; fix before Phase 1 |
| No SSL on sovernhouse.co at launch | High | Vercel + Cloudflare auto-provision SSL; verify it's active before traffic |

---

## Immediate Next Steps (Action Items for Alex)

1. **Register domains** — `sovernhouse.co` and `newroute.trade` — today. Can't build until the domain exists.
2. **Confirm email address** — will info@sovernhouse.co be ready at launch, or is info@asiaflooringexporter.com the fallback?
3. **Logo export** — export the NR mark as SVG, updated tagline "Sovern House" only. If the .ai file isn't accessible, rasterise at 2x for now.
4. **Confirm brand colours** — what are the HEX codes from the existing logo? Need these before frontend build.
5. **ERP API access** — does the ERP Inquiry module have a documented REST API endpoint? If not, this needs to be built/confirmed before RFQ integration.
6. **Review database.sqlite** — assess whether the ERP database contains real data before any public deployment.

---

*Document owner: Alex / Sovern House Group*  
*Next review: After Phase 1 completion*  
*Related files: company-profile.md, CLAUDE.md, Skills/trade-cro.md, Skills/trade-cmo.md, Skills/trade-cto.md*
