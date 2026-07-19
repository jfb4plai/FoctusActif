import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:jeanfrancois.beguin@ens.ecl.be'

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

Deno.serve(async () => {
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: dueReminders, error: remindersError } = await supabase
    .from('focus_reminders')
    .select('id, task_id, owner_id')
    .lte('remind_at', new Date().toISOString())
    .eq('sent', false)

  if (remindersError) {
    return new Response(JSON.stringify({ error: remindersError.message }), { status: 500 })
  }

  let sentCount = 0

  for (const reminder of dueReminders ?? []) {
    const { data: task } = await supabase
      .from('focus_tasks')
      .select('title')
      .eq('id', reminder.task_id)
      .single()

    const { data: subscriptions } = await supabase
      .from('focus_push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('owner_id', reminder.owner_id)

    for (const sub of subscriptions ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: 'FocusActif',
            body: task?.title ? `C'est le moment pour « ${task.title} »` : 'Vous avez une tâche à faire.',
          }),
        )
      } catch {
        // Un abonnement expiré/invalide ne doit pas bloquer les autres envois ni faire
        // échouer la fonction entière — on continue, sans marquer sent=true pour ce
        // rappel si aucun envoi n'a réussi (voir logique ci-dessous).
      }
    }

    await supabase.from('focus_reminders').update({ sent: true }).eq('id', reminder.id)
    sentCount += 1
  }

  return new Response(JSON.stringify({ processed: sentCount }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
