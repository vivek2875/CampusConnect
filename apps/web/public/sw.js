self.addEventListener('push', (event) => {
  const payload = event.data?.json() || { title: 'CampusConnect', body: 'You have a new notification.', link: '/notifications' };
  event.waitUntil(self.registration.showNotification(payload.title, { body: payload.body, data: { link: payload.link } }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.link || '/notifications'));
});
