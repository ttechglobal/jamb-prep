// JAMB Prep service worker. It shows reminders and keeps the app quick on a poor connection.
//
// What it keeps, and what it never does:
//  - Built files (/_next/static) and fonts and icons never change under the same address, so they come from the
//    device first. Opening the app on a weak network no longer waits for them.
//  - Notes (/api/read) are answered from the device at once and refreshed behind the scenes.
//  - Questions, answers, progress and pages are never kept here, so a student never sees a stale question bank.

const STATIC = "jp-static-v1";
const NOTES = "jp-notes-v1";
const KEEP = [STATIC, NOTES];
// A dev server rebuilds files under the same address, so it is left alone.
const DEV = ["localhost", "127.0.0.1"].includes(self.location.hostname);

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => !KEEP.includes(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  ),
);

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(NOTES);
  const hit = await cache.match(event.request);
  const refresh = fetch(event.request)
    .then((res) => {
      if (res.ok) cache.put(event.request, res.clone());
      return res;
    })
    .catch(() => null);
  if (hit) {
    event.waitUntil(refresh);
    return hit;
  }
  return (await refresh) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (DEV || request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(woff2?|png|jpg|svg)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  } else if (url.pathname.startsWith("/api/read/") && !url.pathname.startsWith("/api/read/complete")) {
    event.respondWith(staleWhileRevalidate(event));
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "JAMB Prep";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "Time for a quick round.",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: payload.tag || "jambprep-reminder",
      data: { url: payload.url || "/practice" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/practice", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          w.focus();
          return "navigate" in w ? w.navigate(target) : undefined;
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
