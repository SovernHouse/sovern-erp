# Sovern House Website — Backlog
**Last updated:** 2026-04-17

Issues logged here are confirmed but not urgent. Work through them in priority order after launch stabilizes.

---

## UI / Mobile

### B-001 — Mobile layout issues (hero section)
**Priority:** Medium
**Status:** Not started
**Logged:** 2026-04-17

Hero section text wraps awkwardly at narrow viewports. Hero image scaling is off.

**Test matrix required:**
- 390px (iPhone 14/15)
- 360px (common Android — Samsung Galaxy, Pixel)

**Scope:** Test ALL pages at both widths, not just homepage. Document which pages have issues before fixing.

---

## DevTools / Browser Console Errors

### B-002 — CSP blocks `eval` in JavaScript
**Priority:** Medium
**Status:** Not started
**Logged:** 2026-04-17

DevTools Issues panel shows 1 CSP error blocking `eval`. Some dependency (likely a bundled library or analytics script) is using `eval`, which is blocked by the default Content Security Policy.

**Work required:**
1. Identify which script/dependency is calling `eval`
2. Decision: replace the dependency, or add a targeted `unsafe-eval` exception to CSP for that specific origin only
3. Do NOT add a blanket `unsafe-eval` to the CSP — that removes the protection entirely

---

### B-003 — CORS request includes disallowed headers
**Priority:** Medium
**Status:** Not started
**Logged:** 2026-04-17

1 CORS error in DevTools Issues panel. A request is being sent with headers that the server's CORS policy doesn't allow.

**Work required:**
1. Identify which request is triggering the error (Network tab → filter by CORS errors)
2. Audit `next.config.ts` CORS headers and Vercel headers config against the actual request headers
3. Fix either the request (remove the disallowed header) or the server config (allow-list the header if legitimate)

---

### B-004 — Form inputs missing `autocomplete` attribute
**Priority:** Low
**Status:** Not started
**Logged:** 2026-04-17

3 warnings for missing `autocomplete` attributes on form inputs. Affects RFQ form and possibly contact form.

**Mapping to apply:**
- Full Name → `autocomplete="name"`
- Email → `autocomplete="email"`
- Company Name → `autocomplete="organization"`
- Country → `autocomplete="country-name"`
- Phone (if added later) → `autocomplete="tel"`

Files to check: `app/rfq/RfqForm.tsx`, `app/contact/ContactForm.tsx`

---

### B-005 — Deprecated browser feature in use
**Priority:** Low
**Status:** Not started
**Logged:** 2026-04-17

DevTools Issues panel flagged 1 deprecated feature. Identity unknown — needs investigation.

**Work required:**
1. Open DevTools Issues panel on `https://sovernhouse.co`
2. Find the deprecated feature warning, note which API/feature and which file/line triggers it
3. Log the specific deprecation here, then fix

---

## SEO / Metadata

### B-006 — OG image missing
**Priority:** Medium
**Status:** Not started
**Logged:** 2026-04-17

No `og:image` set in `app/layout.tsx`. Social shares on LinkedIn, WhatsApp, iMessage will show a blank card. Needs a 1200×630px brand image at `public/og-image.jpg` and a reference added to the metadata config.

---

### B-007 — `/legal/cookies` missing from sitemap
**Priority:** Low
**Status:** Not started
**Logged:** 2026-04-17

`app/sitemap.ts` includes `/legal/terms` and `/legal/privacy` but not `/legal/cookies`. Add it with `priority: 0.3, changeFrequency: "yearly"`.

---

## Infrastructure

### B-008 — `.env.local` detected during Vercel build
**Priority:** Low
**Status:** Not started
**Logged:** 2026-04-17

Vercel warns on every deploy: "Detected .env file, it is strongly recommended to use Vercel's env handling instead." The `.env.local` file is present in the repo working directory and gets picked up. All secrets are correctly managed in Vercel env vars — `.env.local` is dev-only and should not affect production builds, but the warning should be silenced. Confirm `.env.local` is in `.gitignore` (it is) and assess whether the file needs to be restructured.

---

## Deferred Integrations

### B-009 — ERP webhook integration
**Priority:** High (when ERP goes public)
**Status:** Blocked on ERP deployment
**Logged:** 2026-04-17

RFQ route has a no-op ERP webhook block with a TODO comment at `app/api/rfq/route.ts:129`. When the ERP is publicly reachable:
1. Set `ERP_API_URL` and `ERP_WEBHOOK_KEY` in Vercel production env vars
2. Confirm the ERP's `/api/webhook/rfq` endpoint accepts the payload shape sent by the website
3. Test end-to-end: RFQ submission → Lead record in ERP admin

### B-010 — Resend domain verification
**Priority:** High
**Status:** Partially complete
**Logged:** 2026-04-17

`sovernhouse.co` needs to be verified as a sending domain in Resend dashboard. Add Resend's required DNS records (TXT + DKIM) in GoDaddy. Without this, email deliverability is relying on Resend's shared infrastructure, which is less reliable and may affect inbox placement over time. Do this in the same GoDaddy session as any future DNS work.

### B-011 — Vercel GitHub auto-deploy connection
**Priority:** Medium
**Status:** Not started
**Logged:** 2026-04-17

Currently deploying via `vercel --prod` CLI. GitHub repo (`SovernHouse/sovernhouse-website`) is not yet connected to the Vercel project for auto-deploys.

**Click-path to connect:**
Vercel dashboard → sovern-house project → Settings → Git → Connect Git Repository → GitHub → `SovernHouse/sovernhouse-website` → Production Branch: `main` → Save

Once connected, every `git push origin main` triggers an auto-deploy.
