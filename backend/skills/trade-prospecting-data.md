# Prospecting & Data — Sovern House

**Last Updated:** 2026-04-17
**Applies to:** All lead sourcing, list building, enrichment, email verification, and sanctions-screening workflows feeding the sales pipeline. This skill sits upstream of `trade-sales.md`, `trade-outreach-copy.md`, and `trade-email-deliverability.md` — bad data at this stage wastes every downstream effort.

---

## I. Why Data Quality Matters More Than Copy

Research across 3B+ emails in 2026 is unambiguous: data quality is now the single largest lever in cold outbound performance. A perfectly-written email to a stale, unverified, or mis-targeted list underperforms a mediocre email to a tight, verified, high-intent list.

For Sovern House specifically:
- **Wrong ICP = burned credibility.** Pitching Taiwan flooring to a software company embarrasses the brand.
- **Unverified emails = bounce rate = deliverability damage.** See `trade-email-deliverability.md`.
- **Missed sanctions screening = legal and operational risk.** L-013 in lessons.md is non-negotiable.
- **Wrong trigger data = low reply rate.** Generic "I see you're in flooring" loses to "I saw your last 3 shipments were from Qingdao."

The prospecting skill's job is to deliver lists that are: **on-ICP, verified, enriched with trigger signals, sanctions-cleared, deduplicated against existing contacts, and ready to send.**

---

## II. Customs & Trade Data Sources

These are the advantage we have that most marketing-oriented sales teams don't know exists. Customs records show who imports what, from where, in what volume, on which vessels. Zero equivalent exists in other industries.

### ImportGenius

**What it is:** Bill-of-lading-level access to US customs import records (2006–present) and 24+ other jurisdictions. AI-powered company profiler showing shipper-consignee links.

**What we use it for:**
- Finding US importers of our categories (flooring, garments, bathroom, ironmongery, travel accessories)
- Identifying who they currently buy from (names of factories / agents in origin country)
- Observing shipment frequency (signals volume and stability)
- Spotting recent changes (new supplier, new port, new volume pattern = trigger event)

**Example workflow:**
1. Search: HS code for laminate flooring → filter US importers → filter volume > 10 containers/year
2. Export: importer name, address, volume, current supplier country, last shipment date
3. Enrich: decision-maker via LinkedIn Sales Navigator
4. Trigger: "Your last 4 container shipments came in from [Port X] — we have strong factory relationships in [nearby origin port] worth considering"

**Pricing:** Month-to-month available; annual plans offer up to 36% savings. Specific pricing requires direct quote — contact sales.

### Panjiva (S&P Global)

**What it is:** Direct competitor to ImportGenius. 2 billion+ shipment records, 22 customs sources, strong HS code normalization and supply-chain mapping.

**Choose Panjiva if:** we need multi-jurisdiction mapping or deep historical analytics. Panjiva's strength is analytical — long-term trends, policy research.

**Choose ImportGenius if:** we need fast company-profiler workflows and daily-updated records for day-to-day prospecting.

**Recommendation:** Start with ImportGenius (more tactical); add Panjiva later if needed.

### Free / low-cost alternatives

- **US Census Bureau USA Trade Online** — free, aggregate trade data (not bill-of-lading level)
- **UN Comtrade** — free, country-to-country trade flows
- **TradeMap (ITC)** — free, trade statistics by HS code

These are useful for market sizing and trend analysis, not prospect-level targeting.

### Importer directories (secondary)

- **Thomasnet** — US industrial suppliers and buyers directory
- **Kompass** — global B2B directory; variable data quality
- **EC21, Global Sources, Alibaba** — largely supplier-side but some buyer data available
- **Local chambers of commerce** — member directories for target regions

### Specialised flooring / garments directories

- **Flooring:** World Floor Covering Association (WFCA) member list, NAFD (UK), EUFLA (EU)
- **Garments:** WSIA, USA Apparel & Footwear Association, EURATEX (EU textiles) member lists
- **Bathroom:** ABMA, KBIS attendee and exhibitor lists
- **Hardware/Ironmongery:** BHMA member list, Ironmongers Company (UK) directory

Trade association member directories are gold for ICP-matched prospects.

