import { openDb, put, getAll, get } from './idbHelpers.js'

const DB_VERSION = 1

async function listSubtasksOf(db, parentTaskId) {
  const all = await getAll(db, 'tasks')
  return all
    .filter((t) => t.parentTaskId === parentTaskId)
    .sort((a, b) => a.stepOrder - b.stepOrder)
}

async function listRootTasksOf(db, contextId) {
  const all = await getAll(db, 'tasks')
  return all
    .filter((t) => t.contextId === contextId && t.parentTaskId === null)
    .sort((a, b) => a.stepOrder - b.stepOrder)
}

function upgrade(db) {
  if (!db.objectStoreNames.contains('contexts')) {
    db.createObjectStore('contexts', { keyPath: 'id' })
  }
  if (!db.objectStoreNames.contains('tasks')) {
    const store = db.createObjectStore('tasks', { keyPath: 'id' })
    store.createIndex('contextId', 'contextId')
    store.createIndex('parentTaskId', 'parentTaskId')
  }
}

export async function createLocalStore(dbName = 'focusactif') {
  const db = await openDb(dbName, DB_VERSION, upgrade)

  return {
    async listContexts() {
      return getAll(db, 'contexts')
    },

    async addContext(label, emoji) {
      const context = {
        id: crypto.randomUUID(),
        label,
        emoji,
        locked: false,
      }
      await put(db, 'contexts', context)
      return context
    },

    async addTask(contextId, title, parentTaskId = null) {
      const siblings = parentTaskId
        ? await listSubtasksOf(db, parentTaskId)
        : await listRootTasksOf(db, contextId)
      const stepOrder = siblings.length
      const task = {
        id: crypto.randomUUID(),
        contextId,
        title,
        status: 'todo',
        parentTaskId,
        stepOrder,
        createdAt: new Date().toISOString(),
        doneAt: null,
        remindAt: null,
        reminderSent: false,
      }
      await put(db, 'tasks', task)
      return task
    },

    async listSubtasks(parentTaskId) {
      return listSubtasksOf(db, parentTaskId)
    },

    // Une seule tâche affichée à la fois : les tâches racines sont parcourues par
    // ordre de création (stepOrder, attribué séquentiellement à la création — fiable
    // même en cas d'égalité de createdAt à la milliseconde près), les racines déjà
    // terminées sont ignorées ; pour la première racine encore active, sa première
    // sous-étape non terminée (par stepOrder) est prioritaire sur la racine elle-même,
    // qui ne redevient "la tâche à faire" que lorsque toutes ses sous-étapes sont
    // terminées.
    async getNextTask(contextId) {
      const rootTasks = await listRootTasksOf(db, contextId)

      for (const root of rootTasks) {
        if (root.status === 'done') continue

        const subtasks = (await listSubtasksOf(db, root.id)).filter((t) => t.status === 'todo')

        return subtasks.length > 0 ? subtasks[0] : root
      }

      return null
    },

    async completeTask(taskId) {
      const task = await get(db, 'tasks', taskId)
      if (!task) return
      await put(db, 'tasks', { ...task, status: 'done', doneAt: new Date().toISOString() })
    },

    async setReminder(taskId, remindAtIso) {
      const task = await get(db, 'tasks', taskId)
      if (!task) return
      await put(db, 'tasks', { ...task, remindAt: remindAtIso, reminderSent: false })
    },

    async clearReminder(taskId) {
      const task = await get(db, 'tasks', taskId)
      if (!task) return
      await put(db, 'tasks', { ...task, remindAt: null, reminderSent: false })
    },

    async markReminderSent(taskId) {
      const task = await get(db, 'tasks', taskId)
      if (!task) return
      await put(db, 'tasks', { ...task, reminderSent: true })
    },
  }
}
