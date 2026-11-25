const CACHE_NAME = "assiya-static-v5";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./src/styles.css",
  "./src/app.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        STATIC_ASSETS.map(async (asset) => {
          try {
            const response = await fetch(asset, { cache: "reload" });
            if (response.ok) {
              await cache.put(asset, response);
            }
          } catch {
            // Не срываем установку PWA, если отдельный файл не закешировался.
          }
        }),
      );
      return self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  if (event.request.method !== "GET" || requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);
      const shouldPreferNetwork =
        event.request.mode === "navigate" ||
        ["document", "script", "style"].includes(event.request.destination);

      const networkResponsePromise = fetch(event.request).then((networkResponse) => {
        cache.put(event.request, networkResponse.clone());
        return networkResponse;
      });

      if (shouldPreferNetwork) {
        return networkResponsePromise.catch(() => cachedResponse || Response.error());
      }

      return cachedResponse || networkResponsePromise.catch(() => Response.error());
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "АССИЯ напоминает";
  const options = {
    body: payload.body || "У тебя есть задача, которая ждёт внимания.",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    data: {
      url: payload.url || "./",
      taskId: payload.taskId || "",
    },
    tag: payload.taskId ? `assiya-task-${payload.taskId}` : "assiya-reminder",
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "./", self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const existingClient = clientList.find((client) => client.url.startsWith(self.location.origin));
        if (existingClient) {
          existingClient.focus();
          return existingClient.navigate(targetUrl);
        }
        return clients.openWindow(targetUrl);
      }),
  );
});
