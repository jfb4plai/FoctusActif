self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'FocusActif'
  const body = data.body || 'Vous avez une tâche à faire.'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/plai-logo.jpg',
      vibrate: [200, 100, 200],
      silent: true,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow('/'))
})
