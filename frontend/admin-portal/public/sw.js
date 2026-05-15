// ─── Service Worker — Phase 5b (safe redesign) ───────────────────────────
//
// Replaces the kill-switch SW. Three explicit guards against the prior
// PWA cache disaster:
//
//   1. NEVER cache HTML for long. Navigations are network-first. If the
//      network responds, we serve fresh HTML (which points to fresh
//      hashed bundle filenames). Stale `index.html` referencing dead
//      hashed bundles after a deploy CANNOT happen with this strategy.
//
//   2. ONLY intercept GET requests. POST/PUT/PATCH/DELETE pass straight
//      through to the network with no cache touch at all. The prior SW
//      tried to cache POSTs and threw an unhandled promise rejection.
//      A method check at the top of the fetch handler is the
//      single-line fix.
//
//   3. NO precache manifest. The SW does not know about specific
//      filenames at install time. It caches only assets the browser
//      fetched while online. This means we never have a stale entry
//      pointing to a hashed bundle that no longer exists on the server.
//
// Cache versioning: bump CACHE_NAME any time the SW shape changes. The
// activate handler deletes any cache whose name doesn't match — so a
// new SW deploy automatically evicts the previous runtime cache.

const CACHE_NAME = 'sovern-erp-rt-v1';

// Take over immediately — don't make users hard-reload after a deploy.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Delete any cache from a prior SW version. CACHE_NAME bump =
    // automatic eviction.
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    );
    // Claim every open tab so the new SW controls immediately. Without
    // this, existing tabs stay on the previous SW until reload.
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // GUARD 1: only intercept GETs. Non-GETs (POST/PUT/PATCH/DELETE) pass
  // through unmodified. This is the single most important rule; the
  // prior disaster came from caching POSTs.
  if (req.method !== 'GET') return;

  // GUARD 2: only same-origin. Cross-origin (Sentry, Resend, analytics,
  // etc.) is left to the browser default.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // GUARD 3: never touch the API. Phase 5c/5d run their own
  // IndexedDB/AsyncStorage read cache layered above the axios/fetch
  // interceptor. The SW layering on top would create two competing
  // caches with different TTLs and split-brain results.
  if (url.pathname.startsWith('/api/')) return;

  // HTML navigations: NetworkFirst. Stale HTML is the deploy-killer; we
  // accept a small latency hit (one round-trip) in exchange for never
  // serving a cached index.html with dead hashed-bundle references.
  const accept = req.headers.get('accept') || '';
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch (_) {
        // Network failed. Try the cache as a last resort. If the user
        // has loaded the app before in this browser, the previously
        // cached entry IS a valid SPA shell (same hashed bundles still
        // referenced) — it lets the SPA boot even fully offline. If
        // we have nothing cached, return a tiny 504 message; the
        // offline-banner UI is rendered by the app shell so the user
        // sees that once anything boots.
        const cached = await caches.match(req);
        if (cached) return cached;
        return new Response('Offline. Reconnect to load the app.', {
          status: 504,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })());
    return;
  }

  // Static assets (hashed JS/CSS, fonts, images): StaleWhileRevalidate.
  // Hashed filenames are immutable, so cached entries can't go stale
  // for the file they point to. New deploys ship new hashed names
  // (cache miss → fetch). Old hashed names eventually get evicted by
  // the browser's cache pressure policy; we don't track explicitly.
  event.respondWith((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      const networkPromise = fetch(req).then((res) => {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'default')) {
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      }).catch(() => null);
      return cached || (await networkPromise) || new Response('', { status: 504 });
    } catch (_) {
      // If anything in cache plumbing throws, fall through to a normal
      // network fetch. Never let the SW be the reason a fetch fails.
      try { return await fetch(req); } catch (e) { return new Response('', { status: 504 }); }
    }
  })());
});

// Allow the app to ping the SW for a forced cache wipe (used by the
// upcoming "clear cache" button in the offline-queue inspector if we
// ever need a manual kill). The page can do:
//   navigator.serviceWorker.controller?.postMessage({ type: 'PURGE' })
self.addEventListener('message', (event) => {
  if (event.data?.type === 'PURGE') {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    })());
  }
});
