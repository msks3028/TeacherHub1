/* One application worker: static shell/offline behavior and Web Push events. */
const CACHE_PREFIX = "teacherhub-shell-";
// Vite replaces these placeholders during production builds. The build hash
// makes every asset release install a fresh worker cache, including lazy routes.
const BUILD_CACHE_VERSION = /*__BUILD_CACHE_VERSION__*/;
const CACHE_NAME = `${CACHE_PREFIX}v3-${BUILD_CACHE_VERSION}`;
const PRECACHE_ASSETS = /*__PRECACHE_ASSETS__*/;
const APP_SHELL = ["/", "/offline.html", "/manifest.webmanifest", "/icons/teacherhub-192.png", "/icons/teacherhub-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll([...new Set([...APP_SHELL, ...PRECACHE_ASSETS])]);
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Authentication, private content, uploads, and every API response remain network-only.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put("/", response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match("/")) || (await cache.match("/offline.html"));
      }
    })());
    return;
  }

  // Only Vite's public build directory is eligible. API and uploaded files
  // are excluded above, and no hash alphabet is assumed here.
  const isBuiltAsset = url.pathname.startsWith("/assets/") && /\.(js|css|woff2?|png|webp|svg)$/i.test(url.pathname);
  const isShellFile = APP_SHELL.includes(url.pathname);
  if (!isBuiltAsset && !isShellFile) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === "basic") await cache.put(request, response.clone());
      return response;
    } catch {
      return cached || Response.error();
    }
  })());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { body: event.data?.text() || "" }; }
  const title = String(payload.title || "TeacherHub").slice(0, 100);
  const body = String(payload.body || "لديك إشعار جديد.").slice(0, 240);
  const path = typeof payload.url === "string" && payload.url.startsWith("/") && !payload.url.startsWith("//") ? payload.url : "/";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/icons/teacherhub-192.png",
    badge: "/icons/teacherhub-192.png",
    tag: payload.tag ? String(payload.tag).slice(0, 100) : undefined,
    data: { path },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.path;
  const target = new URL(typeof path === "string" && path.startsWith("/") && !path.startsWith("//") ? path : "/", self.location.origin).href;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      if ("navigate" in existing && existing.url !== target) await existing.navigate(target);
    } else {
      await self.clients.openWindow(target);
    }
  })());
});
