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
      return toTask(data)
    },

    async listSubtasks(parentTaskId) {
      const { data, error } = await supabase
        .from('focus_tasks')
        .select('id, context_id, title, status, parent_task_id, step_order, created_at, done_at')
        .eq('parent_task_id', parentTaskId)
        .order('step_order', { ascending: true })
      if (error) throw error
      return data.map(toTask)
    },

    async getNextTask(contextId) {
      const rootTasks = await listRootTasks(supabase, contextId)

      for (const root of rootTasks) {
        if (root.status === 'done') continue

        const subtasks = (await this.listSubtasks(root.id)).filter((t) => t.status === 'todo')
        return subtasks.length > 0 ? subtasks[0] : root
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
  return data.map(toTask)
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
