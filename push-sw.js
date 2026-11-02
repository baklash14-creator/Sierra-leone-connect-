/* SL Connect - push notification worker.
   Registered by chat2.js under its own scope, so it will not clash with any service worker you already have. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

const APP = () => new URL("../", self.registration.scope).href;   // folder that holds index.html

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // the app is open and in view: the in-app toast already tells them
    if (wins.some(w => w.visibilityState === "visible" && w.focused)) return;
    await self.registration.showNotification(d.title || "SL Connect", {
      body: d.body || "You have a new message",
      icon: APP() + "icon-192.png",
      badge: APP() + "icon-192.png",
      tag: d.conv || "slc",          // one notification per chat
      renotify: true,
      data: { conv: d.conv || "" }
    });
  })());
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const conv = (e.notification.data && e.notification.data.conv) || "";
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const w = wins[0];
    if (w) {
      await w.focus();
      w.postMessage({ type: "slc-open-chat", conv });
    } else {
      await self.clients.openWindow(APP() + (conv ? "?chat=" + encodeURIComponent(conv) : ""));
    }
  })());
});
