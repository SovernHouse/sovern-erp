# Sovern Ops — Mobile App

Internal ERP companion app for the Sovern House team. Built with Expo (React Native).

## Quick Start

```bash
cd Mobile/sovern-ops-app
npm install
npx expo start
```

Scan the QR code with **Expo Go** (iOS App Store / Google Play) to open on your phone instantly.
No build step, no Xcode, no Android Studio required for development.

## Screens

| Tab | What it does |
|---|---|
| Dashboard | Open leads, pending approvals, pipeline value |
| Leads | Scrollable lead list with search and status filter |
| Approvals | One-tap approve or flag documents (PIs, SOs, packing lists) |
| Settings | Profile, server URL, sign out |

## Configuration

Edit `src/constants/config.ts`:

```ts
export const CONFIG = {
  SERVER_URL: 'https://erp.sovernhouse.co', // change for local dev
  TOKEN_KEY: 'sovern_ops_token',
};
```

For local testing against your Windows ERP dev server:
1. Find your machine's LAN IP: `ipconfig` → IPv4 Address (e.g. 192.168.1.42)
2. Set `SERVER_URL: 'http://192.168.1.42:3001'`
3. Your phone and computer must be on the same Wi-Fi network

## Backend Requirements

No backend changes needed for Phase 1. All endpoints already exist:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dashboard`
- `GET /api/leads`
- `GET /api/approvals/pending`
- `POST /api/approvals/:id/approve`
- `POST /api/approvals/:id/flag`

## Distribution

### Development (now)
Use Expo Go app — scan QR from `npx expo start`. Works immediately.

### TestFlight (iOS, internal)
```bash
npx expo build:ios   # or use EAS Build
```
Requires Apple Developer Program ($99/year).

### APK (Android, internal)
```bash
npx expo build:android
```
Share the APK file directly — no Play Store needed for internal use.

## File Structure

```
app/
  _layout.tsx          — root layout + auth guard
  (auth)/
    login.tsx           — login screen
  (tabs)/
    _layout.tsx         — tab navigator
    dashboard.tsx       — pipeline summary
    leads.tsx           — lead list + search
    approvals.tsx       — document approvals
    settings.tsx        — profile + logout
src/
  constants/config.ts   — server URL, colours, tokens
  services/api.ts       — all API calls (typed)
  store/authStore.ts    — Zustand auth state
```
