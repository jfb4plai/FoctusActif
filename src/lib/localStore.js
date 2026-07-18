import { openDb, put, getAll, get, remove } from './idbHelpers.js'

const DB_VERSION = 1

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
  }
}