---

## III. Contact-Level Prospecting Tools

Customs data gives us the company. These tools give us the person.

### LinkedIn Sales Navigator

**Core ($119.99/mo):** Advanced search filters (company size, geography, title, industry), 50 InMails/month, lead and account recommendations, real-time alerts.

**Advanced ($179.99/mo):** Adds CRM integration, team collaboration, TeamLink, buyer-intent data.

**Use for Sovern House:**
- Search: company (from customs record) → filter title (VP Sourcing, Head of Procurement, Owner, etc.)
- Save searches: "Flooring procurement managers in US, 50–500 employee retailers" → weekly alerts on new matches
- Monitor: decision-maker job changes within target accounts (90-day new-hire window = highest-intent moment)
- Engagement: warm up prospects by liking/commenting on their posts before outreach

**Critical rule:** Do NOT automate LinkedIn with third-party tools (Dux-Soup, PhantomBuster, etc.). LinkedIn actively bans accounts using these tools, and Alex's personal LinkedIn network represents years of relationship capital that cannot be rebuilt.

### Apollo.io

**What it is:** Combined B2B database (275M+ contacts) + email verification + outbound sequencing + basic CRM.

**Pricing:** Free tier with 50 email credits/month; paid plans from $39/mo/seat (Basic) through $149/mo/seat (Organization).

**Strength:** Massive contact database with emails, phone numbers, and enrichment data. Good for quickly pulling a targeted list of, e.g., "All Heads of Procurement at US flooring retailers with 50–500 employees."

**Weakness:** Data accuracy is uneven. Emails should still be re-verified. Some contacts stale.

**Use case:** Primary enrichment layer after customs data identifies target companies.

### Hunter.io

**What it is:** Email finder by company domain. Finds the most common email pattern (first.last@, first@, flast@, etc.) and looks up specific contacts.

**Pricing:** Free tier (25 searches/month). Paid from $49/mo (Starter).

**Use case:** When you have a company name but not a specific contact's email. Feed in name + domain, Hunter returns best-guess email with confidence score.

### Clearbit / ZoomInfo / Lusha

Enterprise-grade contact data. Expensive ($1K+/month). Overkill for Sovern House at current scale. Revisit if/when outbound volume exceeds 500 prospects/week.

---

## IV. Email Verification — Non-Negotiable Step

Never send to unverified emails. Ever.

### ZeroBounce

**Pricing:** 2,000 credits minimum at $20 ($0.01/credit). Monthly subscription at 25,000 credits for $79/month (annual). Accuracy: ~97%.

### NeverBounce

**Pricing:** $8 per 1,000 credits ($0.008/email). Accuracy: ~96%. Credits expire after 12 months.

**Recommendation:** Either works. NeverBounce is marginally cheaper per email. ZeroBounce credits don't expire.

### What verification catches

- **Hard bounces** — email doesn't exist. Must be removed before sending.
- **Role-based emails** — info@, sales@, contact@. Low intent, often flagged as spam.
- **Disposable emails** — mailinator, guerrillamail, etc. Not real prospects.
- **Spam traps** — honeypot addresses planted by blacklist operators. Sending to these = instant blacklist.
- **Catch-all domains** — accept everything at SMTP but bounce later. Verify cautiously; if the company is high-value, send with caution.

### Workflow

1. Pull contact list from Apollo / LinkedIn / ImportGenius + Hunter
2. Export CSV
3. Upload to ZeroBounce or NeverBounce
4. Remove: hard bounces, spam traps, disposable, role-based (unless manually verified as decision-maker)
5. Flag: catch-alls for lower-volume sending
6. Result: clean list ready for sanctions screen + send

---

## V. Sanctions Screening — Mandatory Pre-Send Step (L-013)

Every prospect screened before first email. Not after the reply. Not before the contract. Before the first email.

### What we screen against (minimum)

- **OFAC SDN** (US Treasury Specially Designated Nationals) — mandatory for any US-connected business
- **OFAC Consolidated Sanctions List** — includes non-SDN lists (FSE, NS-PLC, etc.)
- **EU Consolidated List** (FSF — Financial Sanctions Files) — mandatory for EU-connected business
- **UN Consolidated List** — global
- **UK HM Treasury Sanctions List** — mandatory for UK-connected business
- **Country-level sanctions** — currently: Russia, Belarus, Iran, North Korea, Syria, Cuba (comprehensive); various other country-specific restrictions (Myanmar, etc.)

