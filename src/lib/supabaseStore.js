export function createSupabaseStore(supabase) {
  async function requireUserId() {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) throw new Error('not_authenticated')
    return data.user.id
  }

  return {
    async listContexts() {
      const ownerId = await requireUserId()
      const { data, error } = await supabase
        .from('focus_contexts')
        .select('id, label, emoji, locked')
        .eq('owner_id', ownerId)
      if (error) throw error
      return data
    },

    async addContext(label, emoji) {
      const ownerId = await requireUserId()
      const { data, error } = await supabase
        .from('focus_contexts')
        .insert({ owner_id: ownerId, label, emoji, locked: false })
        .select('id, label, emoji, locked')
        .single()
      if (error) throw error
      return data
    },

    async addTask(contextId, title, parentTaskId = null) {
      const ownerId = await requireUserId()
      const siblings = parentTaskId
        ? await this.listSubtasks(parentTaskId)
        : await listRootTasks(supabase, contextId)
      const stepOrder = siblings.length

      const { data, error } = await supabase
        .from('focus_tasks')
        .insert({
          context_id: contextId,
          owner_id: ownerId,
          title,
          status: 'todo',
          parent_task_id: parentTaskId,
          step_order: stepOrder,
          done_at: null,
        })
        .select('id, context_id, title, status, parent_task_id, step_order, created_at, done_at')
        .single()
      if (error) throw error
      return { ...toTask(data), remindAt: null, reminderSent: false }
    },

    async listSubtasks(parentTaskId) {
      const { data, error } = await supabase
        .from('focus_tasks')
        .select('id, context_id, title, status, parent_task_id, step_order, created_at, done_at')
        .eq('parent_task_id', parentTaskId)
        .order('step_order', { ascending: true })
      if (error) throw error
      return attachReminders(supabase, data.map(toTask))
    },

    async getNextTask(contextId) {
      const rootTasks = await listRootTasks(supabase, contextId)

      for (const root of rootTasks) {
        if (root.status === 'done') continue

        const subtasks = (await this.listSubtasks(root.id)).filter((t) => t.status === 'todo')
        const result = subtasks.length > 0 ? subtasks[0] : root
        const [withReminder] = await attachReminders(supabase, [result])
        return withReminder
      }

      return null
    },

    async completeTask(taskId) {
      const { error } = await supabase
        .from('focus_tasks')
        .update({ status: 'done', done_at: new Date().toISOString() })
        .eq('id', taskId)
      if (error) throw error
    },

    async setReminder(taskId, remindAtIso) {
      const ownerId = await requireUserId()
      const { error } = await supabase
        .from('focus_reminders')
        .upsert(
          { task_id: taskId, owner_id: ownerId, remind_at: remindAtIso, sent: false },
          { onConflict: 'task_id' },
        )
      if (error) throw error
    },

    async clearReminder(taskId) {
      const { error } = await supabase.from('focus_reminders').delete().eq('task_id', taskId)
      if (error) throw error
    },

    async markReminderSent(taskId) {
      const { error } = await supabase.from('focus_reminders').update({ sent: true }).eq('task_id', taskId)
      if (error) throw error
    },

    async renameContext(contextId, newLabel) {
      const { error } = await supabase.from('focus_contexts').update({ label: newLabel }).eq('id', contextId)
      if (error) throw error
    },

    async deleteContext(contextId) {
      const { error } = await supabase.from('focus_contexts').delete().eq('id', contextId)
      if (error) throw error
    },

    async renameTask(taskId, newTitle) {
      const { error } = await supabase.from('focus_tasks').update({ title: newTitle }).eq('id', taskId)
      if (error) throw error
    },

    async deleteTask(taskId) {
      const { error } = await supabase.from('focus_tasks').delete().eq('id', taskId)
      if (error) throw error
    },

    async uncompleteTask(taskId) {
      const { error } = await supabase
        .from('focus_tasks')
        .update({ status: 'todo', done_at: null })
        .eq('id', taskId)
      if (error) throw error
    },
  }
}

async function listRootTasks(supabase, contextId) {
  const { data, error } = await supabase
    .from('focus_tasks')
    .select('id, context_id, title, status, parent_task_id, step_order, created_at, done_at')
    .eq('context_id', contextId)
    .is('parent_task_id', null)
    .order('step_order', { ascending: true })
  if (error) throw error
  return attachReminders(supabase, data.map(toTask))
}

async function attachReminders(supabase, tasks) {
  if (tasks.length === 0) return tasks
  const taskIds = tasks.map((t) => t.id)
  const { data, error } = await supabase
    .from('focus_reminders')
    .select('task_id, remind_at, sent')
    .in('task_id', taskIds)
  if (error) throw error
  const byTaskId = Object.fromEntries(data.map((r) => [r.task_id, r]))
  return tasks.map((t) => ({
    ...t,
    remindAt: byTaskId[t.id]?.remind_at ?? null,
    reminderSent: byTaskId[t.id]?.sent ?? false,
  }))
}

function toTask(row) {
  return {
    id: row.id,
    contextId: row.context_id,
    title: row.title,
    status: row.status,
    parentTaskId: row.parent_task_id,
    stepOrder: row.step_order,
    createdAt: row.created_at,
    doneAt: row.done_at,
  }
}
