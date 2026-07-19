export async function subscribeToPush(supabase, vapidPublicKey) {
  if (typeof Notification === 'undefined') return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidPublicKey,
  })

  const { data: userData } = await supabase.auth.getUser()
  const json = subscription.toJSON()

  await supabase.from('focus_push_subscriptions').upsert(
    {
      owner_id: userData.user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: 'endpoint' },
  )

  return subscription
}
