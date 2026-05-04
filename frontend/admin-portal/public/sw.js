// ─── Kill-switch service worker ──────────────────────────────────────────────
// Replaces the previous PWA cache layer that was serving stale index.html and
// hashed bundle filenames, breaking every UI deploy. The cache strategy was
// also buggy (POST cannot be cached → unhandled promise rejection in sw.js:98).
//
// On install: skip waiting so this SW takes over immediately.
// On activate: delete every Cache Storage entry and unregister this SW so the
// browser stops intercepting fetches entirely. After one page load + reload,
// the browser is back to a vanilla no-SW state.
//
// Pair with: removing the navigator.serviceWorker.register() call in index.jsx
// so future page loads don't re-register a SW at all. The fetch-event listener
// is intentionally a no-op so the browser doesn't flag the SW as a network
// proxy during the brief window before unregister completes.

self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
    await self.registration.unregister()
    const clients = await self.clients.matchAll({ type: 'window' })
    for (const c of clients) {
      try { c.navigate(c.url) } catch {}
    }
  })())
})

self.addEventListener('fetch', () => {})
