import { useEffect, useState } from 'react'

const POLL_INTERVAL_MS = 20000

export function useReminderWatcher(store, task) {
  const [dueReminder, setDueReminder] = useState(false)
  const [notifiedTaskId, setNotifiedTaskId] = useState(null)
  const [prevTaskId, setPrevTaskId] = useState(task?.id)

  // Reset tracked state when the watched task changes. Adjusting state
  // during render (rather than in an effect) avoids an extra render pass
  // and the associated "setState in effect" lint warning.
  if (prevTaskId !== task?.id) {
    setPrevTaskId(task?.id)
    setNotifiedTaskId(null)
    setDueReminder(false)
  }

  useEffect(() => {
    if (!store || !task || !task.remindAt || task.reminderSent) return
    if (notifiedTaskId === task.id) return

    function checkDue() {
      if (new Date(task.remindAt) > new Date()) return

      setNotifiedTaskId(task.id)
      setDueReminder(true)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200])
      }
      store.markReminderSent(task.id)
    }

    checkDue()
    const interval = setInterval(checkDue, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [store, task, notifiedTaskId])

  return dueReminder
}
