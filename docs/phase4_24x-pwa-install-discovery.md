# Phase 4.24.x — PWA Install Discoverability (Feature Directive)

**Status:** DRAFT — pending Alex approval
**Owner:** Alex (Super Admin) → Claude (executing)
**Skill ref:** `trade-odoo-patterns.md` (entity-detail contract) + `trade-polish.md` (visual polish)
**Spec template:** `erp-feature-directive.md`
**Related:** Phase 5b service worker, existing `components/InstallPWA.jsx`

---

## Context

The admin portal is a working PWA today: `public/manifest.json` declares it installable, `public/sw.js` (Phase 5b) ships a network-first service worker, all icon sizes are present (192, 512 with `purpose: "any maskable"`, 180 apple-touch), and `components/InstallPWA.jsx` already captures `beforeinstallprompt` and renders a Download icon in the top bar (`components/Layout.jsx:450`).

Two problems with the current state:

1. **The install button is invisible in practice.** It is an 18px Download icon with no label, mounted next to Help and ActivityIndicator. A first-time user on a new machine will not notice it. Compare to Odoo, which surfaces "Install Sovern House Operations" as a labeled CTA the moment install is possible.
2. **No banner-level discovery.** Even if a user notices the icon, there is no second touchpoint reinforcing that installing makes the experience better. Odoo, Linear, Notion, and Slack all surface a one-time prominent banner on first eligible load.

Result: Alex (and any Sovern House staff or whitelabel demo viewer) gets the worse browser-tab experience by default and never finds the install path.

This directive closes that gap with two coordinated changes that share the same `beforeinstallprompt` handler (no new infrastructure, no new service worker work).

---

## Phases

### Phase 4.24.x-a — Labeled install chip in top bar (replace icon-only button)

**Goal:** Replace the 18px Download icon with a labeled chip when install is available.

**Visual spec:**
- Pill-shaped chip, height ~32px, padding ~12px horizontal.
- Background: forest green `#1D5A32` at 0.10 alpha (subtle, brand-on-light).
- Border: 1px solid `#1D5A32` at 0.25 alpha.
- Text: "Install Desktop App" (12px, weight 600, color `#1D5A32`).
- Icon: `Download` (14px, leading, same forest color).
- Hover: background `#1D5A32` at 0.18 alpha, no border color change.
- Active/pressed: scale(0.98).
- Disappears entirely once installed (existing `appinstalled` listener already handles this).
- On iOS Safari: same chip, copy changes to "Add to Home Screen", click opens the existing iOS tooltip.

**Files:**
- `frontend/admin-portal/src/components/InstallPWA.jsx` — swap icon-only button for labeled chip.

**Estimated diff:** ~30 lines.

**Acceptance:**
- Open ERP in fresh Chrome profile, log in, see "Install Desktop App" chip in top bar.
- Click → Chrome install dialog opens → install → chip disappears immediately.
- Reopen as installed PWA → chip is hidden (standalone mode check already in place).
- On iPad Safari → chip reads "Add to Home Screen", clicks opens iOS tooltip.

### Phase 4.24.x-b — One-time install banner on first eligible load

**Goal:** Add a dismissable banner under the header that fires the first time `beforeinstallprompt` is captured per browser profile.

**Visual spec:**
- Full-width strip directly under the top bar, height ~52px.
- Background: forest green `#1D5A32` at 0.06 alpha. Bottom border: 1px solid `#1D5A32` at 0.15 alpha.
- Left: bold "Install Sovern House Operations" + secondary "for a faster, focused workspace."
- Right: primary CTA `[ ↓ Install ]` (forest green filled button) + secondary `[ Not now ]` (text-only, ink color at 0.55 alpha).
- Slide-in animation on mount (translateY -100% → 0, 240ms ease-out).
- Slide-out on dismiss or successful install.

**Persistence rules (localStorage):**
- Key: `sovern_pwa_install_banner_dismissed_at` (ISO timestamp).
- If set, suppress banner on all future loads, indefinitely. Do not nag.
- If user installs via chip or banner, also suppress (and `appinstalled` already hides the InstallPWA component).
- No reset path in UI. Reset is "clear site data" (acceptable; aligns with how Slack/Linear handle this).

**Mobile (admin-portal viewed in mobile browser):**
- Same banner. Looks fine at narrow widths thanks to the existing responsive layout.

