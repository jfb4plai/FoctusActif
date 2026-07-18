# FocusActif — Plan 1 : Cœur local (TaskStore + LocalStore + UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer une webapp FocusActif utilisable de bout en bout en mode local uniquement (sans compte, sans Supabase) : filtrage par contexte, une seule tâche affichée à la fois, décomposition en sous-étapes, capture rapide avec dictée en secours.

**Architecture:** Une interface `TaskStore` (contrat JSDoc) implémentée par `LocalStore` (IndexedDB via un petit helper maison). L'UI React (`ContextPicker` → `TaskDashboard` → `DecomposeSheet`/`QuickCapture`) ne parle jamais directement à IndexedDB, uniquement à `TaskStore` via un contexte React (`StoreContext`). Un fichier de tests de contrat partagé (`taskStore.contract.js`) sera réutilisé tel quel au Plan 2 contre `SupabaseStore`.

**Tech Stack:** React 19 + Vite 8 + Tailwind CSS v3 (gabarit PLAI), Vitest + Testing Library + jsdom, IndexedDB natif (pas de librairie tierce), `fake-indexeddb` pour les tests.

---

## Vue d'ensemble des fichiers

```
focusactif/
  index.html
  package.json
  vite.config.js
  tailwind.config.js
  postcss.config.js
  eslint.config.js
  public/
    plai-logo.jpg
  src/
    main.jsx
    App.jsx
    plai-style.css
    test-setup.js
    lib/
      idbHelpers.js              -- promisify IndexedDB (open/get/getAll/put/delete)
      localStore.js              -- implémentation TaskStore sur IndexedDB
      taskStore.contract.js      -- suite de tests de contrat partagée (réutilisée au Plan 2)
      localStore.test.js         -- branche le contrat sur LocalStore
    context/
      StoreContext.jsx           -- fournit l'instance TaskStore à l'arbre React
    components/
      ContextPicker.jsx
      ContextPicker.test.jsx
      TaskDashboard.jsx
      TaskDashboard.test.jsx
      QuickCapture.jsx
      QuickCapture.test.jsx
      DecomposeSheet.jsx
      DecomposeSheet.test.jsx
```

---

### Task 0: Scaffold du projet

**Files:**
- Create: `focusactif/package.json`
- Create: `focusactif/vite.config.js`
- Create: `focusactif/tailwind.config.js`
- Create: `focusactif/postcss.config.js`
- Create: `focusactif/eslint.config.js`
- Create: `focusactif/index.html`
- Create: `focusactif/src/main.jsx`
- Create: `focusactif/src/App.jsx`
- Create: `focusactif/src/test-setup.js`
- Copy: `shared/css/plai-style.css` → `focusactif/src/plai-style.css`
- Copy: `projets/portail-plai/public/plai-logo.jpg` → `focusactif/public/plai-logo.jpg`

- [ ] **Step 1: Créer `package.json`**

```json
{
  "name": "focusactif",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui"
  },
  "dependencies": {
    "react": "^19.2.6",
    "react-dom": "^19.2.6"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "@vitest/ui": "^4.1.8",
    "autoprefixer": "^10.5.0",
    "eslint": "^10.3.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "fake-indexeddb": "^6.0.0",
    "globals": "^17.6.0",
    "jsdom": "^29.1.1",
    "postcss": "^8.5.15",
    "tailwindcss": "^3.4.19",
    "vite": "^8.0.12",
    "vitest": "^4.1.8"
  }
}
```

- [ ] **Step 2: Créer `vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    globals: true,
    passWithNoTests: true,
  },
})
```

- [ ] **Step 3: Créer `tailwind.config.js`**

```js
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default {
  content: [
    path.join(__dirname, './index.html'),
    path.join(__dirname, './src/**/*.{js,jsx}'),
  ],
  theme: {
    extend: {
      colors: {
        plai: {
          teal: '#0a9370',
          orange: '#f97316',
        },
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 4: Créer `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 5: Créer `eslint.config.js`**

```js
import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
]
```