### Free tools for small-scale screening

- **OFAC SDN Search** (sanctionssearch.ofac.treas.gov) — free, official, manual lookup
- **EU Consolidated List Search** (webgate.ec.europa.eu/fsd) — free, official
- **UN Consolidated Search** (scsanctions.un.org) — free, official

Free tools are fine for 1–10 prospects/week. Manual. Slow. High false-positive rate (common names).

### Paid tools for scale

- **Descartes Visual Compliance** — denied-party screening for SMEs. Cloud and mobile; AI-assist reduces false positives 20–60%. Typical small-business pricing: $1,200–$2,500/year for 5K–20K screenings. Integrates with Salesforce and NetSuite.
- **Dow Jones Risk & Compliance** — enterprise; expensive; overkill at our stage.
- **Sayari** — trade-compliance-focused; strong on beneficial ownership.
- **ComplyAdvantage** — AI-driven; reasonable pricing for small business.

**Recommendation for Sovern House current stage:** Free tools + manual screening until prospect volume exceeds 20/week. Then move to Descartes or similar.

### Screening output: three outcomes

- **Clear** — no match, no hit, proceed to outreach.
- **Match — false positive** — common name hits SDN but clearly not the same entity. Document the review and proceed.
- **Match — likely true positive** — pause immediately, escalate to compliance/attorney lens. Do not email.

### Documentation

Every screen must be documented with:
- Date
- Name/entity screened
- Lists screened against
- Result (clear / false positive / true positive)
- Reviewer (who cleared it)

Keep records 5+ years. Both OFAC and EU require documentation of screening process during audits or enforcement actions. See `trade-compliance.md` and `trade-attorney.md`.

### Who gets screened

- **Every direct prospect** — the company and the named contact
- **Every beneficial owner** (once known) — for deal structuring
- **Every vessel** (in logs trade) — sanctioned vessels are a real issue
- **Every intermediary** — banks, freight forwarders, agents

For the cold-email stage, the direct-prospect screen (company + contact) is the minimum bar.

### Re-screening cadence

Screening once is not enough. Per `trade-compliance.md`, ongoing monitoring is required. Sanctions lists update daily; a cleared prospect today can land on SDN tomorrow.

- **Active prospects (in outbound sequence):** re-screen if their status changes or they move to discovery-call stage — whichever comes first
- **Qualified pipeline (Stages 3–5):** re-screen quarterly at minimum, and always 24 hours before signing any contract or releasing goods (per `trade-attorney.md` post-signature checklist)
- **Active customers:** re-screen quarterly; also re-screen on any material transaction change (new payment method, new bank, new destination, volume spike)
- **Dormant / nurture-list prospects:** re-screen on any re-engagement, even if last clearance was < 90 days

Document every screening event (date, lists hit, reviewer, outcome). Retain records minimum 5 years per US regulation; Taiwan regulatory expectations may differ — confirm with attorney.

---

## VI. The Prospecting Workflow — Weekly Cadence

A repeatable process. Once defined, Alex or a VA can execute it.

### Monday — Target companies

1. Define the week's target: vertical + geography + trigger
   - Example: "US flooring retailers, 50–500 employees, currently importing from China"
2. Pull from ImportGenius: US importers, HS code for laminate flooring, volume > 10 containers/year, shipments in past 6 months
3. Filter manually: remove obvious non-fits, remove known customers/prospects
4. Result: 40–60 target companies

### Tuesday — Decision-makers

