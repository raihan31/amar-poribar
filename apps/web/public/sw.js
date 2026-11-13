// Amar Poribar service worker. App shell only; API responses are never cached.
// SW_VERSION comes from the registration URL (?v=<build hash>), so each build installs a new cache.
const SW_VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `ap-shell-${SW_VERSION}`;
const PRECACHE = [
  "/",
  "/offline",
  "/icons/192.png",
  "/icons/512.png",
  "/fonts/HindSiliguri-Regular.ttf",
  "/fonts/HindSiliguri-Medium.ttf",
  "/fonts/HindSiliguri-SemiBold.ttf",
  "/fonts/HindSiliguri-Bold.ttf",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const res = await fetch(url, { credentials: "same-origin" });
            // A redirect (e.g. "/" to login) cannot be replayed for navigations.
            if (res.ok && !res.redirected) await cache.put(url, res);
          } catch {
            /* offline during install: skip */
          }
        }),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("ap-shell-") && k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cache API responses

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(req)) || (await caches.match("/offline")) || Response.error()),
    );
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
