# Sovern House Website — Deployment Plan for Claude Code
**Date:** 2026-04-17
**Codebase location:** Website/ folder in project root

---

## Phase 0 — Pre-flight checks

### 0.1 Identify the stack
Read package.json: framework + version (expected Next.js 15), Node version, all dependencies, build scripts.

### 0.2 Environment variables
Find .env.example or .env.local.example, list expected variables. Critical: ERP_WEBHOOK_KEY (must match ERP's WEBHOOK_API_KEY per lessons.md L-024), NEXT_PUBLIC_ERP_URL, NEXT_PUBLIC_CLIENT_PORTAL_URL, any analytics keys.

### 0.3 Build test
cd Website && npm install && npm run build. Fix any errors before proceeding.

### 0.4 Brand audit
grep -rn "FloorTrade\|New Route\|newroute" . --exclude-dir=node_modules --exclude-dir=.next. Any user-facing references to old brands must be updated. Legitimate exception: legal fine print "brand of New Route International Exchange Co., Ltd."

### 0.5 Legal pages (BLOCKER for launch)
Per Claude Code's audit earlier, /legal/* pages are missing. Scaffold /legal/terms, /legal/privacy, /legal/cookies before deploy. Legal entity: New Route International Exchange Co., Ltd., Taiwan.

---

## Phase 1 — ERP integration verification

### 1.1 RFQ webhook (per lessons.md L-024)
- Website env var ERP_WEBHOOK_KEY set, matches ERP's WEBHOOK_API_KEY
- Production ERP URL reachable, /api/webhook/rfq endpoint live
- Test submission from local website creates a Lead record in ERP
- DO NOT use /api/inquiries — that's authenticated, not for public forms

### 1.2 Client portal link
/client-portal page redirects to ERP Customer Portal subdomain (portal.sovernhouse.co or similar). If portal subdomain not set up yet, deferrable — launch website without working portal link is acceptable.

### 1.3 Database safety
Confirm ERP's database.sqlite is NOT reachable from public web (inside Docker/firewall). Not launching ERP publicly today defers this risk.

---

## Phase 2 — Vercel hosting

### 2.1 Account
Sign up vercel.com with alex@sovernhouse.co. Enable 2FA. Hobby tier free — verify commercial-use policy (may need Pro at $20/mo).

### 2.2 Connect
Option A (CLI): npm install -g vercel; cd Website; vercel login; vercel link; vercel (first deploy to preview URL).
Option B (GitHub): push to GitHub repo, Vercel dashboard → Import from GitHub.

### 2.3 Environment variables
In Vercel → Project → Settings → Environment Variables, add every variable from .env.local audit. Mark webhook keys as Production only. Analytics and public URLs can be All.

### 2.4 Preview deploy
vercel → get preview URL. Click through every page: /, /about, /how-it-works, /services/*, /products/*, /rfq, /contact, /client-portal, /legal/*. Submit test RFQ → verify ERP receives it. Test mobile (390px) and desktop (1280px+).

### 2.5 Production deploy
vercel --prod. Deploys to production Vercel URL. Next: point sovernhouse.co at it.

---

## Phase 3 — DNS cutover on GoDaddy

Current sovernhouse.co DNS state (per today's session):
- A @ → WebsiteBuilder Site (GoDaddy parking — MUST REMOVE)
- MX → smtp.google.com (Workspace — KEEP)
- TXT → SPF, DKIM (google._domainkey), DMARC p=none, google-site-verification (KEEP ALL)
- _acme-challenge TXT × 2 (SSL — KEEP)

### 3.1 Get Vercel's DNS targets
Vercel → Project → Settings → Domains → Add Domain → enter sovernhouse.co. Vercel shows A record (likely 76.76.21.21) and/or CNAME for www. Copy exact values Vercel displays.

### 3.2 Update GoDaddy DNS
- DELETE A record pointing to WebsiteBuilder Site
- ADD A record: Name @, Value (Vercel's IP), TTL 1 Hour
- UPDATE CNAME www: Value cname.vercel-dns.com, TTL 1 Hour
- DO NOT TOUCH: MX, TXT, _acme-challenge records
- Save

### 3.3 Verify on Vercel
Refresh Vercel Domains page. SSL auto-provisions via Let's Encrypt. Both sovernhouse.co and www.sovernhouse.co should resolve with valid SSL within 5-60 min.

### 3.4 Verify email still works
Send email to alex@sovernhouse.co → confirm receipt. Send from alex@sovernhouse.co → confirm delivery. If broken, MX records were accidentally touched — restore them.

---

## Phase 4 — Production smoke tests

### 4.1 Pages
- Homepage: hero, buying house positioning, 4 pillars, micro-RFQ
- /about: Alex's 30-year story
- /how-it-works: process + FAQ
- /services/sourcing, /services/quality-control
- /products/flooring, /products/garments-fabrics
- /rfq: form fields display
- /contact
- /client-portal
- /legal/terms, /legal/privacy, /legal/cookies
- Footer shows "Sovern House is a brand of New Route International Exchange Co., Ltd."

### 4.2 RFQ end-to-end
Submit real test RFQ on live site. Confirm: lead appears in ERP admin, auto-reply arrives in alex@sovernhouse.co.

### 4.3 SSL
https://sovernhouse.co → green padlock. http redirects to https. www.sovernhouse.co redirects to root.

### 4.4 SEO basics
View source: <title> descriptive, <meta description> set, OG tags present. /robots.txt accessible and blocks /client-portal and /api/*. /sitemap.xml accessible.

### 4.5 Performance
Chrome DevTools Lighthouse mobile audit: Performance >80, Accessibility >90, SEO >90. Real device test on phone.

---

## Phase 5 — Post-launch

- Monitor RFQ inbox for 48 hours
- Submit to Google Search Console (search.google.com/search-console) — verify via existing google-site-verification TXT, submit sitemap
- Submit to Bing Webmaster Tools
- Add sovernhouse.co to LinkedIn company page
- Set up Plausible analytics if per architecture doc (confirm in codebase)
- Cloudflare CDN in front is optional/deferred — Vercel edge handles initially

---

## Critical reminders

1. lessons.md L-020: Never trust comments/variable names — read actual code
2. lessons.md L-002: Verify behavior, not just code changes
3. lessons.md L-023: Sequelize JSON fields store raw objects, never pre-stringified (if touching backend)
4. Email continuity is non-negotiable — MX/TXT/_acme records must survive DNS cutover
5. Work on a branch, open PR, review diff, merge — don't push to main directly
6. Rollback if needed: restore A record to previous GoDaddy value, Vercel preview URL keeps working

---

## Budget today

Vercel Hobby: Free
Cloudflare CDN: Deferred
Plausible: ~$9/mo if added (self-hosted free)
Total new spend: $0
