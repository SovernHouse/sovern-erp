# Email Deliverability Specialist — Sovern House

**Last Updated:** 2026-04-17
**Applies to:** All email sending from Sovern House — transactional (RFQ responses, order confirmations, shipping updates), one-to-one commercial, nurture, and especially cold outbound. The #1 goal of this skill: keep `sovernhouse.co` out of spam folders and off blacklists, protecting the brand's most valuable digital asset — its domain reputation.

---

## I. Why This Skill Exists — The Stakes

A burned domain is a business-level disaster. Once `sovernhouse.co` lands on a major blacklist (Spamhaus, SpamCop, Barracuda), every email from every user on that domain goes to spam — RFQ confirmations, supplier comms, bank communications, legal notices. Recovery takes weeks to months, sometimes longer.

Trade businesses burn their primary domain in three common ways:
1. **Sending cold outreach from their primary domain** (by far the #1 cause)
2. **Launching outbound before the domain is warmed**
3. **Sending to unverified email lists** (bounces, spam traps, honeypots)

This skill's job is to prevent all three, every time. Zero exceptions.

**Rule 0:** The primary domain `sovernhouse.co` is for business communication with people who already know who we are. Cold outreach goes via a separate, sacrificial sending domain. Always.

---

## II. Domain Architecture — The Correct Setup

### Primary business domain: `sovernhouse.co`

**Purpose:** Business email for Alex and the team. Receives inbound RFQs. Replies to existing customers, suppliers, banks, regulators.

**What never happens on this domain:**
- No cold outreach (ever)
- No bulk marketing sends
- No list-based "nurture" blasts (case-by-case only)
- No sending from anything other than properly-authenticated Google Workspace

**Required records on sovernhouse.co DNS:**
- MX records pointing to Google Workspace
- SPF (TXT): `v=spf1 include:_spf.google.com ~all`
- DKIM: Generated in Workspace Admin → Gmail → Authenticate email. Copy the TXT record value to DNS.
- DMARC (TXT): Start at `v=DMARC1; p=none; rua=mailto:dmarc@sovernhouse.co; pct=100`. Monitor 4–8 weeks. Progress to `p=quarantine`, then `p=reject` once clean.
- MTA-STS (optional but recommended): enforces TLS delivery
- BIMI (optional, later): displays logo in Gmail inbox

### Secondary sending domain(s): for cold outbound only

**Purpose:** Sacrificial. If Gmail/Outlook flag it as spam, the primary brand domain is unaffected.

**Options (pick one pattern, apply consistently):**
- **Plural / hyphenated variant:** `sovern-house.co`, `sovernhouse.email`, `sovernhouse-mail.com`
- **Brand-prefix variant:** `gosovernhouse.com`, `trysovern.com`, `hellosovern.com`
- **Functional domain:** `sovern-sourcing.com`, `sovernhouseco.com`

**Do NOT use:**
- `.xyz`, `.info`, `.biz` TLDs — disproportionately flagged by spam filters
- Numeric domains (`sovernhouse1.com`) — look like spam automation
- Lookalike misspellings that confuse buyers

**Pattern:**
- Register 2–3 secondary domains (one active, others in reserve for future campaigns or if one burns)
- 301 redirect all of them to sovernhouse.co so a prospect clicking the domain lands on the real brand
- Each sending domain hosts 2–5 inboxes maximum: `alex@`, `sales@`, `sourcing@`, etc.
- Each inbox sends max ~30 emails/day at mature volume (warmed up)
- 3 inboxes × 30/day = 90/day safely per sending domain

### Scaling architecture (once campaign is proven)

- Primary domain: unchanged
- Sending domain A: alex@, sales@, sourcing@ (3 inboxes × 30 = 90/day)
- Sending domain B (new, warmed): alex@, sales@, partnerships@ (3 × 30 = 90/day)
- **Total safe cold capacity: 180/day, distributed**

If you need more than 500/day of cold outbound you need more domains; if you need more than 2,000/day of cold outbound we're building a spam empire, not a buying house — stop.

---

## III. Email Authentication — SPF, DKIM, DMARC

These are the three pillars. Missing any one = emails will be filtered or rejected. Google **enforced DMARC for bulk senders** in Feb 2024; all major receivers now treat unauthenticated mail as suspicious.

### SPF (Sender Policy Framework)

**What it does:** Tells receivers "these servers are allowed to send email from my domain."

**Sovern House primary domain SPF record:**
```
v=spf1 include:_spf.google.com ~all
```

**Secondary sending domain SPF record** (when using Instantly/Smartlead/Lemlist SMTP):
```
v=spf1 include:_spf.google.com include:[sending-tool-spf-domain] ~all
```

- Maximum of 10 DNS lookups per SPF record (the "10-lookup limit"). Consolidate includes if you exceed.
- Use `~all` (softfail) during setup, progress to `-all` (hardfail) once confident nothing legitimate is being missed.

### DKIM (DomainKeys Identified Mail)

**What it does:** Cryptographically signs each outbound email. Receivers verify the signature to confirm it wasn't tampered with and that the sender is authorized.

**Setup in Google Workspace:**
1. Admin Console → Apps → Google Workspace → Gmail → Authenticate email
2. Select the domain, click "Generate new record"
3. Copy the 2048-bit TXT record (host: `google._domainkey`)
4. Add to your DNS
5. Wait 24–48 hours for propagation
6. Return to Admin → Start authentication

**Verify DKIM is working:**
- Send a test email to a Gmail address
- Open it, click ⋮ → Show original
- Look for `DKIM: PASS` and `SIGNED BY: sovernhouse.co`

### DMARC (Domain-based Message Authentication, Reporting & Conformance)

**What it does:** Tells receivers what to do when SPF/DKIM fail (pass, quarantine, or reject), and gives you reports on who's sending from your domain (legitimate and fraudulent).

**Staged rollout (critical — don't skip stages):**

1. **Stage 1 — Monitor only (4–8 weeks minimum):**
   ```
   v=DMARC1; p=none; rua=mailto:dmarc@sovernhouse.co; pct=100
   ```
   Read the reports. Identify all legitimate senders (Workspace, Instantly, our ERP, any SaaS tools sending on our behalf).

2. **Stage 2 — Quarantine (4 weeks minimum):**
   ```
   v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc@sovernhouse.co
   ```
   Route 25% of failures to spam. Monitor for false positives. Gradually increase `pct` to 100.

3. **Stage 3 — Reject:**
   ```
   v=DMARC1; p=reject; pct=100; rua=mailto:dmarc@sovernhouse.co
   ```
   Reject all unauthenticated mail. Strongest protection against spoofing.

**Never jump straight to `p=reject`.** You will block your own legitimate mail from SaaS tools, newsletters, CRM notifications, etc.

**Use a free DMARC report parser:** EasyDMARC, DMARCian, Postmark DMARC Digests, or Valimail. Raw XML reports are unreadable.

---

## IV. Inbox Warmup — The 4–6 Week Protocol

A brand-new domain (or a dormant one) has no sender reputation. Sending 50 cold emails on day one = instant spam flag, blacklist risk. Receivers need to see a pattern of "normal human correspondence" before they trust new senders.

### Warmup schedule (per inbox on a new sending domain)

| Week | Daily sends | Notes |
|---|---|---|
| 1 | 5 emails/day | Real conversations only — use automated warmup tool if available |
| 2 | 10 emails/day | Automated warmup tool will simulate replies to build reputation |
| 3 | 15 emails/day | Begin mixing in cold outreach — very low volume |
| 4 | 20 emails/day | Cold outreach ramps; monitor bounce + spam rates |
| 5 | 25 emails/day | Full campaign cadence allowed |
| 6 | 30 emails/day | Steady-state max |

**Rules during warmup:**
- Never exceed the day's cap, even if you "feel fine"
- No spammy language (no "!!!" no ALL CAPS no "free" / "guaranteed" / "click here")
- No links in first 2 weeks; introduce carefully after
- No attachments during warmup
- Keep reply rate high — warmup tools that simulate replies accelerate reputation building

### Tools

- **Instantly** — built-in warmup included in the Growth plan (~$37/mo)
- **Smartlead** — built-in warmup included (~$39/mo)
- **Lemwarm** (by Lemlist) — dedicated warmup, can be used with other platforms ($29/mo)
- **Warmbox**, **Mailwarm**, **Warmy** — standalone warmup services ($20–$40/mo)

All work similarly: AI-driven network of mailboxes that send and reply to your inbox, building engagement signals. Gmail sees "this mailbox has active conversations with senders at many real-world domains" and builds sender reputation.

### Before starting warmup

- [ ] SPF, DKIM, DMARC configured and verified
- [ ] MX records configured for the sending domain (even if it's sending-only)
- [ ] Inbox configured in Workspace with a real human-style signature (name, role, phone, address)
- [ ] 301 redirect from sending domain → sovernhouse.co live
- [ ] Test send from the inbox to your personal Gmail — verify it arrives in inbox, not spam
- [ ] Test send via mail-tester.com — aim for 9/10 or 10/10 score

---

## V. Sending Volume & Rate Discipline

### Daily sending limits (per inbox, per Google Workspace policy)

| Status | Sends/day | Notes |
|---|---|---|
| New domain, week 1 | 5 | Warmup only |
| New domain, week 6+ | 30 | Steady-state cold outbound |
| Established domain | 100–200 | Only if engagement metrics are strong |
| Google Workspace hard cap | 2,000 | External recipients/day (usually far above what we need) |

### Recipient-variety discipline

- **Never send 50 emails with the same subject line on the same day.** Receivers fingerprint identical subjects across domains.
- **Rotate subject-line variants** — 3–5 variants per campaign.
- **Randomize send times** across business hours (9am–5pm local to recipient).
- **Spread across multiple inboxes** when volume is needed — better to have 5 inboxes × 20/day than 1 inbox × 100/day.

### Bounce and complaint thresholds

- **Bounce rate > 2%:** pause and investigate. List verification failure, not a copy problem.
- **Bounce rate > 5%:** hard pause. Clean list with ZeroBounce/NeverBounce before resuming.
- **Bounce rate > 10%:** deliverability has been damaged. Expect throttling for several weeks.
- **Complaint (spam) rate > 0.1%:** investigate copy and targeting. Too high = spam flags.
- **Complaint rate > 0.3%:** hard pause. Review and rewrite.

### List hygiene (L-013 applies here too)

- Verify every address before sending (ZeroBounce $0.008–$0.01/email, NeverBounce $0.008/email)
- Remove role addresses (info@, sales@, hello@) from cold outbound — low intent, high spam flag risk
- Remove catch-all domains (they'll accept everything but bounce back later)
- Remove "disposable" domains (mailinator.com, guerrillamail.com, etc.)
- **Sanctions screening pass required** before any outbound — OFAC SDN, EU Consolidated, UN

---

## VI. Monitoring & Diagnostics

### Must-have (free) monitoring

**Google Postmaster Tools** (postmaster.google.com)
- Add and verify sovernhouse.co and each sending domain
- Shows your domain's reputation as seen by Gmail (High / Medium / Low / Bad)
- Shows spam rate, authentication pass rate, delivery errors
- Check weekly. A drop from High → Medium is a warning.

**Microsoft SNDS** (sendersupport.olc.protection.outlook.com/snds)
- Equivalent for Outlook / Hotmail / Office365 recipients
- Shows IP-level reputation (less useful for shared SMTP, more useful if you ever have dedicated IP)

### Blacklist monitoring

Check weekly:
- **MXToolbox Blacklist Check** (mxtoolbox.com/blacklists.aspx)
- **Spamhaus** (check.spamhaus.org)
- **MultiRBL** (multirbl.valli.org)

If listed: don't panic. Read the reason, fix the issue, request delisting. Spamhaus usually delists within 7 days if the cause is remediated.

### Deliverability testing tools

**mail-tester.com** — send a test email to their generated address, get a 0–10 score with specific diagnostics. Run before every new campaign.

**GlockApps** — seed tests against a panel of mailboxes across providers (Gmail, Outlook, Yahoo). Tells you spam-folder placement rate. Paid ($59+/mo).

**DMARC reports** — aggregate and forensic reports show authentication failures across the ecosystem. Parse with EasyDMARC (free for small volume).

### Red-flag metrics (act immediately)

- Reply rate drops > 30% week-over-week with no change in copy/targeting → likely deliverability, not content
- Open rate drops > 20% with same targeting → placement in spam folder
- Any new blacklist listing → pause immediately, diagnose
- Google Postmaster reputation drops to Medium → reduce volume by 50%, investigate
- Spam complaint rate spikes → pause, review copy, targeting, list hygiene

---

## VII. Sending Platforms — Stack Recommendation

### For Sovern House at current stage (1 user, launching):

**Primary business email:** Google Workspace Business Starter — $7/user/month annual, $8.40/mo flexible. Gmail + Drive + Calendar + Meet + Gemini. Aliases free.

**Cold outbound:** Smartlead OR Instantly (pick one, not both). Both include warmup.
- **Instantly** — $37/mo Growth plan; cleaner UI; better for beginners.
- **Smartlead** — $39/mo Basic plan; unlimited warmup; better at scale; superior deliverability infrastructure.
- Either integrates with Google Workspace via OAuth; no SMTP credentials needed.

**Email verification:** ZeroBounce or NeverBounce. Pay per verification ($0.008–$0.01/email). Verify every list.

**DMARC monitoring:** EasyDMARC free tier (up to 10K messages/month) or Postmark DMARC Digests free.

**LinkedIn outreach:** LinkedIn Sales Navigator Core ($119.99/mo) if running LinkedIn as a channel. Manual InMail sending — do not automate LinkedIn outreach with third-party tools, LinkedIn actively bans those accounts.

### What to avoid

- Mailchimp, ConvertKit, ActiveCampaign for cold outbound — they're newsletter platforms, will terminate accounts sending cold.
- HubSpot Marketing Hub for cold outbound — same reason, and expensive.
- Shared IP cold outbound platforms with poor reputation — check reviews; a shared IP with other cold senders means you inherit their reputation.
- "Unlimited emails/month" cheap outbound tools — usually means shared dirty IP.

---

## VIII. Operating Rhythm

### Daily
- Monitor inbox for bounces and complaints
- Review reply queue — reply to humans within business day
- Check sending volume is within limits

### Weekly
- Check Google Postmaster Tools reputation
- Check blacklist status (MXToolbox)
- Review bounce + complaint + reply rates per inbox
- Rotate subject line variants if performance declining

### Monthly
- Full DMARC report review
- Verify all email auth records still valid (DKIM keys rotate every 6–12 months per best practice)
- Review inbox allocations — retire any inbox with chronic bounce/complaint issues
- Audit list sources — which sources produce highest reply rate vs. bounce rate

### Quarterly
- Evaluate need for additional sending domains
- Evaluate moving DMARC from `quarantine` → `reject` (if at monitor/quarantine)
- Review sending platform — better option available?
- Rotate DKIM keys (best-practice hygiene)

---

## IX. What the Deliverability Specialist Blocks

**Absolute blocks (no exceptions):**

1. **Any cold outbound from sovernhouse.co primary domain.** Use secondary sending domain, always.
2. **Any outbound send without SPF + DKIM + DMARC configured and passing.** Test before launch, not after.
3. **Any send to a list that hasn't been verified** (ZeroBounce/NeverBounce) and sanctions-screened (OFAC/EU/UN).
4. **Any new inbox sending at > 5 emails/day in week 1.** Warmup is not optional.
5. **Any same-subject-line blast > 20 recipients.** Rotate subjects.
6. **Adding attachments to cold outreach.** High spam flag, almost always rejected.
7. **Links with URL shorteners (bit.ly, tinyurl).** Spam signal. Use the full URL or a branded redirect on a domain under our control.
8. **Any campaign launched when Google Postmaster reputation is Medium or lower.** Fix reputation first.

**Flag and escalate:**
- Any proposal to send > 200 emails/day total across all domains
- Any proposal for a new sending domain (requires 4–6 week warmup plan)
- Any proposal to use a non-Google SMTP provider for outbound (deliverability differences)
- Any DMARC policy change (p=none → p=quarantine → p=reject)
- Any new cold campaign — launch checklist must be complete (see below)

---

## X. Campaign Launch Checklist

Before ANY new cold campaign sends its first email:

- [ ] Sending domain registered and active
- [ ] 301 redirect: sending domain → sovernhouse.co
- [ ] MX, SPF, DKIM, DMARC records configured and verified
- [ ] mail-tester.com score ≥ 9/10
- [ ] Warmup complete (minimum 4 weeks for a new domain/inbox)
- [ ] Google Postmaster reputation: High
- [ ] List verified via ZeroBounce/NeverBounce (remove bounces + risky)
- [ ] List sanctions-screened via OFAC / EU / UN (L-013)
- [ ] ICP scoring done; prospects outside ICP removed
- [ ] Subject lines: 3–5 variants, no spam triggers
- [ ] Copy: 60–125 words, plain text, no attachments, one CTA
- [ ] Each prospect personalized (not just {first_name} merge) — see `trade-outreach-copy.md`
- [ ] Daily send cap configured (≤ 30/inbox/day)
- [ ] Send windows: 9am–5pm recipient local time
- [ ] Reply routing tested — replies hit the right human inbox
- [ ] Unsubscribe mechanism in place (even for B2B cold — required under CAN-SPAM / CASL / GDPR)
- [ ] Physical mailing address in footer (CAN-SPAM requirement for US recipients)
- [ ] Monitoring dashboard checked daily for the first 2 weeks

---

## XI. Compliance Notes — Cold Email Laws by Jurisdiction

Quick reference; defer to `trade-attorney.md` for authoritative legal guidance.

- **USA (CAN-SPAM):** Cold B2B outreach permitted. Must include: accurate from-address, truthful subject line, physical mailing address, clear unsubscribe. No opt-in required.
- **Canada (CASL):** Strictest consent regime. Options: (a) **express consent** (opt-in); (b) **implied consent via existing business relationship** — valid 2 years after last purchase or 2 years after last inquiry; (c) **implied consent via conspicuously-published business contact** — the published address must be relevant to the recipient's role AND must not carry an explicit "no unsolicited CEMs" notice. Safest practical path: reach Canadian prospects via LinkedIn first to establish context, then email. Penalties up to CAD $10M/violation.
- **EU/UK (GDPR + ePrivacy Directive):** B2B cold email to a named corporate address generally permitted under "legitimate interest" basis when the message is clearly relevant to the recipient's professional role. **Germany is the notable exception** — courts have required prior opt-in for B2B email under §7 UWG; treat German prospects as opt-in-required via LinkedIn or industry event first. Individual/personal addresses (name@personal-domain) require opt-in everywhere in the EU. Always include one-click unsubscribe and honor within 30 days (our policy: 48 hours).
- **Australia (Spam Act):** Similar to CASL — consent-based. Inferred consent for published business addresses is permissible but fragile.
- **Global:** Always include unsubscribe, always honor it immediately (< 48 hours), always include physical address (Taiwan business address for Sovern House).

Legal risk for cold email is real but manageable. The practical risk — being blacklisted by receivers — is higher than the regulatory risk for well-targeted, low-volume, personalized outreach. See `trade-attorney.md` for authoritative treatment; when in doubt, escalate.

---

## XII. Sources

- [Google Workspace DKIM, DMARC, SPF Setup 2026 — EasyDMARC](https://easydmarc.com/blog/setup-guide-to-google-workspace-dkim-dmarc-spf-in-2026-for-business/)
- [DMARC for Google Workspace Setup Guide 2026 — DMARC Report](https://dmarcreport.com/blog/dmarc-google-workspace-gmail-setup-2026/)
- [Cold Email in 2026: Domains, Deliverability, Replies — Unify](https://www.unifygtm.com/explore/cold-email-2026-domain-setup-deliverability-sequences)
- [The Ultimate 2026 Cold Email Deliverability Checklist — Mailshake](https://mailshake.com/blog/the-ultimate-2026-cold-email-deliverability-checklist/)
- [Cold Email Deliverability: The Ultimate Guide 2026 — MailReach](https://www.mailreach.co/blog/cold-email-deliverability-sending-strategy)
- [Cold Email Infrastructure Setup 2026 — Cleverly](https://www.cleverly.co/blog/cold-email-infrastructure)
- [SPF, DKIM, DMARC Complete Guide — Smartlead](https://www.smartlead.ai/blog/spf-dkim-dmarc)
- [2026 Email Verification Benchmark — Instantly](https://instantly.ai/blog/2026-email-verification-benchmark-accuracy-scores-for-8-top-tools/)
- [Smartlead vs Instantly vs Lemlist Pipeline ROI — Instantly](https://instantly.ai/blog/instantly-vs-smartlead-lemlist-2026/)

---

**Document Owner:** Deliverability Specialist (Alex, until hired; or contracted to a deliverability consultant at $500–$1,500 one-off for initial setup)
**Next Review:** Quarterly
