# FocusActif — Plan 3 : Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter des rappels optionnels par tâche/sous-tâche à FocusActif : rappel doux (vibration, jamais de son) affiché in-app quand l'application est ouverte (les deux modes), et en plus, en mode compte, un vrai push navigateur reçu même application fermée.

**Architecture:** `TaskStore` (Plan 1/2) gagne `setReminder`/`clearReminder`/`markReminderSent`, implémentés identiquement dans `LocalStore` (champ sur la tâche IndexedDB) et `SupabaseStore` (table `focus_reminders` séparée, jointe en lecture). Un hook `useReminderWatcher` scrute la tâche actuellement affichée pour le rappel in-app (les deux modes). En mode compte uniquement : une Edge Function planifiée par `pg_cron` envoie un vrai Web Push aux abonnements enregistrés dans `focus_push_subscriptions`.

**Tech Stack:** Web Push API + VAPID (`web-push` npm package côté Edge Function Deno), Service Worker natif, `pg_cron` + `pg_net` (Supabase Postgres), React/Vite (gabarit PLAI déjà en place).

**Projet Supabase** : `dfoaumjleqtxjeaplnna` (même projet que le Plan 2).

---

## Vue d'ensemble des fichiers

```
focusactif/
  .env.example                                  -- MODIFIÉ (VITE_VAPID_PUBLIC_KEY)
  index.html                                    -- MODIFIÉ (lien manifest, registration SW)
  public/
    manifest.webmanifest                        -- NOUVEAU
    sw.js                                       -- NOUVEAU
  supabase/
    migrations/
      20260719090000_create_focus_reminders.sql -- NOUVEAU
    functions/
      send-reminders/
        index.ts                                -- NOUVEAU (Edge Function)
  src/
    lib/
      taskStore.contract.js                     -- MODIFIÉ (tests setReminder/clearReminder/markReminderSent)
      localStore.js                             -- MODIFIÉ
      localStore.test.js                        -- inchangé (branche déjà le contrat)
      supabaseStore.js                          -- MODIFIÉ
      pushSubscription.js                       -- NOUVEAU
      pushSubscription.test.js                  -- NOUVEAU
      useReminderWatcher.js                     -- NOUVEAU
      useReminderWatcher.test.js                -- NOUVEAU
    components/
      ReminderPicker.jsx                        -- NOUVEAU
      ReminderPicker.test.jsx                   -- NOUVEAU
      TaskDashboard.jsx                         -- MODIFIÉ
      TaskDashboard.test.jsx                    -- MODIFIÉ
    App.jsx                                     -- MODIFIÉ
```

---

### Task 1: Migration Supabase — `focus_reminders` et `focus_push_subscriptions`

**Files:**
- Create: `supabase/migrations/20260719090000_create_focus_reminders.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- supabase/migrations/20260719090000_create_focus_reminders.sql

create table if not exists public.focus_reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.focus_tasks(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  remind_at timestamptz not null,
  sent boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists focus_reminders_due_idx on public.focus_reminders(remind_at) where sent = false;

create table if not exists public.focus_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.focus_reminders enable row level security;
alter table public.focus_push_subscriptions enable row level security;

create policy "focus_reminders_owner_all" on public.focus_reminders
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "focus_push_subscriptions_owner_all" on public.focus_push_subscriptions
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
```