- [ ] **Step 6: Créer `index.html`**

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/plai-logo.jpg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Serif+Display&display=swap"
      rel="stylesheet"
    />
    <title>FocusActif</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Créer `src/main.jsx`**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './plai-style.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 8: Créer `src/App.jsx` (squelette provisoire, complété au Task 11)**

```jsx
function App() {
  return <div className="plai-section">FocusActif</div>
}

export default App
```

- [ ] **Step 9: Créer `src/test-setup.js`**

```js
import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'
```

- [ ] **Step 10: Copier le CSS partagé et le logo**

```bash
cp "C:/Users/jfbeg/OneDrive/claude-workspace/shared/css/plai-style.css" "C:/Users/jfbeg/OneDrive/claude-workspace/focusactif/src/plai-style.css"
mkdir -p "C:/Users/jfbeg/OneDrive/claude-workspace/focusactif/public"
cp "C:/Users/jfbeg/OneDrive/claude-workspace/projets/portail-plai/public/plai-logo.jpg" "C:/Users/jfbeg/OneDrive/claude-workspace/focusactif/public/plai-logo.jpg"
```

- [ ] **Step 11: Installer les dépendances**

Run: `cd focusactif && npm install`
Expected: installation sans erreur.

- [ ] **Step 12: Vérifier que le projet démarre**

Run: `npm run build`
Expected: build réussi (0 erreur) — conformément à la règle absolue "npx vite build doit passer avant tout push".

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "chore: scaffold FocusActif (React/Vite/Tailwind, gabarit PLAI)"
```

---

### Task 1: Helper IndexedDB (`idbHelpers.js`)

**Files:**
- Create: `focusactif/src/lib/idbHelpers.js`
- Test: `focusactif/src/lib/idbHelpers.test.js`

- [ ] **Step 1: Écrire le test qui échoue**

```js
// src/lib/idbHelpers.test.js
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
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- idbHelpers`
Expected: FAIL — `Cannot find module './idbHelpers.js'` (le fichier n'existe pas encore).

- [ ] **Step 3: Implémenter `idbHelpers.js`**

```js
// src/lib/idbHelpers.js
export function openDb(name, version, upgrade) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version)
    request.onupgradeneeded = () => upgrade(request.result)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function put(db, storeName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).put(value)
    tx.oncomplete = () => resolve(value)
    tx.onerror = () => reject(tx.error)
  })
}

export function get(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const request = tx.objectStore(storeName).get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function getAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const request = tx.objectStore(storeName).getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function remove(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- idbHelpers`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/idbHelpers.js src/lib/idbHelpers.test.js
git commit -m "feat: add promisified IndexedDB helper"
```

---

### Task 2: `LocalStore` — contextes (`addContext` / `listContexts`)

**Files:**
- Create: `focusactif/src/lib/localStore.js`
- Create: `focusactif/src/lib/taskStore.contract.js`
- Create: `focusactif/src/lib/localStore.test.js`

- [ ] **Step 1: Écrire le contrat partagé (première tranche) et le brancher sur `LocalStore`**

```js
// src/lib/taskStore.contract.js
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
```

```js
// src/lib/localStore.test.js
import { runTaskStoreContractTests } from './taskStore.contract.js'
import { createLocalStore } from './localStore.js'

let counter = 0
runTaskStoreContractTests(() => createLocalStore(`focusactif-test-${counter++}`))
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- localStore`
Expected: FAIL — `createLocalStore is not a function` (le fichier n'existe pas encore).

- [ ] **Step 3: Implémenter `localStore.js` (partie contextes)**

```js
// src/lib/localStore.js
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
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- localStore`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/localStore.js src/lib/localStore.test.js src/lib/taskStore.contract.js
git commit -m "feat: LocalStore contexts (addContext/listContexts)"
```

---

### Task 3: `LocalStore` — `addTask` et `listSubtasks`

**Files:**
- Modify: `focusactif/src/lib/localStore.js`
- Modify: `focusactif/src/lib/taskStore.contract.js`

- [ ] **Step 1: Ajouter les tests de contrat**

```js
// ajout dans taskStore.contract.js, à l'intérieur de la même fonction runTaskStoreContractTests

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
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- localStore`
Expected: FAIL — `store.addTask is not a function`

- [ ] **Step 3: Implémenter `addTask` et `listSubtasks`**

Ajouter d'abord une fonction de module (en dehors de `createLocalStore`, à côté de `upgrade`),
pour éviter toute dépendance à `this` dans l'objet littéral retourné :

```js
// ajout dans localStore.js, au niveau du module (à côté de la fonction upgrade)
async function listSubtasksOf(db, parentTaskId) {
  const all = await getAll(db, 'tasks')
  return all
    .filter((t) => t.parentTaskId === parentTaskId)
    .sort((a, b) => a.stepOrder - b.stepOrder)
}
```

Puis dans l'objet retourné par `createLocalStore` :

```js
// ajout dans l'objet retourné par createLocalStore

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
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- localStore`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/localStore.js src/lib/taskStore.contract.js
git commit -m "feat: LocalStore addTask/listSubtasks with step ordering"
```

---

### Task 4: `LocalStore` — `getNextTask`

**Files:**
- Modify: `focusactif/src/lib/localStore.js`
- Modify: `focusactif/src/lib/taskStore.contract.js`

- [ ] **Step 1: Ajouter les tests de contrat**

```js
// ajout dans taskStore.contract.js

    it('getNextTask retourne null si le contexte est vide', async () => {
      const store = await createStore()
      const context = await store.addContext('Maison', '🏠')
      expect(await store.getNextTask(context.id)).toBeNull()
    })

    it('getNextTask retourne la tâche racine s\'il n\'y a pas de sous-étape', async () => {
      const store = await createStore()
      const context = await store.addContext('Maison', '🏠')
      const task = await store.addTask(context.id, 'Ranger sa chambre')
      const next = await store.getNextTask(context.id)
      expect(next.id).toBe(task.id)
    })

    it('getNextTask retourne la première sous-étape non terminée, jamais le parent', async () => {
      const store = await createStore()
      const context = await store.addContext('Devoirs', '📚')
      const parent = await store.addTask(context.id, 'Faire l\'exposé')
      const step1 = await store.addTask(context.id, 'Choisir le sujet', parent.id)
      await store.addTask(context.id, 'Écrire le plan', parent.id)

      const next = await store.getNextTask(context.id)
      expect(next.id).toBe(step1.id)
    })

    it('getNextTask passe à la tâche parente une fois toutes les sous-étapes terminées', async () => {
      const store = await createStore()
      const context = await store.addContext('Devoirs', '📚')
      const parent = await store.addTask(context.id, 'Faire l\'exposé')
      const step1 = await store.addTask(context.id, 'Choisir le sujet', parent.id)
      await store.completeTask(step1.id)

      const next = await store.getNextTask(context.id)
      expect(next.id).toBe(parent.id)
    })

    it('getNextTask ignore les tâches racines déjà terminées (ordre stable)', async () => {
      const store = await createStore()
      const context = await store.addContext('Maison', '🏠')
      const first = await store.addTask(context.id, 'Première tâche')
      const second = await store.addTask(context.id, 'Deuxième tâche')
      await store.completeTask(first.id)

      const next = await store.getNextTask(context.id)
      expect(next.id).toBe(second.id)
    })
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- localStore`
Expected: FAIL — `store.getNextTask is not a function` (et `store.completeTask is not a function`,
implémenté au Task 5 ; pour l'instant seuls les deux premiers `it` de cette tranche peuvent
passer une fois `getNextTask` écrit — les trois autres échoueront jusqu'au Task 5. C'est attendu :
écrire `getNextTask` et `completeTask` ensemble dans ce Task est plus simple que de les séparer,
vu leur dépendance mutuelle dans les tests de contrat.)

- [ ] **Step 3: Implémenter `getNextTask` (et un `completeTask` minimal nécessaire aux tests ci-dessus)**

```js
// ajout dans localStore.js

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
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- localStore`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/localStore.js src/lib/taskStore.contract.js
git commit -m "feat: LocalStore getNextTask (single-task-at-a-time logic) and completeTask"
```

---

### Task 5: `StoreContext` (câblage React)

**Files:**
- Create: `focusactif/src/context/StoreContext.jsx`
- Create: `focusactif/src/context/StoreContext.test.jsx`

- [ ] **Step 1: Écrire le test qui échoue**

```jsx
// src/context/StoreContext.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StoreProvider, useTaskStore } from './StoreContext.jsx'

function Probe() {
  const store = useTaskStore()
  return <div data-testid="probe">{store ? 'ready' : 'loading'}</div>
}

describe('StoreProvider', () => {
  it('fournit une instance TaskStore aux enfants', async () => {
    render(
      <StoreProvider dbName="focusactif-storecontext-test">
        <Probe />
      </StoreProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('ready'))
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- StoreContext`
Expected: FAIL — `Cannot find module './StoreContext.jsx'`

- [ ] **Step 3: Implémenter `StoreContext.jsx`**

```jsx
// src/context/StoreContext.jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { createLocalStore } from '../lib/localStore.js'

const StoreContext = createContext(null)

export function StoreProvider({ children, dbName = 'focusactif' }) {
  const [store, setStore] = useState(null)

  useEffect(() => {
    let cancelled = false
    createLocalStore(dbName).then((instance) => {
      if (!cancelled) setStore(instance)
    })
    return () => {
      cancelled = true
    }
  }, [dbName])

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useTaskStore() {
  return useContext(StoreContext)
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- StoreContext`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/context/StoreContext.jsx src/context/StoreContext.test.jsx
git commit -m "feat: StoreContext wiring TaskStore instance to the React tree"
```

---

### Task 6: `ContextPicker`

**Files:**
- Create: `focusactif/src/components/ContextPicker.jsx`
- Create: `focusactif/src/components/ContextPicker.test.jsx`

- [ ] **Step 1: Écrire le test qui échoue**

```jsx
// src/components/ContextPicker.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ContextPicker } from './ContextPicker.jsx'

const CONTEXTS = [
  { id: 'c1', label: 'École', emoji: '🏫', locked: false },
  { id: 'c2', label: 'Maison', emoji: '🏠', locked: false },
]

describe('ContextPicker', () => {
  it('affiche chaque contexte et déclenche onSelect au clic', async () => {
    const onSelect = vi.fn()
    render(<ContextPicker contexts={CONTEXTS} onSelect={onSelect} onCreate={vi.fn()} />)

    expect(screen.getByText('École')).toBeInTheDocument()
    expect(screen.getByText('Maison')).toBeInTheDocument()

    await userEvent.click(screen.getByText('École'))
    expect(onSelect).toHaveBeenCalledWith('c1')
  })

  it('affiche un état vide invitant à créer un contexte si la liste est vide', () => {
    render(<ContextPicker contexts={[]} onSelect={vi.fn()} onCreate={vi.fn()} />)
    expect(screen.getByText(/aucun contexte/i)).toBeInTheDocument()
  })

  it('déclenche onCreate avec le libellé et l\'emoji saisis', async () => {
    const onCreate = vi.fn()
    render(<ContextPicker contexts={[]} onSelect={vi.fn()} onCreate={onCreate} />)

    await userEvent.type(screen.getByLabelText(/nom du contexte/i), 'Devoirs')
    await userEvent.click(screen.getByRole('button', { name: /créer/i }))

    expect(onCreate).toHaveBeenCalledWith('Devoirs', expect.any(String))
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- ContextPicker`
Expected: FAIL — `Cannot find module './ContextPicker.jsx'`

- [ ] **Step 3: Implémenter `ContextPicker.jsx`**

```jsx
// src/components/ContextPicker.jsx
import { useId, useState } from 'react'

const DEFAULT_EMOJI = '📌'

export function ContextPicker({ contexts, onSelect, onCreate }) {
  const [label, setLabel] = useState('')
  const inputId = useId()

  function handleCreate() {
    const trimmed = label.trim()
    if (!trimmed) return
    onCreate(trimmed, DEFAULT_EMOJI)
    setLabel('')
  }

  return (
    <div className="plai-section">
      <h1 className="text-xl font-bold mb-4">Mes contextes</h1>

      {contexts.length === 0 && (
        <p className="plai-empty">Aucun contexte pour l'instant. Créez-en un pour commencer.</p>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        {contexts.map((context) => (
          <button
            key={context.id}
            type="button"
            className="plai-card text-left"
            onClick={() => onSelect(context.id)}
          >
            <span className="text-2xl mr-2">{context.emoji}</span>
            {context.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label htmlFor={inputId} className="block text-sm mb-1">
            Nom du contexte
          </label>
          <input
            id={inputId}
            className="plai-input w-full"
            placeholder="ex : Devoirs du soir"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <button type="button" className="plai-btn" onClick={handleCreate}>
          Créer
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- ContextPicker`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ContextPicker.jsx src/components/ContextPicker.test.jsx
git commit -m "feat: ContextPicker component"
```

---

### Task 7: `TaskDashboard`

**Files:**
- Create: `focusactif/src/components/TaskDashboard.jsx`
- Create: `focusactif/src/components/TaskDashboard.test.jsx`

- [ ] **Step 1: Écrire le test qui échoue**

```jsx
// src/components/TaskDashboard.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TaskDashboard } from './TaskDashboard.jsx'

describe('TaskDashboard', () => {
  it('affiche la tâche courante et déclenche onComplete au clic sur "Fait"', async () => {
    const onComplete = vi.fn()
    const task = { id: 't1', title: 'Choisir le sujet', status: 'todo' }
    render(
      <TaskDashboard
        task={task}
        onComplete={onComplete}
        onDecompose={vi.fn()}
        onOpenCapture={vi.fn()}
      />,
    )

    expect(screen.getByText('Choisir le sujet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /fait/i }))
    expect(onComplete).toHaveBeenCalledWith('t1')
  })

  it('affiche un état vide invitant à capturer une tâche s\'il n\'y en a aucune', () => {
    render(
      <TaskDashboard task={null} onComplete={vi.fn()} onDecompose={vi.fn()} onOpenCapture={vi.fn()} />,
    )
    expect(screen.getByText(/aucune tâche/i)).toBeInTheDocument()
  })

  it('déclenche onDecompose avec l\'id de la tâche courante', async () => {
    const onDecompose = vi.fn()
    const task = { id: 't1', title: 'Faire l\'exposé', status: 'todo' }
    render(
      <TaskDashboard task={task} onComplete={vi.fn()} onDecompose={onDecompose} onOpenCapture={vi.fn()} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /décomposer/i }))
    expect(onDecompose).toHaveBeenCalledWith('t1')
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- TaskDashboard`
Expected: FAIL — `Cannot find module './TaskDashboard.jsx'`

- [ ] **Step 3: Implémenter `TaskDashboard.jsx`**

```jsx
// src/components/TaskDashboard.jsx
export function TaskDashboard({ task, onComplete, onDecompose, onOpenCapture }) {
  if (!task) {
    return (
      <div className="plai-section">
        <p className="plai-empty">Aucune tâche ici. Ajoutez-en une pour commencer.</p>
        <button type="button" className="plai-btn mt-4" onClick={onOpenCapture}>
          + Ajouter une tâche
        </button>
      </div>
    )
  }

  return (
    <div className="plai-section">
      <div className="plai-card text-center py-10">
        <p className="text-2xl font-serif mb-6">{task.title}</p>
        <div className="flex justify-center gap-3">
          <button type="button" className="plai-btn" onClick={() => onComplete(task.id)}>
            Fait ✓
          </button>
          <button type="button" className="plai-btn" onClick={() => onDecompose(task.id)}>
            Décomposer
          </button>
        </div>
      </div>
      <button type="button" className="plai-btn mt-6" onClick={onOpenCapture}>
        + Ajouter une tâche
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- TaskDashboard`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/TaskDashboard.jsx src/components/TaskDashboard.test.jsx
git commit -m "feat: TaskDashboard component (single-task display)"
```

---

### Task 8: `QuickCapture` (texte + dictée Web Speech API en secours)

**Files:**
- Create: `focusactif/src/components/QuickCapture.jsx`
- Create: `focusactif/src/components/QuickCapture.test.jsx`

- [ ] **Step 1: Écrire le test qui échoue**

```jsx
// src/components/QuickCapture.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QuickCapture } from './QuickCapture.jsx'

describe('QuickCapture', () => {
  afterEach(() => {
    delete window.SpeechRecognition
    delete window.webkitSpeechRecognition
  })

  it('le bouton Ajouter est désactivé tant que le champ est vide', () => {
    render(<QuickCapture onAdd={vi.fn()} />)
    expect(screen.getByRole('button', { name: /ajouter/i })).toBeDisabled()
  })

  it('déclenche onAdd avec le texte saisi puis vide le champ', async () => {
    const onAdd = vi.fn()
    render(<QuickCapture onAdd={onAdd} />)

    const input = screen.getByPlaceholderText(/ex :/i)
    await userEvent.type(input, 'Ranger le sac')
    await userEvent.click(screen.getByRole('button', { name: /ajouter/i }))

    expect(onAdd).toHaveBeenCalledWith('Ranger le sac')
    expect(input).toHaveValue('')
  })

  it('n\'affiche pas le bouton micro si l\'API n\'est pas disponible', () => {
    render(<QuickCapture onAdd={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /dicter/i })).not.toBeInTheDocument()
  })

  it('affiche le bouton micro si SpeechRecognition est disponible', () => {
    window.SpeechRecognition = vi.fn()
    render(<QuickCapture onAdd={vi.fn()} />)
    expect(screen.getByRole('button', { name: /dicter/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- QuickCapture`
Expected: FAIL — `Cannot find module './QuickCapture.jsx'`

- [ ] **Step 3: Implémenter `QuickCapture.jsx`**

```jsx
// src/components/QuickCapture.jsx
import { useRef, useState } from 'react'

function getSpeechRecognitionCtor() {
  return typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : undefined
}

export function QuickCapture({ onAdd }) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)

  const SpeechRecognitionCtor = getSpeechRecognitionCtor()

  function handleAdd() {
    const trimmed = text.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setText('')
  }

  function toggleDictation() {
    if (!SpeechRecognitionCtor) return

    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'fr-FR'
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setText((prev) => (prev ? `${prev} ${transcript}` : transcript))
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  return (
    <div className="flex gap-2 items-center">
      <input
        className="plai-input flex-1"
        placeholder="ex : Ranger la trousse"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {SpeechRecognitionCtor && (
        <button
          type="button"
          className="plai-btn"
          onClick={toggleDictation}
          aria-pressed={listening}
        >
          {listening ? 'Arrêter' : 'Dicter 🎤'}
        </button>
      )}
      <button type="button" className="plai-btn" onClick={handleAdd} disabled={!text.trim()}>
        Ajouter
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- QuickCapture`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/QuickCapture.jsx src/components/QuickCapture.test.jsx
git commit -m "feat: QuickCapture with text input and optional Web Speech dictation"
```

---

### Task 9: `DecomposeSheet`

**Files:**
- Create: `focusactif/src/components/DecomposeSheet.jsx`
- Create: `focusactif/src/components/DecomposeSheet.test.jsx`

- [ ] **Step 1: Écrire le test qui échoue**

```jsx
// src/components/DecomposeSheet.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { DecomposeSheet } from './DecomposeSheet.jsx'

describe('DecomposeSheet', () => {
  it('affiche les sous-étapes existantes dans l\'ordre', () => {
    const subtasks = [
      { id: 's1', title: 'Choisir le sujet', status: 'todo' },
      { id: 's2', title: 'Écrire le plan', status: 'todo' },
    ]
    render(
      <DecomposeSheet
        parentTitle="Faire l'exposé"
        subtasks={subtasks}
        onAddSubtask={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const items = screen.getAllByTestId('subtask-item')
    expect(items.map((el) => el.textContent)).toEqual(['Choisir le sujet', 'Écrire le plan'])
  })

  it('déclenche onAddSubtask via le champ de capture', async () => {
    const onAddSubtask = vi.fn()
    render(
      <DecomposeSheet parentTitle="Faire l'exposé" subtasks={[]} onAddSubtask={onAddSubtask} onClose={vi.fn()} />,
    )
    await userEvent.type(screen.getByPlaceholderText(/ex :/i), 'Choisir le sujet')
    await userEvent.click(screen.getByRole('button', { name: /ajouter/i }))
    expect(onAddSubtask).toHaveBeenCalledWith('Choisir le sujet')
  })

  it('déclenche onClose au clic sur Fermer', async () => {
    const onClose = vi.fn()
    render(<DecomposeSheet parentTitle="Faire l'exposé" subtasks={[]} onAddSubtask={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /fermer/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- DecomposeSheet`
Expected: FAIL — `Cannot find module './DecomposeSheet.jsx'`

- [ ] **Step 3: Implémenter `DecomposeSheet.jsx`**

```jsx
// src/components/DecomposeSheet.jsx
import { QuickCapture } from './QuickCapture.jsx'

export function DecomposeSheet({ parentTitle, subtasks, onAddSubtask, onClose }) {
  return (
    <div className="plai-section">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Décomposer : {parentTitle}</h2>
        <button type="button" className="plai-btn" onClick={onClose}>
          Fermer
        </button>
      </div>

      <ul className="mb-4">
        {subtasks.map((subtask) => (
          <li key={subtask.id} data-testid="subtask-item" className="plai-card mb-2">
            {subtask.title}
          </li>
        ))}
      </ul>

      <QuickCapture onAdd={onAddSubtask} />
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- DecomposeSheet`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/DecomposeSheet.jsx src/components/DecomposeSheet.test.jsx
git commit -m "feat: DecomposeSheet component"
```

---

### Task 10: Câblage de `App.jsx` (parcours complet)

**Files:**
- Modify: `focusactif/src/App.jsx`
- Create: `focusactif/src/App.test.jsx`

- [ ] **Step 1: Écrire le test qui échoue (smoke test du parcours complet)**

```jsx
// src/App.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import App from './App.jsx'

describe('App — parcours élève autonome', () => {
  it('créer un contexte → capturer une tâche → décomposer → terminer', async () => {
    render(<App />)

    // Créer un contexte
    await userEvent.type(await screen.findByLabelText(/nom du contexte/i), 'Devoirs')
    await userEvent.click(screen.getByRole('button', { name: /créer/i }))

    // Entrer dans le contexte
    await userEvent.click(await screen.findByText('Devoirs'))

    // Capturer une tâche depuis l'état vide
    await userEvent.click(screen.getByRole('button', { name: /ajouter une tâche/i }))
    await userEvent.type(screen.getByPlaceholderText(/ex :/i), 'Faire l\'exposé')
    await userEvent.click(screen.getByRole('button', { name: /^ajouter$/i }))

    // La tâche apparaît comme tâche courante
    await waitFor(() => expect(screen.getByText('Faire l\'exposé')).toBeInTheDocument())

    // Décomposer
    await userEvent.click(screen.getByRole('button', { name: /décomposer/i }))
    await userEvent.type(screen.getByPlaceholderText(/ex :/i), 'Choisir le sujet')
    await userEvent.click(screen.getByRole('button', { name: /^ajouter$/i }))
    await userEvent.click(screen.getByRole('button', { name: /fermer/i }))

    // La sous-étape est maintenant la tâche courante, pas le parent
    await waitFor(() => expect(screen.getByText('Choisir le sujet')).toBeInTheDocument())

    // Terminer la sous-étape
    await userEvent.click(screen.getByRole('button', { name: /fait/i }))

    // Le parent redevient la tâche courante
    await waitFor(() => expect(screen.getByText('Faire l\'exposé')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- App`
Expected: FAIL — `App.jsx` actuel n'affiche que "FocusActif", aucun des éléments attendus n'existe.

- [ ] **Step 3: Implémenter `App.jsx`**

```jsx
// src/App.jsx
import { useCallback, useEffect, useState } from 'react'
import { StoreProvider, useTaskStore } from './context/StoreContext.jsx'
import { ContextPicker } from './components/ContextPicker.jsx'
import { TaskDashboard } from './components/TaskDashboard.jsx'
import { QuickCapture } from './components/QuickCapture.jsx'
import { DecomposeSheet } from './components/DecomposeSheet.jsx'

function AppInner() {
  const store = useTaskStore()
  const [contexts, setContexts] = useState([])
  const [activeContextId, setActiveContextId] = useState(null)
  const [currentTask, setCurrentTask] = useState(null)
  const [capturing, setCapturing] = useState(false)
  const [decomposing, setDecomposing] = useState(null)
  const [subtasks, setSubtasks] = useState([])

  const refreshContexts = useCallback(async () => {
    if (!store) return
    setContexts(await store.listContexts())
  }, [store])

  const refreshCurrentTask = useCallback(async () => {
    if (!store || !activeContextId) return
    setCurrentTask(await store.getNextTask(activeContextId))
  }, [store, activeContextId])

  useEffect(() => {
    refreshContexts()
  }, [refreshContexts])

  useEffect(() => {
    refreshCurrentTask()
  }, [refreshCurrentTask])

  useEffect(() => {
    async function loadSubtasks() {
      if (!store || !decomposing) return
      setSubtasks(await store.listSubtasks(decomposing))
    }
    loadSubtasks()
  }, [store, decomposing])

  if (!store) return null

  async function handleCreateContext(label, emoji) {
    await store.addContext(label, emoji)
    await refreshContexts()
  }

  async function handleAddRootTask(title) {
    await store.addTask(activeContextId, title)
    setCapturing(false)
    await refreshCurrentTask()
  }

  async function handleComplete(taskId) {
    await store.completeTask(taskId)
    await refreshCurrentTask()
  }

  async function handleAddSubtask(title) {
    await store.addTask(activeContextId, title, decomposing)
    setSubtasks(await store.listSubtasks(decomposing))
  }

  function handleCloseDecompose() {
    setDecomposing(null)
    refreshCurrentTask()
  }

  if (!activeContextId) {
    return (
      <ContextPicker contexts={contexts} onSelect={setActiveContextId} onCreate={handleCreateContext} />
    )
  }

  if (decomposing) {
    const parent = subtasks.length > 0 ? subtasks[0] : currentTask
    return (
      <DecomposeSheet
        parentTitle={parent?.title ?? ''}
        subtasks={subtasks}
        onAddSubtask={handleAddSubtask}
        onClose={handleCloseDecompose}
      />
    )
  }

  if (capturing) {
    return (
      <div className="plai-section">
        <QuickCapture onAdd={handleAddRootTask} />
      </div>
    )
  }

  return (
    <TaskDashboard
      task={currentTask}
      onComplete={handleComplete}
      onDecompose={setDecomposing}
      onOpenCapture={() => setCapturing(true)}
    />
  )
}

function App() {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  )
}

export default App
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- App`
Expected: PASS (1 test)

- [ ] **Step 5: Lancer toute la suite de tests**

Run: `npm test`
Expected: PASS — tous les tests (idbHelpers, localStore/contrat, StoreContext, ContextPicker,
TaskDashboard, QuickCapture, DecomposeSheet, App).

- [ ] **Step 6: Vérifier le build**

Run: `npm run build`
Expected: build réussi, 0 erreur.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "feat: wire full local-only user journey in App.jsx"
```

---

## Vérification manuelle finale (avant de considérer le Plan 1 terminé)

- [ ] Lancer `npm run dev`, ouvrir l'app dans un navigateur.
- [ ] Créer un contexte, y entrer, capturer une tâche, la décomposer, terminer une sous-étape,
      vérifier que le parent redevient la tâche affichée, le terminer à son tour.
- [ ] Vérifier que le bouton "Dicter 🎤" apparaît dans Chrome/Edge (SpeechRecognition dispo) et
      qu'il est absent dans un navigateur qui ne le supporte pas (ou simuler l'absence via les
      devtools en supprimant `window.webkitSpeechRecognition` dans la console).
- [ ] Fermer et rouvrir l'onglet : vérifier que les contextes/tâches créés sont toujours là
      (persistance IndexedDB réelle, pas seulement en mémoire).
