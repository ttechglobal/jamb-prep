// JAMB Prep service worker. It exists for reminders: it shows push notifications and opens the app
// when one is tapped. It deliberately caches nothing, so students never see a stale question bank.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
