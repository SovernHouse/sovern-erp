# Sovern House — Prospect Sourcing Skill

**Version:** 1.0 | **Last Updated:** April 2026  
**Depends on:** sovern-icp.md (read first)  
**Use for:** Finding, qualifying, and building prospect lists for outreach campaigns.

---

## Goal of This Skill

Produce a qualified prospect list — company name, contact name, title, email, LinkedIn URL, company website, category, geography, and a 1-sentence personalization hook. Every entry must pass the ICP checklist before it goes into the outreach queue.

---

## Primary Sourcing Channels

### 1. LinkedIn (Highest Quality)

**Search operators:**
- Job title: `Procurement Manager`, `Sourcing Manager`, `VP Supply Chain`, `Import Manager`, `Head of Sourcing`, `Owner` (for SMBs)
- Industry filters: `Wholesale`, `Import & Export`, `Retail`, `Textiles`, `Building Materials`, `Consumer Goods`
- Geography: `United States`, `Canada`, `United Kingdom`, `Germany`, `France`, `Australia` (where trade volumes are high)
- Company size: 11–500 employees (focus here; larger = longer cycle, smaller = no volume)

**What to record per prospect:**
- Full name + title
- Company name + website
- LinkedIn profile URL
- Their recent activity (any posts about supply chain, sourcing, Asia) → personalization hook
- Company's product categories (visit their website)

**Red flags to skip:**
- Title contains "assistant" without "VP" or "Director" context
- Company clearly manufacturing domestically only (no import visible)
- Profile dormant 12+ months (lower response rate)

---

### 2. Trade Show & Exhibition Attendee Lists

Key shows for Sovern House's categories:

| Show | Category | Typical Buyers |
|------|----------|----------------|
| Canton Fair (China Import/Export Fair) | All categories | Importers globally |
| Heimtextil (Frankfurt) | Garments, textiles, home fabrics | EU + US retailers, brands |
| Cersaie (Bologna) | Flooring, bathroom | EU distributors, architects |
| Coverings (USA) | Flooring, tile | US distributors, contractors |
| Domotex (Hannover) | Flooring | European distributors |
| Magic Las Vegas | Apparel, garments | US buyers |
| ISGB / hardware shows | Ironmongery, hardware | Distributors, contractors |

**How to use:** Exhibitor directories are public. Cross-reference company names with LinkedIn to find decision-makers. Attendee lists sometimes available post-show via event apps (LinkedIn badge scanning data).

---

### 3. Web Search Targeting

Search patterns to find qualified importers:

```
site:linkedin.com/company "flooring importer" (US OR UK OR Canada)
"Asia sourcing" "procurement manager" site:linkedin.com
"import from China" "private label" garments company
flooring distributor "source from Asia" contact
```

Also search trade publication directories:
- Floor Covering News (US flooring distributor directory)
- Sourcing Journal (US apparel supply chain contacts)
- Global Sources buyer directory
- ImportGenius / Panjiva (shows actual import records — gold for qualification)

**ImportGenius / Panjiva (if access available):**  
These show actual US Customs import records. Search by HS code to find companies importing your categories. This is the highest-quality lead qualification source because you can see they actually import the goods, not just claim to.

HS codes for Sovern House categories:
- Flooring: 4418, 4412, 3918, 5702, 5703
- Garments: Chapter 61 (knit), Chapter 62 (woven)
- Bathroom hardware: 8481, 7324, 6910
- Ironmongery/door hardware: 8301, 8302, 8303
- Travel accessories: 4202
- Logs: 4403

---

### 4. Company Website Directories

Industry associations publish member directories:
- **NWFA** (National Wood Flooring Association) — US flooring importers/distributors
- **AHFA** (American Home Furnishings Alliance)
- **AAFA** (American Apparel & Footwear Association)
- **BTHA** (British Toy & Hobby Association — if expanding to toys)
- Local chambers of commerce in target cities

---

### 5. Referrals from Existing Network

Always the highest conversion rate. Before launching cold outreach in any new category:
1. Ask: does Alex know anyone in this segment who could introduce him?
2. Any existing clients in adjacent categories who could refer?
3. Any Taiwan or China factory contacts who know buyers?

---

## Prospect Data Template

For each prospect, record:

```
Company:          [Name]
Website:          [URL]
Category:         [Flooring / Garments / Bathroom / etc.]
Geography:        [US / UK / Germany / etc.]

Contact name:     [First Last]
Title:            [Procurement Manager, etc.]
Email:            [if found]
LinkedIn:         [profile URL]

ICP Tier:         [1 / 2]
Qualification:    [1-2 sentences — why they fit]
Personalization hook: [1 sentence — specific observation for email opener]

Compliance check: [ ] OFAC screened — clear
                  [ ] No obvious red flags

Outreach status:  [Not started / Email 1 sent / Follow-up 1 / etc.]
```

---

## Email Finding Methods (in priority order)

1. **Company website "Contact" or "Team" page** — most reliable
2. **LinkedIn "Contact info"** — sometimes listed directly
3. **Email pattern guessing + verification:**
   - Find the company's email pattern (e.g., first@company.com or firstname.lastname@company.com)
   - Use pattern from other known contacts at the company
   - Verify with a free tool: Hunter.io, Apollo.io, or Snov.io
4. **Google search:** `"[firstname] [lastname]" "[company]" email`
5. **Never purchase email lists** — deliverability is poor, legal risk is real

---

## Compliance Screen (Run Before ANY First Contact)

Per lessons.md L-013: Screen BEFORE engagement, not after.

Quick screen process:
1. Google "[Company name] sanctions" and "[Contact name] sanctions" — flag anything unusual
2. OFAC SDN list search: sanctionssearch.ofac.treas.gov (free, official)
3. EU Consolidated List: eeas.europa.eu/topics/sanctions-policy (free)
4. If any result flags, do NOT proceed — escalate to trade-compliance.md process

Takes 2 minutes per prospect. Non-negotiable.

---

## Batch Size & Workflow

**Recommended batch approach:**
- Build prospect list in batches of 20–30 per category/geography segment
- Qualify all 20–30 before writing any emails (don't build as you write — it introduces quality drift)
- Compliance screen all before adding to send queue
- Launch email sequence for one batch before building the next (test what works first)

**Priority order for first batches:**
1. US flooring distributors (strongest category, clearest buyer profile)
2. US/EU garment importers (second strongest)
3. Taiwan friend-shoring targets (timely, unique advantage)
4. EU bathroom/hardware distributors

---

## Output Format

Deliver prospect lists as a structured table or spreadsheet with these columns:

| Company | Website | Category | Country | Contact | Title | Email | LinkedIn | ICP Tier | Hook | Screened |
|---------|---------|----------|---------|---------|-------|-------|----------|----------|------|----------|

Ready to import into a CRM, Google Sheet, or the Sovern House ERP inquiry module.
