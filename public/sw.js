// Procyra service worker — Phase 1 offline scope (honest): the app shell and
// previously visited pages are cached network-first, so you can re-open and
// READ recently loaded data offline. Offline data ENTRY with sync is a
// documented Phase 2+ roadmap item, not a claimed feature.
const CACHE = "procyra-v1";
const OFFLINE_FALLBACK = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE_FALLBACK, "/manifest.json"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // never cache mutations
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Network-first for pages, cache fallback; cache-first for static assets.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match(OFFLINE_FALLBACK)))
    );
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
  }
});