**Files:**
- `frontend/admin-portal/src/components/InstallPWA.jsx` — extract banner into a sibling `<InstallPWABanner />` export OR mount as a second component (`<InstallPWA />` + `<InstallPWABanner />` both consume the same `beforeinstallprompt` event via a shared hook — preferred to keep concerns split).
- `frontend/admin-portal/src/hooks/useInstallPrompt.js` (NEW) — small hook that owns the `beforeinstallprompt` listener and exposes `{ canInstall, install, dismiss, dismissed }`. Both chip and banner consume it.
- `frontend/admin-portal/src/components/Layout.jsx` — mount `<InstallPWABanner />` just under `<header>`.

**Estimated diff:** ~150 lines (new hook + new banner component + tiny Layout change + refactor of InstallPWA to use the hook).

**Acceptance:**
- Open ERP in fresh Chrome profile, log in, see banner slide in within ~1 second of `beforeinstallprompt` firing.
- Click "Install" → Chrome dialog → install → banner slides out, never returns.
- Reload as web app → banner does not re-appear (localStorage dismissal honored).
- Open in second Chrome profile → banner appears fresh (per-profile, expected).
- Verify in DevTools that localStorage key is set correctly on both dismiss paths (install accepted + "Not now" clicked).

### Phase 4.24.x-c — Mobile (React Native) Settings entry

**Goal:** Three-Surface Rule compliance. Add a "Get the Desktop App" settings entry in the mobile app that opens a short explainer.

**Note:** React Native apps cannot trigger PWA installs. The mobile entry is purely documentation pointing the user at the desktop browser experience.

**Visual spec:**
- New `Settings` row in the mobile app, between existing entries.
- Title: "Get the Desktop App"
- Subtitle: "Install Sovern House Operations as a window on your computer."
- Icon: monitor / desktop icon from existing icon set.
- Tap → screen with three platform sections (macOS / Windows / iPad) and 2-3 line instructions each. No external links (we control all install paths).

**Files:**
- `mobile/sovern-ops-app/app/(tabs)/settings.tsx` — add row.
- `mobile/sovern-ops-app/app/desktop-app-install.tsx` (NEW) — explainer screen.

**Estimated diff:** ~120 lines.

**Acceptance:**
- Open mobile app → Settings → see new row → tap → explainer renders correctly on iOS + Android emulators.

---

## Order of execution

1. **4.24.x-a (chip)** first — single-file change, immediate visible improvement, low risk.
2. **4.24.x-b (banner)** second — depends on the hook extraction from 4.24.x-a being clean.
3. **4.24.x-c (mobile entry)** third — fulfills Three-Surface Rule, can ship in the same commit or as fast-follow.

All three should land in one PR for Three-Surface Rule compliance per CLAUDE.md rule #7. If mobile lands separately, the desktop PR must be marked WIP with a companion task tracking the mobile half.

---

## Out of scope

- Native desktop wrapper (Tauri/Electron). See earlier conversation — PWA covers the daily-use case; native wrapper is a whitelabel-sales question for a separate directive.
- Replacing the Phase 5b service worker. Working as designed.
- Adding install copy to the customer-portal or factory-portal. They are not the same product and their install story is a separate conversation.
- Analytics on banner dismiss vs install rate. Useful but separate; not blocking this directive.

---

## Risks

- **Brave does not fire `beforeinstallprompt` reliably.** Verified during this session. Chip and banner will simply not render in Brave. Acceptable — Brave users keep the status quo (browser tab). Optional follow-up: detect Brave user-agent and show a different message ("Open in Chrome or Edge to install as a desktop app"). Not in this directive.
- **iOS Safari has no install API.** The existing iOS tooltip flow already handles this for the chip; the banner copy will need a parallel iOS variant. Spec: on iOS, banner copy reads "Add Sovern House Operations to your Home Screen" with a "Show me how" CTA opening the same tooltip content. Add to 4.24.x-b acceptance.

---

## Approval gate

Before writing any code:
- [ ] Alex confirms the visual spec for chip + banner matches what he wants (or asks for adjustments).
- [ ] Alex confirms localStorage-dismiss-forever policy (vs e.g. "show again after 30 days").
- [ ] Alex confirms mobile Settings entry copy + that no external links is the right call.
- [ ] Alex confirms order of execution and whether all three land in one PR.