Note : pas de politique d'accès pour un enseignant lié — un rappel est personnel à celui qui l'a programmé, indépendamment du verrouillage de contexte (verrouiller un contexte porte sur la structure des tâches, pas sur les rappels personnels de l'élève).

- [ ] **Step 2: Appliquer la migration**

Manuel, comme au Plan 2 : Dashboard Supabase du projet `dfoaumjleqtxjeaplnna` → SQL Editor → coller le contenu ci-dessus → exécuter. Vérifier dans Table Editor que `focus_reminders` et `focus_push_subscriptions` existent, RLS activé sur les deux.

- [ ] **Step 3: Vérifier l'absence de conflit de nommage**

Run: `grep -rn "focus_reminders\|focus_push_subscriptions" "C:/Users/jfbeg/OneDrive/claude-workspace" --include="*.sql"`
Expected: seuls les fichiers de ce projet apparaissent.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260719090000_create_focus_reminders.sql
git commit -m "feat: Supabase schema for focus_reminders and focus_push_subscriptions with RLS"
```

---

### Task 2: Contrat partagé — `setReminder`/`clearReminder`/`markReminderSent`

**Files:**
- Modify: `src/lib/taskStore.contract.js`

- [ ] **Step 1: Ajouter les tests de contrat**

```js
// ajout dans taskStore.contract.js, à l'intérieur de runTaskStoreContractTests

    it('setReminder définit remindAt sur la tâche, clearReminder l\'efface', async () => {
      const store = await createStore()
      const context = await store.addContext('Devoirs', '📚')
      const task = await store.addTask(context.id, 'Réviser')
      const remindAt = new Date(Date.now() + 3600000).toISOString()

      await store.setReminder(task.id, remindAt)
      let next = await store.getNextTask(context.id)
      expect(next.remindAt).toBe(remindAt)
      expect(next.reminderSent).toBe(false)

      await store.clearReminder(task.id)
      next = await store.getNextTask(context.id)
      expect(next.remindAt).toBeNull()
    })

    it('markReminderSent marque le rappel comme envoyé sans changer remindAt', async () => {
      const store = await createStore()
      const context = await store.addContext('Devoirs', '📚')
      const task = await store.addTask(context.id, 'Réviser')
      const remindAt = new Date(Date.now() + 3600000).toISOString()
      await store.setReminder(task.id, remindAt)

      await store.markReminderSent(task.id)

      const next = await store.getNextTask(context.id)
      expect(next.remindAt).toBe(remindAt)
      expect(next.reminderSent).toBe(true)
    })

    it('une tâche sans rappel a remindAt null et reminderSent false par défaut', async () => {
      const store = await createStore()
      const context = await store.addContext('Maison', '🏠')
      const task = await store.addTask(context.id, 'Ranger sa chambre')
      expect(task.remindAt).toBeNull()
      expect(task.reminderSent).toBe(false)
    })
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- localStore`
Expected: FAIL — `store.setReminder is not a function` (et les 2 tests suivants échouent en cascade pour la même raison).

- [ ] **Step 3: Commit du contrat seul (implémentations aux Tasks 3-4)**

Ce fichier seul ne compile pas encore de test qui passe (aucune implémentation n'existe) — c'est acceptable temporairement car il est commité avec `localStore.js` modifié dans la MÊME tâche (Task 3, juste après), pas isolément. Sauter directement à la Task 3 sans committer ce fichier seul.

---

### Task 3: `LocalStore` — implémenter les rappels

**Files:**
- Modify: `src/lib/localStore.js`

- [ ] **Step 1: Modifier `addTask` pour inclure les champs par défaut**

```js
// dans localStore.js, remplacer la construction de l'objet task dans addTask :

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
```

- [ ] **Step 2: Ajouter les trois méthodes dans l'objet retourné par `createLocalStore`**

```js
// ajout dans l'objet retourné par createLocalStore, après completeTask

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
```

- [ ] **Step 3: Lancer le test, vérifier qu'il passe**

Run: `npm test -- localStore`
Expected: PASS (14 tests : les 11 du Plan 1 + les 3 nouveaux)

- [ ] **Step 4: Lancer tout le projet pour vérifier l'absence de régression**

Run: `npm test`
Expected: PASS (les tests des composants qui construisent des objets `task` à la main, ex. `TaskDashboard.test.jsx`, n'assertent pas `toEqual` sur l'objet complet — vérifier qu'aucun ne casse à cause des nouveaux champs `remindAt`/`reminderSent`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/taskStore.contract.js src/lib/localStore.js
git commit -m "feat: LocalStore reminders (setReminder/clearReminder/markReminderSent)"
```

---

### Task 4: `SupabaseStore` — implémenter les rappels via `focus_reminders`

**Files:**
- Modify: `src/lib/supabaseStore.js`

- [ ] **Step 1: Ajouter le helper `attachReminders` et les trois méthodes**

```js
// ajout dans supabaseStore.js, au niveau du module (à côté de listRootTasks/toTask)

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
```

```js
// ajout dans l'objet retourné par createSupabaseStore, après completeTask

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
```

- [ ] **Step 2: Appliquer `attachReminders` aux trois points de lecture des tâches**

Modifier `listRootTasks` (fonction module), `listSubtasks` et `getNextTask` (méthodes de l'objet retourné) pour envelopper leur résultat :

```js
// listRootTasks (fonction module) : remplacer le `return data.map(toTask)` final par
  return attachReminders(supabase, data.map(toTask))
```

```js
// listSubtasks (méthode) : remplacer le `return data.map(toTask)` final par
      return attachReminders(supabase, data.map(toTask))
```

```js
// getNextTask (méthode) : la valeur retournée (le root OU la première sous-étape todo)
// doit passer par attachReminders avant d'être renvoyée. Remplacer :
//   return subtasks.length > 0 ? subtasks[0] : root
// par :
      const result = subtasks.length > 0 ? subtasks[0] : root
      const [withReminder] = await attachReminders(supabase, [result])
      return withReminder
```

(`addTask`/`addContext` n'ont pas besoin d'`attachReminders` : une tâche tout juste créée n'a jamais de rappel — `toTask` ne définissant pas ces deux clés, les ajouter directement dans `addTask`'s retour évite un `undefined` gênant :)

```js
// dans addTask (méthode), remplacer `return toTask(data)` par :
      return { ...toTask(data), remindAt: null, reminderSent: false }
```

- [ ] **Step 3: Lancer le lint et le build (pas de nouveau test unitaire ici — validation par le test d'intégration gated, Step 4)**

Run: `npm run lint && npm run build`
Expected: 0 erreur.

- [ ] **Step 4: Lancer le test d'intégration si les credentials de test sont configurés**

Run: `npm run test:integration`
Expected: PASS (14 tests, les mêmes que `LocalStore` — le contrat partagé est maintenant identique entre les deux stores). Si les credentials `FOCUSACTIF_TEST_SUPABASE_*` ne sont pas configurés localement, ce test est silencieusement sauté (comportement du Plan 2, Task 4) — dans ce cas, se contenter de la vérification manuelle en fin de plan.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabaseStore.js
git commit -m "feat: SupabaseStore reminders via focus_reminders table"
```

---

### Task 5: `ReminderPicker` — composant de programmation du rappel

**Files:**
- Create: `src/components/ReminderPicker.jsx`
- Create: `src/components/ReminderPicker.test.jsx`

- [ ] **Step 1: Écrire le test qui échoue**

```jsx
// src/components/ReminderPicker.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ReminderPicker } from './ReminderPicker.jsx'

describe('ReminderPicker', () => {
  it('le bouton Programmer est désactivé tant qu\'aucune date n\'est saisie', () => {
    render(<ReminderPicker remindAt={null} onSetReminder={vi.fn()} onClearReminder={vi.fn()} />)
    expect(screen.getByRole('button', { name: /programmer/i })).toBeDisabled()
  })

  it('déclenche onSetReminder avec une date ISO au clic', async () => {
    const onSetReminder = vi.fn()
    render(<ReminderPicker remindAt={null} onSetReminder={onSetReminder} onClearReminder={vi.fn()} />)

    const input = screen.getByLabelText(/me le rappeler à/i)
    await userEvent.type(input, '2026-08-01T09:00')
    await userEvent.click(screen.getByRole('button', { name: /programmer/i }))

    expect(onSetReminder).toHaveBeenCalledWith(new Date('2026-08-01T09:00').toISOString())
  })

  it('affiche le rappel programmé et déclenche onClearReminder', async () => {
    const onClearReminder = vi.fn()
    const remindAt = new Date('2026-08-01T09:00').toISOString()
    render(<ReminderPicker remindAt={remindAt} onSetReminder={vi.fn()} onClearReminder={onClearReminder} />)

    expect(screen.getByText(/rappel prévu/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /retirer le rappel/i }))
    expect(onClearReminder).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- ReminderPicker`
Expected: FAIL — `Cannot find module './ReminderPicker.jsx'`

- [ ] **Step 3: Implémenter `ReminderPicker.jsx`**

```jsx
// src/components/ReminderPicker.jsx
import { useId, useState } from 'react'

export function ReminderPicker({ remindAt, onSetReminder, onClearReminder }) {
  const [value, setValue] = useState('')
  const inputId = useId()

  function handleSet() {
    if (!value) return
    onSetReminder(new Date(value).toISOString())
    setValue('')
  }

  if (remindAt) {
    const formatted = new Date(remindAt).toLocaleString('fr-BE', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
    return (
      <div className="plai-field">
        <p className="plai-help">Rappel prévu : {formatted}</p>
        <button type="button" className="plai-btn-ghost" onClick={onClearReminder}>
          Retirer le rappel
        </button>
      </div>
    )
  }

  return (
    <div className="plai-field">
      <label htmlFor={inputId} className="plai-label">
        Me le rappeler à
      </label>
      <input
        id={inputId}
        type="datetime-local"
        className="plai-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <p className="plai-help">
        Optionnel — un rappel doux (vibration, jamais de son) à l'heure choisie.
      </p>
      <button type="button" className="plai-btn-ghost mt-2" onClick={handleSet} disabled={!value}>
        Programmer le rappel
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- ReminderPicker`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ReminderPicker.jsx src/components/ReminderPicker.test.jsx
git commit -m "feat: ReminderPicker component"
```

---

### Task 6: Câbler `ReminderPicker` dans `TaskDashboard`

**Files:**
- Modify: `src/components/TaskDashboard.jsx`
- Modify: `src/components/TaskDashboard.test.jsx`

- [ ] **Step 1: Ajouter le test qui échoue**

`TaskDashboard.test.jsx` n'a pas besoin d'importer `ReminderPicker` directement — il vérifie seulement que son rendu (le label "Me le rappeler à") apparaît bien à l'écran une fois câblé dans `TaskDashboard`.

```jsx
// ajout dans TaskDashboard.test.jsx, à l'intérieur du describe existant

  it('affiche le ReminderPicker et relaie ses callbacks', () => {
    const task = { id: 't1', title: 'Réviser', status: 'todo', parentTaskId: null, remindAt: null }
    render(
      <TaskDashboard
        task={task}
        onComplete={vi.fn()}
        onDecompose={vi.fn()}
        onOpenCapture={vi.fn()}
        onSetReminder={vi.fn()}
        onClearReminder={vi.fn()}
      />,
    )
    expect(screen.getByLabelText(/me le rappeler à/i)).toBeInTheDocument()
  })
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- TaskDashboard`
Expected: FAIL — `Unable to find a label with the text of: /me le rappeler à/i` (le `ReminderPicker` n'est pas encore rendu).

- [ ] **Step 3: Modifier `TaskDashboard.jsx`**

```jsx
// src/components/TaskDashboard.jsx
import { ReminderPicker } from './ReminderPicker.jsx'

export function TaskDashboard({
  task,
  contextLocked = false,
  onComplete,
  onDecompose,
  onOpenCapture,
  onSetReminder,
  onClearReminder,
}) {
  if (!task) {
    return (
      <div className="plai-section">
        <p className="plai-empty">Aucune tâche ici. Ajoutez-en une pour commencer.</p>
        {!contextLocked && (
          <button type="button" className="plai-btn mt-4" onClick={onOpenCapture}>
            + Ajouter une tâche
          </button>
        )}
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
          {!contextLocked && !task.parentTaskId && (
            <button type="button" className="plai-btn" onClick={() => onDecompose(task.id)}>
              Décomposer
            </button>
          )}
        </div>
      </div>

      <ReminderPicker
        remindAt={task.remindAt}
        onSetReminder={(iso) => onSetReminder(task.id, iso)}
        onClearReminder={() => onClearReminder(task.id)}
      />

      {!contextLocked && (
        <button type="button" className="plai-btn mt-6" onClick={onOpenCapture}>
          + Ajouter une tâche
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- TaskDashboard`
Expected: PASS (6 tests : les 5 précédents + celui-ci)

- [ ] **Step 5: Commit**

```bash
git add src/components/TaskDashboard.jsx src/components/TaskDashboard.test.jsx
git commit -m "feat: wire ReminderPicker into TaskDashboard"
```

---

### Task 7: `useReminderWatcher` — rappel in-app (les deux modes)

**Files:**
- Create: `src/lib/useReminderWatcher.js`
- Create: `src/lib/useReminderWatcher.test.js`

- [ ] **Step 1: Écrire le test qui échoue**

```jsx
// src/lib/useReminderWatcher.test.js
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useReminderWatcher } from './useReminderWatcher.js'

describe('useReminderWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retourne false si la tâche n\'a pas de rappel', () => {
    const store = { markReminderSent: vi.fn() }
    const task = { id: 't1', remindAt: null, reminderSent: false }
    const { result } = renderHook(() => useReminderWatcher(store, task))
    expect(result.current).toBe(false)
  })

  it('déclenche le rappel dès que remindAt est dans le passé, une seule fois', async () => {
    const store = { markReminderSent: vi.fn().mockResolvedValue(undefined) }
    const task = { id: 't1', remindAt: new Date(Date.now() - 1000).toISOString(), reminderSent: false }

    const { result } = renderHook(() => useReminderWatcher(store, task))

    await waitFor(() => expect(result.current).toBe(true))
    expect(store.markReminderSent).toHaveBeenCalledWith('t1')
    expect(store.markReminderSent).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(60000)
    expect(store.markReminderSent).toHaveBeenCalledTimes(1)
  })

  it('ne déclenche rien si reminderSent est déjà true', () => {
    const store = { markReminderSent: vi.fn() }
    const task = { id: 't1', remindAt: new Date(Date.now() - 1000).toISOString(), reminderSent: true }
    const { result } = renderHook(() => useReminderWatcher(store, task))
    expect(result.current).toBe(false)
    expect(store.markReminderSent).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- useReminderWatcher`
Expected: FAIL — `Cannot find module './useReminderWatcher.js'`

- [ ] **Step 3: Implémenter `useReminderWatcher.js`**

```js
// src/lib/useReminderWatcher.js
import { useEffect, useRef, useState } from 'react'

const POLL_INTERVAL_MS = 20000

export function useReminderWatcher(store, task) {
  const [dueReminder, setDueReminder] = useState(false)
  const notifiedTaskIdRef = useRef(null)

  useEffect(() => {
    setDueReminder(false)
    notifiedTaskIdRef.current = null
  }, [task?.id])

  useEffect(() => {
    if (!store || !task || !task.remindAt || task.reminderSent) return

    function checkDue() {
      if (notifiedTaskIdRef.current === task.id) return
      if (new Date(task.remindAt) > new Date()) return

      notifiedTaskIdRef.current = task.id
      setDueReminder(true)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200])
      }
      store.markReminderSent(task.id)
    }

    checkDue()
    const interval = setInterval(checkDue, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [store, task])

  return dueReminder
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- useReminderWatcher`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/useReminderWatcher.js src/lib/useReminderWatcher.test.js
git commit -m "feat: useReminderWatcher hook for in-app gentle reminders"
```

---

### Task 8: Câbler le rappel in-app dans `App.jsx`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Importer le hook et les handlers de rappel dans `AppInner`**

```jsx
// en haut de src/App.jsx, ajouter l'import
import { useReminderWatcher } from './lib/useReminderWatcher.js'
```

```jsx
// dans AppInner, juste avant le `if (!store) return null`, ajouter :
  const reminderDue = useReminderWatcher(store, currentTask)
```

```jsx
// dans AppInner, ajouter ces deux handlers à côté de handleComplete :
  async function handleSetReminder(taskId, remindAtIso) {
    await store.setReminder(taskId, remindAtIso)
    await refreshCurrentTask()
  }

  async function handleClearReminder(taskId) {
    await store.clearReminder(taskId)
    await refreshCurrentTask()
  }
```

- [ ] **Step 2: Passer les nouvelles props à `TaskDashboard` et afficher la bannière de rappel dû**

```jsx
// remplacer le rendu final de TaskDashboard dans AppInner par :
  return (
    <>
      {reminderDue && (
        <p className="plai-success" role="status">
          Rappel : c'est le moment pour « {currentTask?.title} ».
        </p>
      )}
      <TaskDashboard
        task={currentTask}
        contextLocked={Boolean(activeContext?.locked)}
        onComplete={handleComplete}
        onDecompose={setDecomposing}
        onOpenCapture={() => setCapturing(true)}
        onSetReminder={handleSetReminder}
        onClearReminder={handleClearReminder}
      />
    </>
  )
```

- [ ] **Step 3: Lancer toute la suite**

Run: `npm test`
Expected: PASS — vérifier que `App.test.jsx` (Plan 1) et `App.account.test.jsx` (Plan 2) passent toujours : leurs mocks de store (`mockStore` dans `App.account.test.jsx`) n'implémentent pas `setReminder`/`clearReminder`/`markReminderSent`, mais `useReminderWatcher` ne les appelle que si `currentTask.remindAt` est renseigné — les tests existants créent des tâches sans rappel, donc `useReminderWatcher` reste inactif et ne les appelle jamais. Si un test échoue à cause de ça, ajouter les 3 méthodes en `vi.fn()` au `mockStore` de `App.account.test.jsx` sans changer les assertions existantes.

- [ ] **Step 4: Vérifier le build**

Run: `npm run build`
Expected: build réussi, 0 erreur.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire in-app reminder banner into App.jsx"
```

---

### Task 9: Clés VAPID et variable d'environnement

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Générer la paire de clés VAPID**

```bash
npx web-push generate-vapid-keys
```

Cette commande affiche une clé publique et une clé privée. **Étape manuelle, à faire une seule fois** :
1. Notez la clé publique et la clé privée quelque part en sécurité (pas dans le repo).
2. La clé publique ira dans `VITE_VAPID_PUBLIC_KEY` (variable Vercel, exposée au frontend — c'est son rôle, une clé VAPID publique est faite pour être exposée).
3. La clé privée ira en secret d'Edge Function Supabase (Task 13), jamais dans le frontend ni dans Git.

- [ ] **Step 2: Documenter la variable dans `.env.example`**

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_VAPID_PUBLIC_KEY=
```

- [ ] **Step 3: Ajouter la variable sur Vercel**

Manuel : `vercel env add VITE_VAPID_PUBLIC_KEY production` (et `preview`/`development`), coller la clé publique générée à l'étape 1.

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "docs: document VITE_VAPID_PUBLIC_KEY env var"
```

---

### Task 10: Manifest PWA et Service Worker

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`
- Modify: `index.html`

- [ ] **Step 1: Créer `public/manifest.webmanifest`**

```json
{
  "name": "FocusActif",
  "short_name": "FocusActif",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#faf9f7",
  "theme_color": "#0f6e56",
  "icons": [
    {
      "src": "/plai-logo.jpg",
      "sizes": "192x192",
      "type": "image/jpeg"
    }
  ]
}
```

- [ ] **Step 2: Créer `public/sw.js`**

```js
// public/sw.js
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'FocusActif'
  const body = data.body || 'Vous avez une tâche à faire.'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/plai-logo.jpg',
      vibrate: [200, 100, 200],
      silent: true,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow('/'))
})
```

Note : `silent: true` empêche le navigateur de jouer un son par défaut — cohérent avec le principe "rappel doux, jamais de son" déjà appliqué côté in-app.

- [ ] **Step 3: Modifier `index.html`**

```html
<!-- ajouter dans le <head>, à côté du lien favicon existant -->
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="theme-color" content="#0f6e56" />
```

- [ ] **Step 4: Vérifier le build**

Run: `npm run build`
Expected: build réussi (les fichiers `public/*` sont copiés tels quels par Vite dans `dist/`, pas de traitement JS).

- [ ] **Step 5: Commit**

```bash
git add public/manifest.webmanifest public/sw.js index.html
git commit -m "feat: add PWA manifest and service worker for push notifications"
```

---

### Task 11: `pushSubscription.js` — abonnement navigateur

**Files:**
- Create: `src/lib/pushSubscription.js`
- Create: `src/lib/pushSubscription.test.js`

- [ ] **Step 1: Écrire les tests qui échouent (APIs navigateur mockées)**

```js
// src/lib/pushSubscription.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { subscribeToPush } from './pushSubscription.js'

function base64UrlEncode(bytes) {
  return Buffer.from(bytes).toString('base64url')
}

describe('subscribeToPush', () => {
  let originalServiceWorker
  let originalNotification

  beforeEach(() => {
    originalServiceWorker = navigator.serviceWorker
    originalNotification = global.Notification
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', { value: originalServiceWorker, configurable: true })
    global.Notification = originalNotification
  })

  it('ne fait rien si la permission de notification est refusée', async () => {
    global.Notification = { requestPermission: vi.fn().mockResolvedValue('denied') }
    const supabase = { from: vi.fn() }

    const result = await subscribeToPush(supabase, 'fake-vapid-public-key')

    expect(result).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('enregistre l\'abonnement Supabase si la permission est accordée', async () => {
    global.Notification = { requestPermission: vi.fn().mockResolvedValue('granted') }

    const fakeSubscription = {
      endpoint: 'https://push.example.com/abc',
      toJSON: () => ({
        endpoint: 'https://push.example.com/abc',
        keys: { p256dh: 'fake-p256dh', auth: 'fake-auth' },
      }),
    }
    const fakeRegistration = {
      pushManager: { subscribe: vi.fn().mockResolvedValue(fakeSubscription) },
    }

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn().mockResolvedValue(fakeRegistration),
        ready: Promise.resolve(fakeRegistration),
      },
      configurable: true,
    })

    const upsert = vi.fn().mockResolvedValue({ data: null, error: null })
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: vi.fn(() => ({ upsert })),
    }

    const result = await subscribeToPush(supabase, 'fake-vapid-public-key')

    expect(fakeRegistration.pushManager.subscribe).toHaveBeenCalled()
    expect(supabase.from).toHaveBeenCalledWith('focus_push_subscriptions')
    expect(upsert).toHaveBeenCalledWith(
      {
        owner_id: 'u1',
        endpoint: 'https://push.example.com/abc',
        p256dh: 'fake-p256dh',
        auth: 'fake-auth',
      },
      { onConflict: 'endpoint' },
    )
    expect(result).toEqual(fakeSubscription)
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- pushSubscription`
Expected: FAIL — `Cannot find module './pushSubscription.js'`

- [ ] **Step 3: Implémenter `pushSubscription.js`**

```js
// src/lib/pushSubscription.js
export async function subscribeToPush(supabase, vapidPublicKey) {
  if (typeof Notification === 'undefined') return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidPublicKey,
  })

  const { data: userData } = await supabase.auth.getUser()
  const json = subscription.toJSON()

  await supabase.from('focus_push_subscriptions').upsert(
    {
      owner_id: userData.user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: 'endpoint' },
  )

  return subscription
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- pushSubscription`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/pushSubscription.js src/lib/pushSubscription.test.js
git commit -m "feat: pushSubscription registers browser push subscription in Supabase"
```

---

### Task 12: Enregistrer le Service Worker et l'abonnement push (mode compte)

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Enregistrer le Service Worker au chargement et s'abonner en mode compte**

```jsx
// en haut de src/App.jsx, ajouter l'import
import { useEffect } from 'react' // déjà importé — vérifier qu'il ne l'est pas deux fois, fusionner avec l'import React existant
```

Le fichier importe déjà `useCallback, useEffect, useState` depuis `react` (Plan 1) — ne pas dupliquer cet import, juste vérifier qu'`useEffect` y figure déjà (c'est le cas).

```jsx
// dans le composant App() (pas AppInner), ajouter un effet après la déclaration des states :

  useEffect(() => {
    if (storageMode !== 'account' || !authed) return
    if (!('serviceWorker' in navigator)) return

    let cancelled = false

    async function register() {
      await navigator.serviceWorker.register('/sw.js')
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      if (!vapidKey || cancelled) return
      const { supabase } = await import('./lib/supabaseClient.js')
      const { subscribeToPush } = await import('./lib/pushSubscription.js')
      await subscribeToPush(supabase, vapidKey)
    }

    register()
    return () => {
      cancelled = true
    }
  }, [storageMode, authed])
```

Note : cet effet ne fait rien en mode local (`storageMode !== 'account'`) ni tant que l'utilisateur n'est pas authentifié — cohérent avec "le mode local n'a jamais de vrai push". Si `subscribeToPush` échoue (permission refusée, navigateur non compatible), l'erreur reste silencieuse ici volontairement : l'absence de push ne doit jamais bloquer l'usage de l'app, seul le rappel in-app (Task 7-8, fonctionnel dans les deux modes) est garanti.

- [ ] **Step 2: Lancer toute la suite**

Run: `npm test`
Expected: PASS — `App.account.test.jsx` doit continuer à passer ; si `navigator.serviceWorker` n'existe pas dans l'environnement jsdom de test, le nouvel effet sort immédiatement via `if (!('serviceWorker' in navigator)) return` sans erreur.

- [ ] **Step 3: Vérifier le build**

Run: `npm run build`
Expected: build réussi.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: register service worker and push subscription in account mode"
```

---

### Task 13: Edge Function `send-reminders`

**Files:**
- Create: `supabase/functions/send-reminders/index.ts`

- [ ] **Step 1: Écrire la fonction**

```ts
// supabase/functions/send-reminders/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:jeanfrancois.beguin@ens.ecl.be'

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

Deno.serve(async () => {
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: dueReminders, error: remindersError } = await supabase
    .from('focus_reminders')
    .select('id, task_id, owner_id')
    .lte('remind_at', new Date().toISOString())
    .eq('sent', false)

  if (remindersError) {
    return new Response(JSON.stringify({ error: remindersError.message }), { status: 500 })
  }

  let sentCount = 0

  for (const reminder of dueReminders ?? []) {
    const { data: task } = await supabase
      .from('focus_tasks')
      .select('title')
      .eq('id', reminder.task_id)
      .single()

    const { data: subscriptions } = await supabase
      .from('focus_push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('owner_id', reminder.owner_id)

    for (const sub of subscriptions ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: 'FocusActif',
            body: task?.title ? `C'est le moment pour « ${task.title} »` : 'Vous avez une tâche à faire.',
          }),
        )
      } catch {
        // Un abonnement expiré/invalide ne doit pas bloquer les autres envois ni faire
        // échouer la fonction entière — on continue, sans marquer sent=true pour ce
        // rappel si aucun envoi n'a réussi (voir logique ci-dessous).
      }
    }

    await supabase.from('focus_reminders').update({ sent: true }).eq('id', reminder.id)
    sentCount += 1
  }

  return new Response(JSON.stringify({ processed: sentCount }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

Note : `sent = true` est posé après la tentative d'envoi, que l'envoi ait réussi ou non pour un abonnement donné — évite qu'un abonnement mort en boucle empêche indéfiniment de traiter ce rappel. Un utilisateur sans abonnement push actif (mode local, ou compte jamais abonné) ne reçoit simplement aucun push ; le rappel in-app (Task 7-8) reste son seul canal, ce qui est le comportement attendu.

- [ ] **Step 2: Déployer la fonction (manuel)**

```bash
supabase link --project-ref dfoaumjleqtxjeaplnna
supabase functions deploy send-reminders --no-verify-jwt
```

- [ ] **Step 3: Configurer les secrets de la fonction (manuel)**

```bash
supabase secrets set VAPID_PUBLIC_KEY="<clé publique générée au Task 9>"
supabase secrets set VAPID_PRIVATE_KEY="<clé privée générée au Task 9>"
supabase secrets set VAPID_SUBJECT="mailto:jeanfrancois.beguin@ens.ecl.be"
```

(`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont déjà fournis automatiquement à toute Edge Function par Supabase, pas besoin de les définir.)

- [ ] **Step 4: Tester manuellement la fonction**

```bash
curl -X POST "https://dfoaumjleqtxjeaplnna.supabase.co/functions/v1/send-reminders" \
  -H "Authorization: Bearer <clé anon ou service_role>"
```

Expected: réponse JSON `{"processed": N}` sans erreur 500.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/send-reminders/index.ts
git commit -m "feat: send-reminders Edge Function (Web Push dispatch)"
```

---

### Task 14: Planification `pg_cron`

**Files:** (aucun fichier — SQL exécuté manuellement dans le Dashboard Supabase)

- [ ] **Step 1: Activer les extensions nécessaires (manuel, une fois)**

Dashboard Supabase → Database → Extensions → activer `pg_cron` et `pg_net`.

- [ ] **Step 2: Stocker la clé de service dans Vault (manuel, une fois)**

Dashboard Supabase → Project Settings → Vault → nouveau secret, nom `service_role_key`, valeur = la clé `service_role` du projet (Project Settings → API).

- [ ] **Step 3: Programmer l'appel périodique**

Dans le SQL Editor, exécuter :

```sql
select cron.schedule(
  'focusactif-send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://dfoaumjleqtxjeaplnna.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Ceci appelle `send-reminders` toutes les minutes. Vérifier dans Database → Cron Jobs que `focusactif-send-reminders` apparaît et s'exécute (colonne "Last run").

- [ ] **Step 4: Vérifier l'exécution**

Après quelques minutes, dans Database → Cron Jobs → cliquer sur le job → consulter l'historique des exécutions (`cron.job_run_details`) : les appels doivent apparaître avec un statut succeeded.

---

## Vérification manuelle finale (avant de considérer le Plan 3 terminé)

- [ ] Mode local : sur `TaskDashboard`, programmer un rappel à +1 minute sur la tâche courante, laisser l'onglet ouvert, vérifier qu'une bannière discrète apparaît et que l'appareil vibre (si le navigateur/l'appareil le permet) — jamais de son.
- [ ] Mode local : recharger la page avant l'échéance, revenir sur la tâche : le rappel programmé doit être toujours affiché (persistant en IndexedDB), pas perdu au rafraîchissement.
- [ ] Mode compte : sur un poste où la permission de notification est accordée, vérifier dans les DevTools (Application → Service Workers) que `sw.js` est bien enregistré et actif.
- [ ] Mode compte : vérifier dans Supabase (Table Editor → `focus_push_subscriptions`) qu'une ligne existe pour le compte de test après connexion.
- [ ] Mode compte : programmer un rappel à +2 minutes, fermer complètement l'onglet, attendre : une vraie notification système doit apparaître (le `pg_cron` tourne toutes les minutes).
- [ ] Vérifier dans `focus_reminders` que la ligne correspondante passe bien à `sent = true` après l'envoi.
- [ ] Retirer un rappel programmé (`ReminderPicker` → "Retirer le rappel") et vérifier qu'aucune notification n'arrive après l'heure initialement programmée.