1. For each target company, use LinkedIn Sales Navigator
2. Identify 1–2 decision-makers per company (VP Sourcing, Head of Procurement, Owner for small co's)
3. Export: name, title, LinkedIn URL, company
4. Result: 60–100 named contacts

### Wednesday — Enrichment

1. Feed names + domains into Apollo or Hunter
2. Retrieve email addresses
3. Cross-check LinkedIn for any recent public posts, promotions, company news
4. Tag each prospect with at least one specific trigger / hook
5. Result: 60–100 prospects with email + trigger data

### Thursday — Verification + screening

1. Run list through ZeroBounce or NeverBounce → remove hard bounces, risky, role-based
2. Run each entity + contact through OFAC SDN + EU Consolidated + UN lists (manual or Descartes)
3. Remove: anyone matching at any tier (escalate true positives)
4. Document clearance
5. Result: 50–80 cleared, verified, screened prospects

### Friday — Load + schedule

1. Import into Smartlead/Instantly
2. Assign to the appropriate sequence (flooring / garments / bathroom / etc.)
3. Personalise the opener for each prospect (this is the 3-hour step — do not skip)
4. Schedule sends across next week, ≤30 per inbox per day
5. Result: next week's campaign is loaded

**Total weekly capacity at current stage:** 50–80 fresh prospects entering the sequence / week. Steady state, expandable later.

---

## VII. Trigger Signals That Matter Most

A cold email with a trigger signal in the opener replies at 10–18%. Without one: 2–3%. The trigger is the single highest-leverage part of prospecting.

### Best triggers for trade prospects

**Procurement pain / change:**
- Recent negative review or social post about a current supplier
- LinkedIn post mentioning supply-chain issues, quality problems, tariff impact
- Press release about shifting supply chain (friend-shoring out of China, new Asia strategy)
- Customs records showing a sudden supplier-country change (signals disruption)

**Growth signals:**
- Job postings for "Head of Sourcing," "Asia Supplier Manager," "Procurement Analyst"
- New hires in procurement / sourcing roles (check LinkedIn within last 90 days)
- Funding rounds (companies raising cash often expand supplier base)
- New product launches (new SKUs = new sourcing needs)
- Store openings, new geographic markets (new inventory needs)

**Category signals (vertical-specific):**
- Flooring: new store formats, private-label collections, construction-project wins
- Garments: new brand launches, collaboration drops, store expansions
- Bathroom: hotel developments, multi-family housing projects, design-build contracts won
- Travel accessories: new product drops, retail partnerships, licensing deals

**Sovern House–specific triggers:**
- Any company diversifying sourcing from mainland China to Taiwan (friend-shoring)
- Any company impacted by recent tariff changes (Section 301, EU trade defense measures)
- Any company with Mandarin-only supplier-side communication challenges

### Where to find triggers

- LinkedIn (company page + key individuals' posts)
- Google Alerts on company name
- Crunchbase / Pitchbook for funding
- Local news and trade publications
- Customs data pattern changes (ImportGenius)
- Trade show attendee lists

---

## VIII. List Hygiene & Deduplication

Every week, before new prospects load:

- [ ] Dedupe against existing CRM contacts (never pitch someone already in pipeline)
- [ ] Dedupe against existing customer list (never cold-pitch an existing buyer)
- [ ] Dedupe against lost deals from past 12 months (respect "not interested" replies)
- [ ] Check suppression list (unsubscribes from previous campaigns — MUST be honored)
- [ ] Check competitor list (if any prospect is a known Sovern-to-be-avoided, flag)

### Suppression list management

- Every unsubscribe goes to a master suppression list — across ALL sending domains, ALL campaigns, forever
- Honor within 48 hours (CAN-SPAM: 10 business days; GDPR: 30 days; we do 48 hours as policy)
- Never re-import unsubscribed addresses "by mistake"

---

## IX. Data Stack — Recommended Setup

### Minimum viable stack (launch phase)

| Layer | Tool | Cost/mo |
|---|---|---|
| Company data (customs) | ImportGenius | ~$99–$299 |
| Contact data (people) | LinkedIn Sales Navigator Core | $119.99 |
| Contact enrichment (email) | Hunter.io Starter | $49 |
| Email verification | NeverBounce (pay-per-use) | ~$20–40 |
| Sanctions screening | Free tools (OFAC/EU/UN) | $0 |
| CRM | HubSpot Free | $0 |
| Outbound platform | Smartlead or Instantly | $37–39 |
| **Total** | | **~$325–590/mo** |

### Scaling stack ($1M+ in commissions)

| Layer | Tool | Cost/mo |
|---|---|---|
| Company data | ImportGenius Pro | $200–$500 (verify current) |
| Company data (enterprise, optional) | Panjiva (S&P Global) | Enterprise, typically $10K+/yr — quote required |
| Contact data | Sales Nav Advanced | $179.99 |
| Contact enrichment | Apollo Organization | $149/seat |
| Email verification | ZeroBounce subscription | $79 |
| Sanctions screening | Descartes Visual Compliance | $100–210 (≈$1,200–$2,500/yr) |
| CRM | HubSpot Starter or ERP module | $15+ |
| Outbound platform | Smartlead Pro | $94+ |

Panjiva is enterprise-priced and not publicly listed — treat it as a later-stage investment once ImportGenius alone hits its limits. Most operations at $1–5M in commission run fine on ImportGenius + Sales Navigator + Apollo without Panjiva.

---

## X. Metrics the Prospecting Function Owns

| Metric | Target |
|---|---|
| Prospects identified/week | 50–150 |
| ICP match rate (pass scoring ≥18/25) | > 70% |
| Email verification pass rate | > 85% |
| Sanctions clearance rate | > 98% (low hits expected for our ICP) |
| Email bounce rate post-verification | < 2% |
| Reply rate (ICP-matched, triggered, personalized) | 8%+ |
| Cost per qualified meeting | < $500 early; < $200 at scale |

---

## XI. What the Prospecting Function Blocks

**Never approve:**

1. Sending to a prospect without email verification
2. Sending to a prospect without sanctions screening (L-013)
3. Sending to a prospect not scored against the ICP framework
4. Sending to addresses on the suppression list
5. Purchasing a cold list from a third-party vendor (these are stale, over-emailed, and spam-trap-laden)
6. Using a single LinkedIn automation tool that could ban Alex's account
7. Skipping deduplication against CRM — pitching existing customers is a brand-level mistake
8. Any list where > 10% of records fail verification — the source is bad
9. Any list with more than one match on OFAC/EU/UN without pause + compliance review
10. Any prospect outside our vertical that a sales rep wants to "try" — discipline is a data decision, not a taste decision

**Flag for review:**
- New data-source onboarding (is the data quality and cost justified?)
- Any list > 200 prospects (capacity / deliverability risk)
- Any new geography (may introduce new compliance considerations)
- Prospects with beneficial-ownership in high-risk jurisdictions (escalate to compliance)

---

## XII. Sources

- [Panjiva — Global Trade Insights (S&P Global)](https://panjiva.com/)
- [ImportGenius — Global Trade Data Platform](https://www.importgenius.com/)
- [ImportGenius Pricing](https://www.importgenius.com/pricing)
- [Descartes Visual Compliance — OFAC Screening](https://www.visualcompliance.com/compliance-solutions/denied-party-screening/ofac-screening/)
- [Descartes Denied Party Screening Pricing 2026 — GetApp](https://www.getapp.com/finance-accounting-software/a/descartes-denied-party-screening/)
- [LinkedIn Sales Navigator Pricing 2026 — Skrapp](https://skrapp.io/blog/linkedin-sales-navigator-cost-and-pricing/)
- [2026 Email Verification Benchmark — Instantly](https://instantly.ai/blog/2026-email-verification-benchmark-accuracy-scores-for-8-top-tools/)
- [ZeroBounce Pricing 2026 — Bouncer](https://www.usebouncer.com/zerobounce-pricing/)
- [NeverBounce Pricing 2026 — Puzzle Inbox](https://puzzleinbox.com/blog/neverbounce-pricing-guide/)
- [Cold Email in 2026: Why Data Quality Matters More Than Copy — Landbase](https://www.landbase.com/blog/cold-email-2026-data-quality-matters-more-than-copy)
- [OFAC SDN Search (official)](https://sanctionssearch.ofac.treas.gov)
- [EU Consolidated Financial Sanctions List](https://webgate.ec.europa.eu/fsd)
- [UN Consolidated Sanctions Search](https://scsanctions.un.org)

---

**Document Owner:** Prospecting & Data (Alex, until hired; or VA + contractor for research work)
**Next Review:** Quarterly
