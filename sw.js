```javascript
const C = "slconnect-v9";

const FILES = [
    "./",
    "index.html",
    "style.css",
    "config.js",
    "backend.js",
    "app.js",
    "otp-reset.js",
    "features.js",
    "chat.js",
    "social.js",
    "extra.css",
    "chat.css",
    "manifest.json",
    "icon-192.png",
    "icon-512.png"
];

// INSTALL
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(C)
            .then(cache => cache.addAll(FILES))
            .then(() => self.skipWaiting())
    );
});

// ACTIVATE
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys =>
                Promise.all(
                    keys
                        .filter(key => key !== C)
                        .map(key => caches.delete(key))
                )
            )
            .then(() => self.clients.claim())
    );
});

// OFFLINE CACHING
self.addEventListener("fetch", event => {
    const url = new URL(event.request.url);

    if (
        event.request.method !== "GET" ||
        (url.origin !== location.origin &&
         url.hostname !== "cdn.jsdelivr.net")
    ) return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                const copy = response.clone();

                caches.open(C)
                    .then(cache => cache.put(event.request, copy));

                return response;
            })
            .catch(() =>
                caches.match(event.request)
                    .then(cached =>
                        cached || caches.match("index.html")
                    )
            )
    );
});

// RECEIVE PUSH NOTIFICATIONS
self.addEventListener("push", event => {

    let data = {};

    try {
        data = event.data ? event.data.json() : {};
    } catch (error) {
        data = {
            title: "GoodSchool",
            message: event.data ? event.data.text() : "New notification"
        };
    }

    const title = data.title || "GoodSchool";

    const options = {
        body: data.message || data.body || "You have a new message.",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: data.tag || "goodschool-notification",
        data: {
            url: data.url || "/"
        },
        vibrate: [200, 100, 200]
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// WHEN USER CLICKS NOTIFICATION
self.addEventListener("notificationclick", event => {

    event.notification.close();

    const targetUrl = new URL(
        event.notification.data.url || "/",
        self.location.origin
    ).href;

    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then(windowClients => {

            for (const client of windowClients) {
                if (client.url.startsWith(self.location.origin)) {
                    return client.focus().then(() =>
                        client.navigate(targetUrl)
                    );
                }
            }

            return clients.openWindow(targetUrl);
        })
    );
});
```
