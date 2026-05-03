// ─── Sovern ERP Service Worker ────────────────────────────────────────────────
// Enables PWA installability (Chrome requires a registered SW).
// Strategy:
//   - App shell (HTML/CSS/JS/icons): cache on install, serve from cache
//   - API calls (/api/*): always network — never serve stale data
//   - Navigation requests: network-first, fall back to cached index.html
//
// Bump CACHE_NAME on deploy to force clients to pick up new assets.

const CACHE_NAME = 'sovern-erp-v1';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/favicon-48x48.png',
  '/favicon-96x96.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
];

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll is all-or-nothing — if one asset fails, the install fails.
      // Use individual add() calls to be resilient if a non-critical asset 404s.
      Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url)))
    )
  );
  // Skip the waiting state so the new SW activates immediately on page reload.
  self.skipWaiting();
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all open pages immediately (don't wait for a reload).
  self.clients.claim();
});

// ── Fetch: routing strategy ───────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. API calls — always go to the network, never cache.
  //    Stale trade data (prices, statuses) would be dangerous.
  if (url.pathname.startsWith('/api/')) {
    return; // fall through to the browser's default network fetch
  }

  // 2. Cross-origin requests — don't interfere.
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. Navigation requests (HTML pages) — network-first with cache fallback.
  //    This ensures the user always gets a fresh page when online, but can
  //    still load the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache a fresh copy on each successful navigation.
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
          return response;
        })
        .catch(() =>
          // Offline: serve the cached app shell so React Router can handle routing.
          caches.match('/').then((cached) => cached || caches.match('/index.html'))
        )
    );
    return;
  }

  // 4. Static assets — cache-first.
  //    JS/CSS/images are fingerprinted by Vite, so stale content isn't a concern.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      // Not in cache — fetch and cache it for next time.
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
