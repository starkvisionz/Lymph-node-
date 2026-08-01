/*
 * service-worker.js — offline app shell for Lymph Flow.
 *
 * Precaches the whole (small, static) app — HTML/CSS/JS, the vendored Three.js,
 * icons and the manifest — so the guide launches with no network, e.g. from a
 * phone home screen. Cache-first for shell assets; navigations fall back to the
 * cached index.html when offline.
 *
 * Bump CACHE (or the app version) to ship an update: old caches are purged on
 * activate and the new worker takes control immediately.
 */
const VERSION = "1.0.0";
const CACHE = `lymphflow-v${VERSION}`;

// Paths are relative to the SW scope (served at the site root).
const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/styles.css",
  "js/app.js",
  "js/ui.js",
  "js/body.js",
  "js/data.js",
  "js/settings.js",
  "js/voice.js",
  "js/knowledge.js",
  "js/progress.js",
  "js/pwa.js",
  "js/version.js",
  "vendor/three/three.module.js",
  "vendor/three/addons/controls/OrbitControls.js",
  "assets/favicon.svg",
  "assets/icon.svg",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/apple-touch-icon.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      // Don't let one missing asset abort the whole install.
      .then(cache => Promise.allSettled(ASSETS.map(a => cache.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // only handle our own assets

  // Navigations: serve the cached shell when the network is unavailable.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("index.html", { ignoreSearch: true })
        .then(r => r || caches.match("./")))
    );
    return;
  }

  // Everything else: cache-first, then network (and cache the result).
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      });
    })
  );
});

// Allow the page to trigger an immediate update.
self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });
