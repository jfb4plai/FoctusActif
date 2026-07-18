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

    it('addTask crée une tâche racine todo', async () => {
      const store = await createStore()
      const context = await store.addContext('Devoirs', '📚')
      const task = await store.addTask(context.id, 'Faire l\'exposé')
      expect(task.title).toBe('Faire l\'exposé')
      expect(task.status).toBe('todo')
      expect(task.contextId).toBe(context.id)
      expect(task.parentTaskId).toBeNull()
      expect(task.doneAt).toBeNull()
    })

    it('addTask avec parentTaskId crée une sous-étape ordonnée', async () => {
      const store = await createStore()
      const context = await store.addContext('Devoirs', '📚')
      const parent = await store.addTask(context.id, 'Faire l\'exposé')
      const step1 = await store.addTask(context.id, 'Choisir le sujet', parent.id)
      const step2 = await store.addTask(context.id, 'Écrire le plan', parent.id)

      expect(step1.parentTaskId).toBe(parent.id)
      expect(step1.stepOrder).toBe(0)
      expect(step2.stepOrder).toBe(1)

      const subtasks = await store.listSubtasks(parent.id)
      expect(subtasks.map((t) => t.title)).toEqual(['Choisir le sujet', 'Écrire le plan'])
    })
  })
}
