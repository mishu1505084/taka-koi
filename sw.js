/* Taka Koi? service worker: opens offline, keeps the page fresh when online.
   Bump VERSION when the app shell files change. */
const VERSION = "tk-v7";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];
/* third-party static files that are safe to keep: Firebase SDK, Google Fonts, the Excel library */
const STATIC_HOSTS = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com", "cdnjs.cloudflare.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* the page itself: network first so updates arrive, cached copy when offline */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put("./index.html", copy)); }
        return res;
      }).catch(() => caches.match("./index.html", { ignoreSearch: true }))
    );
    return;
  }

  /* same-origin files and CDN libraries: serve from cache, refresh in the background */
  const sameOrigin = url.origin === self.location.origin;
  const cdn = STATIC_HOSTS.includes(url.hostname) && (url.hostname !== "www.gstatic.com" || url.pathname.startsWith("/firebasejs/"));
  if (!sameOrigin && !cdn) return;   /* Firestore, Auth and everything else go straight to the network */
  e.respondWith(
    caches.open(VERSION).then(async c => {
      const hit = await c.match(req, { ignoreSearch: sameOrigin });
      const net = fetch(req).then(res => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })
  );
});
