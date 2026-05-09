# Trade Security — Web Security for Trade & Buying House Sites

**Version:** 1.0 | **Created:** 2026-04-18
**Depends on:** `trade-cto.md`, `trade-backend.md`, `trade-attorney.md`, `trade-compliance.md`
**Use for:** Security posture for Sovern House's website, RFQ flow, admin surfaces, data handling, and any publicly-addressable infrastructure. The trade industry is a high-value target for BEC (business email compromise), invoice fraud, supplier impersonation, and intellectual property theft. Security discipline matters more here than for most businesses.

---

## Why this skill exists

Trading houses are high-value targets for attackers because:

1. **Money moves through them** — L/C documents, wire transfer instructions, invoice pairs — any compromise of communication channels is directly monetizable via BEC (business email compromise) scams
2. **Supplier/buyer relationships are leverage** — attackers who compromise a trading house's systems can impersonate them to redirect payments ("Hi, please wire payment to this new account")
3. **Due diligence data is sensitive** — buyer lists, factory sources, margin data, pricing strategy are valuable to competitors
4. **Regulatory exposure compounds** — a breach that exposes buyer data across jurisdictions (GDPR, CCPA, Egypt data protection) creates legal exposure in multiple places

Not having a security posture documented is itself a trust signal problem. Sophisticated buyers (enterprise procurement, bank compliance teams) WILL ask about security posture. Having answers ready earns trust.

---

## Security principles for trade websites

### Principle 1 — Minimize the attack surface

Only expose what must be exposed. Trading houses don't need consumer-style feature bloat.

- **Don't accept payment on the public site** — no Stripe, no PayPal, no anything that processes payment in the browser. Payments go through L/C, T/T, or escrow, NEVER through the website. Nothing to steal if nothing is there.
- **Don't store supplier passwords / portal access on the public site** — separate customer portal at a different subdomain with different trust boundaries
- **Don't display buyer data back on the site** — no "logged-in client portal" on the same domain as marketing site
- **Don't expose admin interfaces publicly** — admin routes require separate authentication and ideally VPN or IP allowlist
- **Don't enable API routes that don't exist yet** — every unused API route is a potential CVE magnet

### Principle 2 — Defense in depth

Single layer of security = single point of failure.

- **HTTPS everywhere** — HSTS header with preload, no HTTP served anywhere, redirect HTTP → HTTPS with 301
- **CSP (Content Security Policy)** — restrict what scripts/styles/fonts can load from; prevents XSS from becoming catastrophic
- **Subresource Integrity (SRI)** — for any third-party JS/CSS, pin the hash so a CDN compromise doesn't inject malicious code
- **CSRF protection** — any state-changing form (RFQ submission, contact) has CSRF tokens
- **Rate limiting** — RFQ form, login endpoints, search — all rate-limited to prevent brute-force and enumeration
- **Input validation at every layer** — client-side for UX, server-side for security. Never trust client input.
- **Output escaping** — prevent stored XSS by escaping user-submitted content when rendered
- **SQL injection prevention** — parameterized queries only, never string concatenation
- **Dependency vulnerability scanning** — `npm audit` / Dependabot / Snyk integrated into the build pipeline

### Principle 3 — Assume breach, minimize blast radius

- **Secrets never in code** — all API keys, database credentials, third-party tokens live in Vercel env vars or a secret manager
- **Principle of least privilege** — each service / API key / database user gets only the permissions required
- **Audit logging** — admin actions, form submissions, payment-related interactions are all logged with timestamp + actor + action
- **Backup + recovery** — daily database backups, tested recovery process, not just "we have backups somewhere"
- **Incident response plan** — who gets called, what steps are taken, in the first 4 hours of a suspected breach

### Principle 4 — Data handling by jurisdiction

Sovern House serves buyers in multiple jurisdictions. Data handling rules vary:

- **EU (GDPR)** — explicit consent for cookies beyond strictly necessary, right to access / delete personal data, data processing agreement with any sub-processor, lawful basis for processing
- **UK (UK GDPR + Data Protection Act 2018)** — similar to EU plus UK-specific provisions
- **California (CCPA / CPRA)** — right to delete, right to opt out of "sale" of data, privacy notice
- **Egypt (Personal Data Protection Law No. 151/2020)** — data localization preferences, consent requirements
- **China (PIPL, if Chinese suppliers' data is stored)** — cross-border transfer restrictions

**Practical implication:** Privacy policy must honestly describe what's collected, how it's stored, how long, and the rights the user has. One-size-fits-all "we respect your privacy" text is legally insufficient.

---

## Current Sovern House security posture audit (2026-04-18)

### What's already in place (verified)

- ✅ HTTPS on sovernhouse.co via Let's Encrypt (Vercel auto-provision)
- ✅ SPF, DKIM, DMARC on the email domain (p=none currently, ramping to p=quarantine / p=reject per `trade-email-deliverability.md`)
- ✅ Security headers in next.config.js (HSTS, X-Frame-Options, X-Content-Type-Options, COOP, Referrer-Policy, Permissions-Policy) — added in the security-headers commit
- ✅ No payment processing on the site (payments happen through L/C, T/T, wire — all offline)
- ✅ Resend API key stored in Vercel env vars, not in code
- ✅ RFQ form has Reply-To routing + validation; emails go to info@sovernhouse.co via Resend
- ✅ Legal pages present: Privacy, Terms, Cookies
- ✅ Private GitHub repo (code not public)

### What's missing (prioritized fix list)

1. **Strict CSP (Content Security Policy)** — currently basic security headers; strict CSP with nonce-based script/style whitelisting not yet implemented. Medium-high priority.
2. **Subresource Integrity (SRI)** — no pinned hashes for third-party assets. Low priority if no third-party assets are loaded externally.
3. **Rate limiting on RFQ endpoint** — currently no explicit rate limit; Vercel's default platform-level throttling exists but is coarse. Recommend adding route-level rate limiting via middleware (e.g., `@upstash/ratelimit`). Medium priority.
4. **CSRF tokens on RFQ form** — currently relies on same-origin + CORS for protection; should add explicit CSRF token. Low-medium priority.
5. **Compliance & Ethics page with security posture** — doesn't exist yet; add brief statement about how Sovern handles data, who has access, what happens in a suspected breach. High priority for trust signal.
6. **Cookie consent banner for EU visitors** — currently not present; Privacy Policy documents cookies but no active consent mechanism. EU visitors technically require this. Medium priority.
7. **Incident response runbook** — internal document, not public; not yet written. High priority operationally.
8. **Dependency scanning** — `npm audit` not yet integrated into CI; Dependabot alerts not yet enabled on the GitHub repo. Quick fix, medium priority.

---

## RFQ form security hardening checklist

The RFQ form is the single most-attacked endpoint on a trade website (scraping, spam, enumeration, BEC reconnaissance).

- [ ] **Honeypot field** — invisible-to-user input field; if filled, it's a bot → reject silently
- [ ] **Rate limiting** — max 3 submissions per IP per hour, max 20 per IP per day
- [ ] **Email domain validation** — reject obvious spam domains (mailinator, temp-mail, etc.) and role addresses where inappropriate
- [ ] **Content length limits** — prevent dumping massive payloads; max 2000 chars for message field, max 100 for name
- [ ] **Input sanitization** — strip HTML tags, normalize whitespace, reject non-UTF-8
- [ ] **Output escaping** — when forwarding to info@sovernhouse.co, ensure user-supplied content can't inject HTML or headers into the email
- [ ] **Server-side validation** — never trust client-side validation alone
- [ ] **CSRF token** — issued on page load, verified on submit
- [ ] **Referer check** — verify Referer header points to sovernhouse.co for additional friction against scripted abuse
- [ ] **Silent failure mode** — if validation fails, don't reveal whether it was rate limiting, domain blocking, or honeypot — returns same response as success to avoid reconnaissance

---

## Email security — specifically against BEC

Business Email Compromise is the #1 financial risk for trading houses. Attackers often:

1. Compromise a supplier's email (or spoof it)
2. Send a "we've changed bank accounts" message to the buyer (you)
3. Wait for the wire transfer to the attacker-controlled account
4. Disappear

Defenses:

- **Never accept payment instruction changes via email alone** — bank account changes require voice verification with a known contact, plus written confirmation on company letterhead
- **Check email headers** — train the team to notice: DKIM not passing, Reply-To different from From, unusual domain (supplier.com vs. supplier-co.com), unusual urgency
- **Use PGP or S/MIME for sensitive financial documents** — overkill for most communications; essential for wire instructions
- **Internal "stop, verify" protocol** — any email requesting payment / change-of-account / urgency → stop, pick up the phone, verify before acting
- **Supplier verification at onboarding** — document bank account details at the START of the relationship, verified via multiple channels; any change requires full re-verification

Alex should document this protocol in `Instructions & Skills/` as `trade-bec-protocol.md` or similar — operational document, not public.

---

## Admin and operational security

For Sovern House's own operations (not the public site):

- **MFA on everything** — Google Workspace, GitHub, Vercel, Resend, GoDaddy — every account that can affect operations has MFA enabled (hardware key preferred, TOTP acceptable, SMS last resort)
- **Separate admin accounts from daily use** — admin actions on GitHub / Vercel / DNS happen through a dedicated account, not the daily-communication account
- **Strong, unique passwords** — password manager (Bitwarden, 1Password, LastPass) — never reuse, never store in browser
- **Backup MFA recovery codes** — stored in a physical safe OR in the password manager's secure notes
- **Offboarding discipline** — if anyone leaves the team (including the Egyptian Country Manager), full account removal + password rotation + API key rotation within 24 hours
- **Laptop encryption** — BitLocker (Windows) or FileVault (macOS) on every device that touches business systems
- **Phishing training** — regular (monthly) reminder: verify any unusual request by phone, especially anything financial

---

## Public trust signals for security posture

On the public site (not the operational details above), signal security posture to build buyer confidence:

- "All transactions handled through verified banking channels. We never process payment on this website."
- "Email communications from Sovern House originate from the sovernhouse.co domain only. If you receive a message from any other domain claiming to represent us, please verify by phoning [number]."
- "We never request bank account changes via email alone. Any legitimate account change from Sovern will be confirmed in writing on company letterhead."
- "Compliance & Ethics page — see [link]"

These are trust signals, not security implementations. They work because they DEMONSTRATE security thinking to buyers who evaluate it.

---

## How to invoke this skill

1. **When adding any new API route or public form** — run the RFQ hardening checklist against it
2. **When onboarding or offboarding team members** — run the admin security discipline section
3. **When a suspected BEC event occurs** — immediate: stop acting, follow the "stop, verify" protocol, escalate
4. **Quarterly** — full security audit against this skill as a checklist
5. **Before shipping features that handle payment info, bank details, or personal data** — this skill has veto power over ship decisions

---

## Relationship to other skills

- `trade-cto.md` — architecture decisions; this skill enforces the security implications
- `trade-backend.md` — API / DB code; this skill reviews for security issues
- `trade-attorney.md` — legal exposure from data breach; this skill prevents the breach
- `trade-compliance.md` — regulatory obligations (GDPR, etc.); this skill operationalizes them
- `trade-trust-architecture.md` — security is a trust pillar; this skill provides the substance behind the signal
