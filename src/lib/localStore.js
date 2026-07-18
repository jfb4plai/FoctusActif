import { openDb, put, getAll, get } from './idbHelpers.js'

const DB_VERSION = 1

async function listSubtasksOf(db, parentTaskId) {
  const all = await getAll(db, 'tasks')
  return all
    .filter((t) => t.parentTaskId === parentTaskId)
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
      let stepOrder = 0
      if (parentTaskId) {
        const siblings = await listSubtasksOf(db, parentTaskId)
        stepOrder = siblings.length
      }
      const task = {
        id: crypto.randomUUID(),
        contextId,
        title,
        status: 'todo',
        parentTaskId,
        stepOrder,
        createdAt: new Date().toISOString(),
        doneAt: null,
      }
      await put(db, 'tasks', task)
      return task
    },

    async listSubtasks(parentTaskId) {
      return listSubtasksOf(db, parentTaskId)
    },

    async getNextTask(contextId) {
      const all = await getAll(db, 'tasks')
      const rootTasks = all
        .filter((t) => t.contextId === contextId && t.parentTaskId === null)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

      for (const root of rootTasks) {
        if (root.status === 'done') continue

        const subtasks = all
          .filter((t) => t.parentTaskId === root.id && t.status === 'todo')
          .sort((a, b) => a.stepOrder - b.stepOrder)

        return subtasks.length > 0 ? subtasks[0] : root
      }

      return null
    },

    async completeTask(taskId) {
      const task = await get(db, 'tasks', taskId)
      if (!task) return
      await put(db, 'tasks', { ...task, status: 'done', doneAt: new Date().toISOString() })
    },
  }
}
