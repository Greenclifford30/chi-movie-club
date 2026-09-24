self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }
  const title = payload.title || "Chicago Movie Club";
  const options = {
    body: payload.body || "You have a new movie-night update.",
    icon: "/favicon.ico",
    data: { href: payload.href || "/notifications" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/notifications";
  event.waitUntil(clients.openWindow(href));
});
