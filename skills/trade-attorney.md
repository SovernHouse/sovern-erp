# Attorney Legal Reference Guide — International Trade

**Purpose**: This document is a read-before reference for any AI adviser making legal recommendations on behalf of an international trade company. It covers applicable law, contract formation, dispute resolution, compliance, and website obligations. This is NOT legal advice; it flags issues for attorney review.

**Authority**: All items marked *[VETO]* are absolute blocks — the attorney vetoes any action without explicit legal counsel involvement.

---

## I. LEGAL LANDSCAPE OVERVIEW

### Governing Frameworks

- **CISG (UN Convention on Contracts for the International Sale of Goods)** — Applies automatically to sales contracts between parties in different signatory countries unless **expressly excluded**. Does NOT apply to services, IP, or intangibles.
  - Ratified by 98+ countries including USA, China, Germany, Canada. [Source: UNCITRAL](https://uncitral.un.org/en/texts/salegoods/conventions/sale_of_goods/cisg)
  - Parties can exclude CISG entirely via contract language: *"This contract is not governed by the UN Convention on Contracts for the International Sale of Goods."*

- **UNIDROIT Principles for International Commercial Contracts (PICC)** — Non-binding but widely recognized framework for gap-filling in international contracts; used by arbitrators when parties designate it.

- **ICC Force Majeure and Hardship Clauses (2020)** — Model language published by ICC for use in international contracts. Recommended baseline for trade agreements.

- **Incoterms® 2020** — 11 standardized terms defining cost/risk/responsibility allocation in goods sales. Current edition; use explicitly in every sales contract (e.g., "FOB Shanghai" or "CIF New York").

---

## II. CISG AND INTERNATIONAL CONTRACT LAW

### When CISG Applies

CISG governs **automatically** when:
- Both parties are in signatory countries (or one party's place of business is in a signatory country), **AND**
- The contract is for the sale of **goods** (tangible movable items only), **AND**
- Neither party has excluded it in writing.

**Does NOT apply to**:
- Services, labor, consulting, freight, insurance
- Intellectual property, licenses, software (unless sold as tangible goods)
- Transactions between businesses and consumers (if consumer protection laws apply)
- Government purchases

### Key CISG Provisions Affecting Contracts

| Provision | Default Rule | Contract Override? |
|-----------|--------------|-------------------|
| Contract Formation | Offer + acceptance (no "mirror image" rule — accepts with minor variations) | YES — parties can adopt other rules |
| Goods Quality & Conformity | Goods must match description, quantity, quality, packaging in contract | YES — explicit disclaimers permitted |
| Risk of Loss | Transfer point depends on Incoterm used (FOB = ship; CIF = insurance) | YES — parties set explicit terms |
| Remedies for Breach | Performance, damages, avoidance (no consequential damages unless foreseeable) | PARTIAL — some limits cannot be exceeded |
| Statute of Limitations | 4 years from breach | YES — parties can shorten (but not lengthen) |

### Critical CISG Exclusions in Contracts

**Always include in international sales contracts:**

*"This contract is governed by the laws of [jurisdiction, e.g., New York] and is expressly excluded from the application of the UN Convention on Contracts for the International Sale of Goods (CISG)."*

**Reason**: CISG defaults can diverge from company practice (e.g., "fundamental breach" threshold for avoidance, time limits for cure, notice requirements). Excluding CISG gives predictable, uniform governing law.

---

## III. ESSENTIAL CONTRACT CLAUSES FOR INTERNATIONAL TRADE

Every sales, supply, or distribution contract **must include**:

### 1. **Governing Law and Jurisdiction**

```
Governing Law: "This Agreement is governed by the laws of [State/Country], 
without regard to its conflict of law principles."

Jurisdiction: "The parties irrevocably submit to the exclusive jurisdiction 
of the [specify court or arbitration institution] for resolution of disputes."
```

**Guidance**:
- **Choice of Law**: Recommend New York (predictable, international-friendly), England (common law tradition), or Singapore (neutral, modern, high courts). Avoid multiple jurisdictions.
- **Forum**: Often separate from governing law. E.g., law = New York, disputes = ICC Arbitration in Singapore.

### 2. **Force Majeure**

**Use ICC 2020 Force Majeure Clause as baseline:**

```
"Force Majeure: Neither party shall be liable for non-performance caused by 
unforeseeable, beyond-control events (war, sanctions, pandemic, natural disaster). 
Affected party must notify within [X days] and use reasonable efforts to mitigate. 
If event persists >60 days, non-affected party may terminate without penalty."
```

**What triggers force majeure**:
- War, terrorism, sanctions, embargoes
- Acts of God (natural disasters, pandemics, strikes)
- Government actions, trade law changes

**What does NOT (common mistakes)**:
- Price increases, currency fluctuation, supply chain delays
- Shortage of labor or materials (must be unforeseeable and unavoidable)
- Change in regulatory environment (unless sudden/unprecedented)

**Critical for trade**: Post-COVID, arbitrators apply strict "unforeseeable and unavoidable" standard. Pandemic alone no longer excuses; must show specific supply-chain failure.

### 3. **Limitation of Liability**

```
"Neither party's liability shall exceed the price paid/payable in the prior 
12 months. Neither party is liable for indirect, incidental, consequential, 
or punitive damages, including lost profits or business interruption."
```

**Exceptions to carve out** *[VETO]*:
- Indemnification for IP infringement claims
- Breach of confidentiality
- Willful misconduct, gross negligence
- Sanctions/export control violations

### 4. **Inspection and Acceptance**

```
"Buyer shall inspect goods within [X days] of delivery. Claims for defects 
must be made in writing within [Y days] of delivery, specifying defect details. 
Failure to inspect/claim forfeits right to reject goods. Seller has right to 
cure defects within [Z days]."
```

**Critical**: Under CISG, buyer loses right to claim defects if not notified promptly. Contract should specify exact notice window.

### 5. **Warranties and Disclaimers**

```
"AS-IS DISCLAIMER: Goods are provided AS-IS. Seller makes no warranties, 
express or implied, including merchantability, fitness for purpose, or 
non-infringement, except as explicitly stated herein:
[list any affirmative warranties]."
```

**For international trade**: Avoid implied warranties from your jurisdiction's law (UCC §2-315 in US, Sale of Goods Act in UK). Make all warranties explicit in contract.

### 6. **Payment Terms**

```
"Payment: [X% deposit due on order, X% due on [milestone], balance due 
[X] days after shipment]. 

Payment Method: [Wire transfer to [bank details] / Letter of Credit per UCP 600].

Currency: USD, payment in [country]. Buyer bears exchange/wire costs.

Late Payment: [X% monthly interest or [statutory rate] plus costs."
```

**For international sales**:
- Specify **Letter of Credit** (Uniform Customs & Practice for Documentary Credits, UCP 600) for high-value or first-time deals.
- Require **90% or higher upfront payment** for new/unvetted buyers.
- Always include late payment interest.

### 7. **Dispute Resolution / Arbitration Clause**

See Section IV below for full framework.

```
"Arbitration: All disputes shall be settled by binding arbitration under 
[ICC Rules 2021 / LCIA Rules / SIAC Rules 2025], with [X] arbitrators, 
situs [city], language English."
```

### 8. **Confidentiality and Non-Disclosure**

```
"Confidential Information: Each party shall maintain confidentiality for 
[X years] for non-public information disclosed by the other party. 
Exceptions: information that is (a) publicly available without breach, 
(b) independently developed, (c) required by law to disclose."
```

### 9. **Indemnification**

```
"Seller indemnifies Buyer against third-party claims that goods infringe 
IP rights, violate export controls, or breach warranty. Buyer indemnifies 
Seller against claims arising from Buyer's modification, misuse, or violation 
of law in end-use."
```

*[VETO]* — IP indemnity always required; export control indemnity critical for sanctioned goods.

### 10. **Termination and Survival**

```
"Termination: Either party may terminate for material breach if breaching 
party does not cure within [30] days of written notice. Immediate termination 
allowed for [bankruptcy, sanctions violation, export control breach].

Survival: Warranties, indemnification, limitation of liability, governing law, 
and arbitration survive termination."
```

### 11. **Sanctions and Export Control Representations**

*[VETO]* — Always include:

```
"Sanctions/Export Compliance: Each party represents that:
(a) It is not a Specially Designated National (SDN) or blocked person 
    under OFAC, EU, or UN sanctions;
(b) Goods will not be exported to sanctioned countries (Iran, North Korea, 
    Syria, Russia, etc.) or used for prohibited end-uses;
(c) Goods comply with EAR (if dual-use) and/or ITAR (if defense articles);
(d) No person associated with this transaction is on an export control denied 
    party list (BIS Entity List, DDTC ITAR Debarred List, etc.).

Breach of these representations terminates contract immediately and may 
expose both parties to criminal liability."
```

---

## IV. DISPUTE RESOLUTION IN INTERNATIONAL TRADE

### Option 1: Litigation in National Courts

**Pros**: Court judgment enforceable via treaty (New York Convention on Recognition of Foreign Arbitral Awards applies to arbitration, not litigation; enforcement varies by jurisdiction).

**Cons**: Slow (3-5+ years), expensive, unpredictable in unfamiliar jurisdictions, public.

**Use only when**: Party refuses arbitration AND dispute involves genuine novel legal question (IP, regulatory interpretation).

---

### Option 2: International Arbitration (RECOMMENDED)

**Why arbitration dominates international trade**:
- Binding, enforceable in 170+ countries under New York Convention (1958)
- Neutral seat (no home-court advantage)
- Confidential (protects business reputation)
- Expert arbitrators (retired judges, trade specialists)
- Limited appeal rights (finality)
- Faster than litigation (18-30 months typical)

#### Major Arbitration Institutions & Cost/Timeline Comparison

| Institution | Seat | Case Load (2024) | Typical Cost (Mid-Range) | Timeline | Strengths |
|---|---|---|---|---|---|
| **ICC** | Paris (can sit anywhere) | 841 new cases | $500K–$2M+ | 24-30 mo | Global reputation, strict procedural rules, experienced |
| **LCIA** | London | 318 new cases | $300K–$1.5M | 20-24 mo | Common law preference, efficient, cost-conscious |
| **SIAC** | Singapore | 625 new cases | $250K–$1.2M | 18-24 mo | Fast, modern rules (2025 update), Asian parties preferred |
| **HKIAC** | Hong Kong | Rising | $200K–$900K | 18-24 mo | Cost-effective, Asia-Pacific hub |
| **Ad Hoc** | Flexible | Variable | Lower upfront | Slower | Requires parties' agreement on every procedural step |

**2024-2025 Statistics**:
- ICC handled USD 102 billion in dispute value (2024) — nearly doubled from 2023
- Over one-third of ICC cases involve amounts under USD 3 million
- SIAC emergency arbitration requests increased 51% (2023→2024)

#### Recommended Language for Contracts

**For goods sale, manufacturing, or supply**:
```
"Arbitration: Any dispute shall be finally settled by arbitration under 
the ICC Rules of Arbitration (current edition), administered by the 
International Court of Arbitration.

Seat of Arbitration: Singapore [or LCIA/SIAC/HKIAC]
Language of Arbitration: English
Number of Arbitrators: [1 (if <$1M in dispute) / 3 (if >$1M)]
Law Applicable: [Substantive law selected above; procedural law of seat]
Costs: Each party bears own counsel costs; arbitrator fees & administrative 
costs split equally unless arbitrator awards otherwise based on outcome."
```

**Why Singapore over other seats**:
- No sanctions on Russia (unlike London/Paris) — useful if trade involves parties from neutral countries
- Modern arbitration law, 2025 SIAC rules now in effect with emergency arbitrator ex-parte relief
- 12-hour flight from Asia, Europe, Middle East (key trade hubs)
- English-language courts, low corruption

**Why ICC over LCIA for global trade**:
- Dominant institution for mid-size to large disputes ($5M+)
- More experience with multi-party, commodity, and sanctions-adjacent disputes
- Stricter procedural control (can reduce back-and-forth delays)

**Why SIAC for Asia-Pacific suppliers**:
- Growing preferred seat for Asia-based parties
- 2025 rules now allow emergency arbitrator to grant interim relief ex parte (faster injunctions)
- Lower costs than ICC/LCIA for disputes under $5M

---

### Option 3: Mediation

**Use pre-arbitration or pre-litigation**:
```
"Mediation: Before initiating arbitration, parties shall attempt 
good-faith mediation for 30 days under [ICC Mediation Rules / CEDR Model].
Mediation communications are confidential and inadmissible in later proceedings."
```

**Cost**: $20K–$100K (much cheaper than arbitration).
**Timeline**: 2-6 weeks.
**Success rate**: 60-70% for commercial disputes.

**Recommended when**: Ongoing business relationship, salvageable deals, cost-sensitive parties.

---

## V. SANCTIONS AND EXPORT CONTROL COMPLIANCE

*[VETO]* — **All items in this section are non-negotiable.**

### U.S. OFAC Sanctions

**Office of Foreign Assets Control** (Department of Treasury) administers sanctions programs blocking transactions with:

- **Specially Designated Nationals (SDN) list** — Individuals, companies, vessels, aircraft linked to sanctioned countries/terrorism/narcotics.
- **Consolidated Sanctions List** — Merged list combining SDN + sectoral sanctions.
- **Blocked Countries** (as of 2024): Iran, North Korea, Syria, Russia (sectoral), Cuba (sectoral), Venezuela (sectoral), Belarus (sectoral).

**Required Actions**:

1. **Screen EVERY transaction**:
   - Check counterparty (buyer, seller, intermediate), shipper, consignee, end-user against:
     - OFAC SDN list ([https://ofac.treasury.gov/sanctions-programs-and-country-information](https://ofac.treasury.gov/sanctions-programs-and-country-information))
     - BIS Entity List (dual-use goods): [https://www.bis.doc.gov/](https://www.bis.doc.gov/)
     - DDTC ITAR Debarred List (defense articles)
   - Use automated screening tools (licensed vendors).
   - Document screening results.

2. **Know Your Customer (KYC)**: Obtain beneficial ownership, end-use declarations, bank statements (basic due diligence).

3. **Risk-Based Controls**: 
   - New/unknown customers: 90% upfront payment or Letter of Credit required.
   - Transactions involving dual-use goods: End-user certificate required.
   - Countries with elevated risk (Russia, Belarus, Iran intermediaries): Enhanced KYC, legal holds, possible declination.

4. **Penalties for Violation** (as of 2024):
   - Violations up to **$250,000 per violation** or 20% of transaction value, **whichever is higher**.
   - Criminal prosecution possible: **Up to 20 years imprisonment + fines**.
   - Both company and individual officers can be prosecuted.

**2024 OFAC Guidance** (March 6, 2024, DOJ/OFAC/BIS joint statement):
- US sanctions apply to **non-US persons** engaging in prohibited conduct.
- Foreign subsidiaries of US companies must comply with OFAC.
- US persons cannot facilitate sanctions evasion (even indirectly).

---

### U.S. Export Controls: EAR vs. ITAR

**Two separate, overlapping regimes governed by different agencies:**

#### **EAR (Export Administration Regulations)**

- **Agency**: Bureau of Industry and Security (BIS), Department of Commerce
- **Coverage**: Dual-use items (commercial goods with potential military application), encryption, technical data
- **Classification**: Each item gets an **Export Control Classification Number (ECCN)** per Commerce Control List (CCL)
- **Common ECCNs in trade**:
  - 3A001 (semiconductors, high-performance computers)
  - 4A003 (encryption software)
  - 1A002 (certain materials, mineral processing equipment)
  - 9A012 (certain sensors, test equipment)
- **EAR99**: Items not on CCL; still regulated (no license needed for most uses).

**License Requirement Depends On**:
- Item classification (ECCN)
- End-user (military, government research, state-owned enterprise?)
- End-use (civilian, military, nuclear, missiles?)
- Destination country (allies vs. restricted countries)

**License Denial Grounds**:
- Destination = Iran, North Korea, Syria, Belarus, Russia
- End-user on Denied Parties List (BIS, State)
- Military or prohibited end-use detected

**Penalties**:
- Civil: Up to $50,000 per violation (2024 rates)
- Criminal: Up to 20 years + $1M fines

#### **ITAR (International Traffic in Arms Regulations)**

- **Agency**: Directorate of Defense Trade Controls (DDTC), Department of State
- **Coverage**: Defense articles (weapons, military components, tactical gear), technical data
- **Classification**: Items on **United States Munitions List (USML)**
- **Common ITAR items in trade**: 
  - Weapons, ammunition
  - Armor, body protection
  - Optical/targeting systems
  - Satellites, drone components
  - Certain encryption for defense
  - Defense contractor blueprints/specs

**Key ITAR Requirement**: Even **technical data** (drawings, specs, source code) for ITAR items requires export license. Sharing with foreign national = export.

**License Requirement**: **Presumed required unless exemption applies** (e.g., parts sent to Canadian/UK allies under NOFORN exemption).

**Penalties**:
- Civil: Up to $500,000 per violation
- Criminal: Up to 20 years + $1M fines

---

### End-User Certificates

*[VETO]* — Required for any dual-use goods export to non-allied countries.

**Definition**: Signed statement from importer's government certifying the end-use and that goods will not be diverted.

**When Required**:
- Export of controlled dual-use items (EAR, certain ECCN codes)
- Destination = Middle East, Southeast Asia, Africa, China, Russia
- Value typically >$50K

**Format**:
- Issued by foreign government's trade/customs authority
- Must state: importer name, item description, quantity, end-use, assurance of no diversion
- Typically valid 12 months

**Process**:
1. Exporter provides item description, technical specs, quantity to buyer
2. Buyer submits application to its government trade authority
3. Government issues certificate (2-8 weeks typical)
4. Buyer provides copy to exporter
5. Exporter reviews and confirms government match, signature, terms
6. Only then does export proceed

**Vetting**: Exporter must verify certificate authenticity (contact issuing government if uncertain).

---

### U.S. Sanctions on Russia, Belarus, & Iran (2024 Status)

**Russia**:
- Sectoral sanctions on energy, finance, aviation (banned post-2022)
- OFAC SDN list includes Russian oligarchs, state-owned enterprises, military contractors
- **Prohibited**: Direct goods sales to Russia (except humanitarian exception); financial transactions; services
- **Screening**: Higher scrutiny; assume "Russia" transaction is prohibited unless explicitly exempted

**Belarus**:
- Secondary sanctions for supporting Russia
- Sectoral sanctions like Russia
- **Screening**: Route through Belarus suspicious; screen for Belarusian ownership

**Iran**:
- Comprehensive sanctions (exception: JCPOA negotiations have no current carve-out; Trump administration reimposed 2024)
- No oil, finance, aviation
- Limited humanitarian/humanitarian carve-out (food, medicine)
- **Screening**: Any Iran connection likely disqualifying

---

### EU Sanctions (Parallel to OFAC)

**EU maintains separate sanctions list** administered by the Council:
- Covers sanctions on Russia, Iran, North Korea, Syria, Venezuela, Belarus
- Individual names, entities, vessels, aircraft
- Updated regularly; list overlaps but differs from OFAC SDN

**Check**: [https://webgate.ec.europa.eu/europeana/sanctions/screen](https://webgate.ec.europa.eu/europeana/sanctions/screen)

**Penalty**: Up to €1M + criminal prosecution for EU persons.

**For international companies**: If selling to EU-based buyer, must comply with BOTH OFAC and EU sanctions.

---

### UN Security Council Sanctions

**Applied via UN resolutions** (binding on all member states). Covers:
- North Korea, Iran, Syria, Somalia, Sudan, Liberia, Côte d'Ivoire, DRC (selective)

Broadly overlaps with US sanctions but occasionally diverges. **Check**: [https://www.un.org/securitycouncil/sanctions](https://www.un.org/securitycouncil/sanctions)

---

## VI. ANTI-CORRUPTION COMPLIANCE

*[VETO]* — Both laws apply to any company with connection to US or UK jurisdiction.

### U.S. Foreign Corrupt Practices Act (FCPA)

**Applies to**:
- US companies and citizens (anywhere in world)
- Foreign companies trading securities on US exchanges
- Any person who acts in furtherance of FCPA violation while in US territory

**Prohibited**:
- Offering, promising, or giving anything of value to a foreign government official to obtain/retain business or secure improper advantage
- Includes direct bribes, kickbacks, consulting fees disguised as bribes, gifts/travel above reasonable hospitality

**Example (FCPA Violation)**:
- Selling machinery to a foreign government entity
- Sales rep offers "consulting fee" to official's brother's company (not for consulting, but to influence purchase)
- **Violation**, criminal prosecution

**Example (Acceptable)**:
- Sales rep pays government official's reasonable travel to visit factory, attends dinner
- Official's family travels but at company expense (within reason: economy flights, moderate hotel)
- **Likely acceptable** if documented and reasonable

**Enforcement** (2023–2024):
- DOJ Fraud Section + SEC Enforcement Division
- Record penalties: 2023 saw multi-hundred million dollar settlements (e.g., SoftBank $100M+ FCPA settlement)

**Internal Controls Required**:
- Compliance training for sales/business development staff
- Pre-transaction due diligence on foreign agents, consultants, government liaisons
- Written policies prohibiting gifts above [e.g., $100] to government officials
- Regular audits of gifts, travel, entertainment expenses
- Whistleblower hotline

**Penalties**:
- Company: Up to $2M+ per violation + disgorgement of profit
- Individuals: Up to 5 years imprisonment + $250K fines per violation

---

### UK Bribery Act 2010

**Broader scope than FCPA**:
- Applies to any company operating in UK (non-UK companies included if UK nexus)
- Covers bribes to **private parties**, not just government officials
- Corporate offense: Company liable for bribery by ANY employee/agent if "reasonable procedures" not in place
- Individual offense: Offering/requesting/receiving bribes (up to 10 years prison + unlimited fines)

**Four Main Offenses**:
1. Offering/promising bribe to any person
2. Requesting/agreeing to receive bribe
3. Bribing foreign public official
4. **Corporate failure to prevent bribery** — Company strictly liable unless shows "reasonable procedures"

**Defenses for Company**:
- Adequate commercial bribery prevention procedures in place
- Training, monitoring, enforcement
- Regular audits

**Enforcement** (2024):
- UK Serious Fraud Office (SFO)
- Enforcement increasing; recent cases target SMEs, not just multinationals

---

### Risk-Mitigation Practices for International Trade

1. **Due Diligence on Agents/Distributors**:
   - Who is the sales agent or local distributor?
   - Verify ownership, reputation, regulatory clearance
   - PEP (Politically Exposed Person) screening: Is owner/key staff related to government officials?
   - Obtain references from other clients/banks

2. **Written Contracts with Clear Terms**:
   - Specify commission/fee is for legitimate sales, marketing, representation only
   - Prohibit use of funds for bribes
   - Audit rights (company can inspect use of funds)
   - Termination for breach

3. **Gifts and Entertainment Policy**:
   - Cap: $100–$500 per person per year (depends on jurisdiction; UK lower)
   - Prohibit gifts to government officials unless routine hospitality
   - Document all gifts (log, approval, business purpose)
   - Exclude cash, gift cards

4. **Training**:
   - Annual FCPA/Bribery Act training for sales, BD, finance staff
   - Case studies of violations (e.g., foreign official's family receiving benefits)
   - Certification of completion

5. **Red Flags — Do Not Proceed Without Legal Review**:
   - Request for unusually high commissions (>10–15% typical)
   - Demand for cash payments or offshore accounts
   - Request for payment via third party unrelated to transaction
   - "Facilitation payments" (bribes for routine services)
   - Insistence on specific agent even if unqualified
   - Government official or family member owns distributor

---

## VII. DATA PRIVACY IN INTERNATIONAL TRADE

### GDPR (General Data Protection Regulation) — EU

**Applies to**:
- Any organization (regardless of location) processing personal data of EU/EEA residents
- Includes B2B: emails, vendor contact info, employee data of EU partners

**Scope**:
- **Personal data** = Any info about identified/identifiable individual (name, email, IP address, transaction history)
- **Processing** = Collection, storage, transmission, analysis, deletion
- **Data Subject** = The individual

**Key Obligations**:

| Obligation | Requirement |
|---|---|
| **Lawful Basis** | Must have one: consent, contract, legal obligation, vital interest, public task, or legitimate interest (must balance against individual privacy) |
| **Privacy Notice** | Provide data subject privacy policy before collecting (what data, how long kept, rights) |
| **Data Subject Rights** | Access, correction, deletion ("right to be forgotten"), portability, object to processing |
| **DPA (if needed)** | If "high-risk" processing (e.g., cross-border AI), conduct Data Protection Impact Assessment |
| **Data Transfer** | To non-EU: Use adequacy decision OR Standard Contractual Clauses (SCCs) with appropriate safeguards |
| **Breach Notification** | Notify authorities + affected individuals within 72 hours of discovering breach affecting >risk |
| **Data Retention** | Keep data only as long as necessary for stated purpose; delete/anonymize after |

**Penalties**:
- Up to **€20 million or 4% of global annual revenue**, whichever is higher (for serious breaches)
- Warnings for minor violations

**2024 Updates**:
- AI training on personal data requires lawful processing + transfer safeguards (EDPB 2024 opinion)
- Cross-border transfers to US remain under scrutiny (Schrems II decision; Standard Contractual Clauses still valid but require supplementary measures for non-adequacy countries)

---

### Cross-Border Data Transfers

**Restricted Transfer Paths** (from EU to outside EEA):

1. **Adequacy Decision** — EU Commission deemed country has equivalent privacy law (Canada, Japan, South Korea, etc.)
   - Simplest path; minimal overhead
   - Scarce; US not on list

2. **Standard Contractual Clauses (SCCs)** — Contractual terms binding exporter/importer to GDPR standards
   - Required for most non-adequacy countries (including US)
   - Must supplement with **additional technical/organizational measures** (encryption, access controls, no government access)
   - Schrems II ruling: SCCs alone insufficient for US; need supplementary safeguards

3. **Binding Corporate Rules (BCRs)** — Internal data governance within multinational group
   - Requires approval by EU regulators
   - Expensive; for large groups

**For international trade company**:
- Transferring EU supplier/partner contact data to US HQ? **SCCs + supplementary measures required.**
- Sending EU customer purchase history for analytics? **SCCs + anonymization/pseudonymization preferred.**

**Recommendation**: 
- Add GDPR-compliant data transfer addendum to contracts with EU partners
- Use model SCCs (EU published templates)
- Document supplementary safeguards (encryption in transit/rest, access logs, third-party audit)

---

### CCPA / State Privacy Laws (US)

**California Consumer Privacy Act (CCPA)** — Applies to for-profit businesses collecting personal data of California residents if:
- Annual revenue >$25M, **OR**
- Buys/sells personal data of 100K+ individuals/households, **OR**
- Derives 50%+ revenue from selling consumers' personal data

**Key Rights**:
- Right to know: What personal data is collected?
- Right to delete: Remove my personal data
- Right to opt-out: Do not sell/share my personal data
- Right to non-discrimination: Don't penalize me for exercising rights

**Privacy Notice Requirement**: Clear disclosure before collection of what data is collected, how it's used, consumer rights.

**Penalties**: $2,500 per unintentional violation, $7,500 per intentional violation.

**2024–2025 Expansion**: 20+ states now have comprehensive privacy laws (Florida, Texas, Oregon, Montana, etc.); most effective in 2024–2025. Similar to CCPA.

---

### Website Privacy Policy Checklist (GDPR + CCPA + State Laws)

*[VETO]* — Privacy policy must be:

1. **Visible and Accessible** — Link on home page, footer, before data collection
2. **Plain Language** — Comprehensible to non-lawyers (audit readability score >60)
3. **Specific**:
   - What data do you collect? (Name, email, purchase history, IP, cookies, etc.)
   - Who collects? (Company, third-party vendors, analytics)
   - How long retained?
   - Legal basis (EU: consent, contract, legitimate interest, etc.)
   - Recipient countries/transfers
   - How to exercise rights (access, deletion, opt-out)

4. **For EU Users**: Mention GDPR, data subject rights, DPA contact

5. **For CA Users**: Mention CCPA rights, opt-out mechanism, do-not-sell list

6. **Cookie Notice**: Disclose third-party cookies (Google Analytics, Facebook Pixel, etc.)

---

## VIII. INTELLECTUAL PROPERTY IN INTERNATIONAL TRADE

### Counterfeiting Risks

**Scale of problem** (2024): Counterfeit trade estimated at **$2 trillion USD annually** globally.

**Vulnerability for traders**:
- Purchasing counterfeit goods unknowingly and reselling
- Importing goods infringing third-party trademarks/patents
- Using gray-market goods (legitimate product but diverted from authorized channel)
- Liability: Can face seizure, fines, civil suits from IP holders

### TRIPS Agreement (WTO)

**Trade-Related Aspects of Intellectual Property Rights** — Binding on all WTO members (160+ countries).

**Key Enforcement Rules**:
- Criminal penalties for willful trademark counterfeiting/copyright piracy on commercial scale
- Customs authorities can seize counterfeit/pirated goods at borders
- Civil remedies: Injunctions, damages, seizure of goods

---

### Protecting IP in Contracts

**Essential clauses**:

1. **Warranty of Non-Infringement** (Seller to Buyer):
   ```
   "Seller warrants that goods do not infringe any patent, trademark, 
   copyright, or other IP right of any third party, and Seller has 
   right to grant all rights herein."
   ```

2. **Indemnification** (Seller protects Buyer):
   ```
   "Seller indemnifies Buyer against any third-party IP infringement 
   claims arising from Buyer's authorized use of goods, including 
   defense costs and damages. Seller may modify goods to avoid infringement 
   or procure right to use."
   ```

3. **Confidentiality of Trade Secrets**:
   ```
   "Buyer shall not reverse-engineer, disassemble, or disclose Seller's 
   manufacturing processes, specifications, or formulations. This 
   confidentiality survives termination for [X years, typically 3-5]."
   ```

4. **Ownership of IP**:
   ```
   "All intellectual property in goods, including patents, designs, 
   trademarks, is owned by Seller or licensed to Seller. Buyer's purchase 
   grants no license to modify, adapt, or create derivative works without 
   Seller's written consent."
   ```

---

### Import/Export Considerations

**Gray-Market Goods** (legitimate products, unauthorized channel):
- Often imported from countries with lower prices (India, China) and resold in higher-priced markets (US, EU)
- May violate IP owner's territorial licensing or create warranty issues
- Risk: IP owner can sue importer for contributory infringement or demand seizure

**Counterfeit Goods** (fake products):
- Import/export = criminal offense (potential imprisonment)
- Customs can seize; both importer and seller liable

**Diversion Risk**: 
- Goods sold to wholesaler; wholesaler diverts to unauthorized channels
- Contract should require end-user certification and audit rights

**Mitigation**:
- Require warranty from supplier of non-infringement
- Request certificates of authenticity for luxury goods
- Conduct IP searches before importing unknown brands
- Audit end-use by distributors/resellers

---

## IX. WEBSITE LEGAL REQUIREMENTS

*[VETO]* — Website must include these items before launching.

### 1. **Terms of Service (Terms & Conditions)**

**Must cover**:
- **Product descriptions & accuracy** — Specify tolerances, disclaimers for variations (e.g., "color may vary +/- 5%")
- **Pricing & availability** — Reserve right to refuse orders, change prices, note if out of stock
- **Payment terms** — Accepted methods, currency, when charged (at order vs. shipment)
- **Shipping & delivery** — Shipping timelines (estimated vs. guaranteed), risk of loss, who pays shipping
- **Returns & refunds** — Window for return (e.g., 30 days), condition, restocking fee if any, refund timeline, who pays return shipping
- **Warranties** — **AS-IS disclaimer** for goods (unless selling with warranty); limit to repair/replacement
- **Liability limitation** — "We are not liable for indirect, consequential damages; liability capped at price paid"
- **Limitation on use** — "For personal use only" if applicable; no resale, no commercial use without permission
- **Governing law & dispute resolution** — Choose jurisdiction (recommend Delaware, New York, or Singapore for neutrality)
- **Third-party links** — Disclaimer that links to other sites are not endorsed
- **Product safety** — If selling food, chemicals, electronics: Compliance disclaimers (FDA, CE marks, safety certifications)
- **Indemnification** — User indemnifies you for claims arising from user's misuse

**Drafting Note**: Avoid overly broad or unenforceable disclaimers (courts disfavor "we are never liable for anything"). Balance: Legitimate limitation is OK; one-sided exculpation will be struck.

### 2. **Privacy Policy**

See Section VII (GDPR & CCPA requirements above).

**Additional elements**:
- **Cookie disclosure** — List third-party tools (Google Analytics, Stripe, Facebook Pixel) and purpose (tracking, payment processing, advertising)
- **Do Not Track (DNT) signals** — State whether you honor DNT (optional but recommended: "We honor DNT signals where technically possible")
- **Cookie consent** — EU GDPR requires **explicit consent** for non-essential cookies before placing them. US CCPA requires **opt-out** disclosure.

### 3. **E-Commerce Specific**

**For international e-commerce**:

| Requirement | Detail |
|---|---|
| **Currency Disclosure** | Clearly state price in correct currency (€, £, ¥, USD) before checkout |
| **Tax/Tariff Disclosure** | If selling internationally, state "Taxes/duties may apply at delivery (paid by buyer)" or "Total price including VAT"; avoid surprise charges |
| **Return Policy** | Specify return costs (who pays shipping?), timelines, conditions. For international: 14-30 days typical; international return shipping often buyer's cost |
| **Dispute Resolution** | Recommend arbitration or small claims for B2C (litigation too expensive for consumer disputes) |
| **ADA Compliance** | Website must be accessible to disabled users (WCAG 2.1 AA standard). Failure to comply = ADA Title III violation (litigation risk, no cap). |

### 4. **Specific Disclaimers by Industry**

**For commodities/bulk goods sales**:
```
"Goods sold in bulk ('as-is'). Buyer responsible for inspection. 
Claims for defect (quality, weight, moisture content) must be submitted 
within [X days] of delivery with lab test results. Late claims forfeited."
```

**For trade financing (Letter of Credit, payment terms)**:
```
"We accept payment by Letter of Credit (UCP 600), wire transfer, or 
credit card. For LC: Discrepancies may delay or prevent payment; 
buyer responsible for remedy. We make no warranty that buyer's bank 
will honor LC."
```

**For services (consulting, brokering)**:
```
"Services provided 'as-is.' We make no warranty of outcome or profit. 
You assume all risk of market changes, tariff changes, regulatory changes. 
Our liability limited to fees paid."
```

### 5. **GDPR Compliance for EU Customers**

If you collect data from EU users:

```
Privacy & Data Rights (GDPR):

- Legal Basis: Processing is based on [your consent / our contract with you 
  / our legitimate business interest in fulfilling orders].
- Data Rights: You have the right to access, correct, delete, or port your 
  personal data. Submit requests to [legal@company.com].
- Data Transfers: Your data may be transferred outside the EU for processing. 
  We use Standard Contractual Clauses and encryption to protect your data.
- DPA: Our Data Protection Authority is [your country]. You may lodge a complaint 
  with your local data protection authority.
```

### 6. **CCPA Compliance for California Customers**

If you collect data from CA residents:

```
California Consumer Rights (CCPA):

- You have the right to know what personal data we collect about you
- You have the right to delete personal data we hold
- You have the right to opt out of sale or sharing of your personal data
- You have the right to non-discrimination for exercising these rights

To submit a request: [email/portal]. We will respond within 45 days.
```

### 7. **Accessibility & Language**

- **Plain Language**: Readability score ≥ 60 (Flesch Kincaid); avoid legal jargon where possible
- **Multi-language**: If serving international customers, offer ToS/Privacy in major languages (at minimum: EN, ES, FR, DE, ZH for Asia-Pacific)
- **Mobile-Friendly**: ToS must be readable on mobile; no auto-scroll walls of text

---

## X. ATTORNEY VETO ITEMS

**The attorney automatically vetoes the following without escalation to counsel:**

| Item | Veto Rule | Reason |
|---|---|---|
| **Sanctions violation** | AUTOMATIC STOP — Do not process order, do not collect payment, do not ship. Notify attorney immediately. | Criminal liability, OFAC penalties up to $250K+; sanctions are strict liability. |
| **ITAR defense article export** | AUTOMATIC STOP — Do not export without DDTC license. Do not ship to foreign national. | 20-year prison + $1M fine. ITAR violations are felonies. |
| **End-user misrepresentation** | AUTOMATIC STOP — Do not proceed if buyer states false end-use or diversion is suspected. | Export control violation + possible financing fraud; criminal. |
| **FCPA/UK Bribery Act red flag** | AUTOMATIC STOP — Do not pay requested "facilitation fee," agent commission >15%, or cash payment. Escalate to counsel. | Criminal offense; individual + company liable. |
| **Counterfeit goods suspected** | AUTOMATIC STOP — Do not import/sell. Verify authenticity with IP holder if in doubt. | Criminal import violation; seizure + fines. |
| **IP infringement suspected** | FLAG & ESCALATE — Do not sell until counsel confirms non-infringement or insurance available. | Contributory infringement liability; damages + injunction possible. |
| **Data breach (GDPR/CCPA)** | AUTOMATIC ESCALATION to counsel + notify DPA within 72 hours. Do not attempt cover-up. | Regulatory fines up to €20M or 4% revenue; willful non-reporting increases penalties. |
| **Customer in EU, no GDPR compliance** | AUTOMATIC STOP — Do not collect personal data (name, email, address) without privacy notice + lawful basis. | GDPR fine up to €20M or 4%. |
| **Forced arbitration clause (B2C)** | VERIFY enforceability — US consumers may challenge forced arbitration (Discover Bank doctrine); EU consumers may have mandatory jurisdiction. | Court may void clause, leaving dispute in litigation. |
| **Payment dispute under $100K, EU buyer** | ESCALATE — EU consumer protection law may prohibit arbitration clauses; default is EU national court jurisdiction. | Arbitration clause may be void if consumer initiates dispute. |

---

## XI. QUICK-REFERENCE CHECKLIST: BEFORE SIGNING ANY INTERNATIONAL CONTRACT

### Pre-Signature

- [ ] **Counterparty screening**: Run OFAC/BIS/DDTC/EU sanctions lists. Check for PEP (politically exposed persons). Verify beneficial ownership if corporate buyer.
- [ ] **CISG status**: Confirm whether CISG applies (both parties in signatory countries?) and whether to exclude it.
- [ ] **Governing law & jurisdiction**: Chosen? Recommend New York law + LCIA/SIAC arbitration (neutral, fast).
- [ ] **Force majeure**: Included? Use ICC 2020 clause or reference.
- [ ] **Payment terms**: Specified? Letter of Credit required? Upfront deposit for new buyer?
- [ ] **Incoterm**: Explicitly stated? (E.g., "FOB Shanghai," "CIF New York")
- [ ] **Warranties & disclaimers**: AS-IS language included? Limits on liability stated?
- [ ] **Inspection/acceptance window**: Specified timeline for claims? (E.g., "Claims within 30 days of delivery")
- [ ] **Sanctions/export control reps**: Included? Both parties warrants non-OFAC, non-denied party, non-prohibited end-use.
- [ ] **Indemnification**: IP indemnity present? Export control indemnity?
- [ ] **Confidentiality**: Non-disclosure clause? Survival period stated?
- [ ] **Termination**: Conditions for termination spelled out? Survival items listed?
- [ ] **Dispute resolution**: Arbitration clause complete with seat, institution, language, number of arbitrators?

### Post-Signature (Before Shipment)

- [ ] **KYC due diligence**: Obtain buyer/distributor corporate registration, beneficial owner ID, bank reference.
- [ ] **End-use cert**: If dual-use goods, request end-user certificate from buyer's government.
- [ ] **Sanctions screening**: Final screening 24 hours before payment/shipment.
- [ ] **Export license check**: ECCN classification complete? License required? Application submitted?
- [ ] **Insurance**: Cargo insurance arranged? Incoterm requires it (CIF, CIP)?
- [ ] **Documentation**: Commercial invoice, packing list, certificates of origin ready? (For LC, must match exactly.)
- [ ] **Payment received**: Confirm wire/LC funds cleared before releasing goods.

---

## XII. KEY LEGAL SOURCES & REFERENCES

**UNCITRAL & International Law**:
- UNCITRAL CISG: [https://uncitral.un.org/en/texts/salegoods/conventions/sale_of_goods/cisg](https://uncitral.un.org/en/texts/salegoods/conventions/sale_of_goods/cisg)
- UNIDROIT Principles: [https://www.unidroit.org/publications/prolix-unidroit-principles/](https://www.unidroit.org/publications/prolix-unidroit-principles/)

**Trade & Dispute Resolution**:
- ICC Rules: [https://iccwbo.org/dispute-resolution-services/arbitration/](https://iccwbo.org/dispute-resolution-services/arbitration/)
- LCIA: [https://www.lcia.org/](https://www.lcia.org/)
- SIAC: [https://www.siac.org.sg/](https://www.siac.org.sg/)
- Incoterms 2020: [ICC (iccwbo.org)](https://iccwbo.org/)

**Sanctions & Export Controls**:
- OFAC: [https://ofac.treasury.gov/](https://ofac.treasury.gov/)
- BIS EAR: [https://www.bis.doc.gov/index.php/regulations/export-administration-regulations-ear](https://www.bis.doc.gov/index.php/regulations/export-administration-regulations-ear)
- DDTC ITAR: [https://www.pmddtc.state.gov/](https://www.pmddtc.state.gov/)
- EU Sanctions: [https://ec.europa.eu/info/business-economy-euro/banking-and-finance/international-relations-and-finance/sanctions-policy_en](https://ec.europa.eu/info/business-economy-euro/banking-and-finance/international-relations-and-finance/sanctions-policy_en)

**Anti-Corruption**:
- US DOJ FCPA: [https://www.justice.gov/criminal-fraud/foreign-corrupt-practices-act](https://www.justice.gov/criminal-fraud/foreign-corrupt-practices-act)
- UK SFO Bribery Act: [https://www.sfo.gov.uk/](https://www.sfo.gov.uk/)

**Data Privacy**:
- GDPR Full Text: [https://gdpr-info.eu/](https://gdpr-info.eu/)
- EDPB (EU Data Protection Board): [https://www.edpb.europa.eu/](https://www.edpb.europa.eu/)
- CCPA: [https://oag.ca.gov/privacy/ccpa](https://oag.ca.gov/privacy/ccpa)

**IP & Trade Remedies**:
- WIPO (World Intellectual Property Organization): [https://www.wipo.int/](https://www.wipo.int/)
- WTO TRIPS: [https://www.wto.org/english/tratop_e/trips_e/trips_e.htm](https://www.wto.org/english/tratop_e/trips_e/trips_e.htm)
- US Trade Remedies: [https://www.trade.gov/us-antidumping-and-countervailing-duties](https://www.trade.gov/us-antidumping-and-countervailing-duties)

---

## FINAL NOTE

**This is a reference guide, not legal advice.** Specific transactions, jurisdictions, and counterparties may introduce novel legal issues. 

**When to escalate to external counsel**:
- Novel regulatory question (e.g., Is [product X] controlled under EAR or ITAR?)
- Sanctions/export control doubt
- IP infringement risk
- Material breach or dispute
- Significant financial exposure (>$1M)
- Negotiating with state-owned enterprises or government agencies
- EU GDPR data transfer complexity
- Anything marked *[VETO]* above

**Document everything.** Keep records of:
- Sanctions screening results & dates
- KYC due diligence (buyer docs, ownership verification)
- End-user certificates
- Export license applications/approvals
- Contract review notes
- Dispute communications

These records protect the company in enforcement investigations and disputes.

---

**Last Updated**: April 2026  
**Next Review**: April 2027 (or upon major regulatory change)
