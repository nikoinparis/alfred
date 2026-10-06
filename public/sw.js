/* Alfred service worker: offline shell + runtime caching. No build step needed. */
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const PAGES = `alfred-pages-${VERSION}`;
const STATIC = "alfred-static-v1";
const RUNTIME = `alfred-runtime-${VERSION}`;
const ROUTES = ["/", "/plan", "/body", "/fuel", "/history", "/settings", "/about"];

async function precache() {
  const pages = await caches.open(PAGES);
  const statics = await caches.open(STATIC);
  const assets = new Set();
  await Promise.all(
    ROUTES.map(async (route) => {
      try {
        const res = await fetch(route, { cache: "no-store" });
        if (!res.ok) return;
        const html = await res.clone().text();
        for (const m of html.matchAll(/["'(](\/_next\/static\/[^"')\s]+)/g)) assets.add(m[1]);
        await pages.put(route, res);
      } catch {
        /* offline during install: runtime caching will fill in */
      }
    }),
  );
  await Promise.all(
    [...assets].map(async (url) => {
      if (await statics.match(url)) return;
      try {
        const res = await fetch(url);
        if (res.ok) await statics.put(url, res);
      } catch {}
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, STATIC, RUNTIME]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    // Google Fonts files: cache-first.
    if (url.hostname.endsWith("gstatic.com")) event.respondWith(cacheFirst(req, STATIC));
    return;
  }
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES);
        try {
          const res = await Promise.race([fetch(req), timeout(3500)]);
          if (res.ok) cache.put(url.pathname, res.clone());
          return res;
        } catch {
          return (
            (await cache.match(url.pathname)) ||
            (await cache.match("/")) ||
            new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } })
          );
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC));
    return;
  }
  if (url.searchParams.has("_rsc")) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}
