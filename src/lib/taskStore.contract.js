import { describe, it, expect } from 'vitest'

/**
 * Suite de tests de contrat pour toute implémentation de TaskStore.
 * @param {() => Promise<import('./localStore.js').TaskStore>} createStore
 */
export function runTaskStoreContractTests(createStore) {
  describe('TaskStore contract', () => {
    it('listContexts retourne un tableau vide au départ', async () => {
      const store = await createStore()
      expect(await store.listContexts()).toEqual([])
    })

    it('addContext puis listContexts retourne le contexte créé', async () => {
      const store = await createStore()
      const created = await store.addContext('École', '🏫')
      expect(created.label).toBe('École')
      expect(created.emoji).toBe('🏫')
      expect(created.locked).toBe(false)
      expect(typeof created.id).toBe('string')

      const contexts = await store.listContexts()
      expect(contexts).toHaveLength(1)
      expect(contexts[0]).toEqual(created)
    })
  })
}
