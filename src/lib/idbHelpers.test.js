import { describe, it, expect, beforeEach } from 'vitest'
import { openDb, put, getAll, get, remove } from './idbHelpers.js'

describe('idbHelpers', () => {
  let db

  beforeEach(async () => {
    db = await openDb(`test-db-${Math.random()}`, 1, (database) => {
      database.createObjectStore('items', { keyPath: 'id' })
    })
  })

  it('put puis get retourne l\'objet stocké', async () => {
    await put(db, 'items', { id: 'a1', label: 'Premier' })
    const item = await get(db, 'items', 'a1')
    expect(item).toEqual({ id: 'a1', label: 'Premier' })
  })

  it('getAll retourne tous les objets du store', async () => {
    await put(db, 'items', { id: 'a1', label: 'Premier' })
    await put(db, 'items', { id: 'a2', label: 'Second' })
    const items = await getAll(db, 'items')
    expect(items).toHaveLength(2)
    expect(items.map((i) => i.id).sort()).toEqual(['a1', 'a2'])
  })

  it('remove supprime l\'objet', async () => {
    await put(db, 'items', { id: 'a1', label: 'Premier' })
    await remove(db, 'items', 'a1')
    const item = await get(db, 'items', 'a1')
    expect(item).toBeUndefined()
  })
})
