# FocusActif — Plan 2 : Compte Supabase + liaison enseignant/élève Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le mode compte (Supabase) à FocusActif, coexistant avec le mode local du Plan 1 : `SupabaseStore` implémentant le même contrat `TaskStore`, un écran de choix local/compte, et une liaison enseignant-élève bidirectionnelle par code permettant à l'enseignant de verrouiller des contextes pour un élève lié.

**Architecture:** `SupabaseStore` (nouveau, `src/lib/supabaseStore.js`) implémente exactement la même interface que `LocalStore` (Plan 1) et est validé par le même fichier de contrat partagé (`taskStore.contract.js`), exécuté ici contre un vrai projet Supabase de test (tests d'intégration gated par variables d'environnement, car le contrat teste un comportement réel de requêtes/tri, pas mockable sans réimplémenter le store). `StoreContext` choisit `LocalStore` ou `SupabaseStore` selon le choix fait à l'écran `StorageSetup`. La liaison enseignant/élève passe par une fonction Postgres `SECURITY DEFINER` (`focus_claim_link`) plutôt qu'une politique RLS permissive, pour éviter d'exposer les codes d'invitation à quiconque peut lire la table.

**Tech Stack:** `@supabase/supabase-js` v2, Postgres RLS + fonction `SECURITY DEFINER`, React/Vite/Tailwind (gabarit PLAI déjà en place depuis le Plan 1).

**Projet Supabase** : `dfoaumjleqtxjeaplnna` (projet partagé principal — pas le projet Picto-lecture/Flashfwb, sans lien avec ARASAAC). Table `profiles` et trigger `updated_at` déjà présents dans ce projet, réutilisés tels quels, jamais recréés.

---

## Vue d'ensemble des fichiers

```
focusactif/
  .env.example                               -- NOUVEAU
  package.json                               -- MODIFIÉ (dépendance @supabase/supabase-js, script test:integration)
  supabase/
    migrations/
      20260718120000_create_focus_tables.sql -- NOUVEAU
  src/
    lib/
      supabaseClient.js                      -- NOUVEAU
      supabaseStore.js                       -- NOUVEAU
      supabaseStore.contract.test.js         -- NOUVEAU (intégration, gated)
      linkStore.js                           -- NOUVEAU
      linkStore.test.js                      -- NOUVEAU (unitaire, client mocké)
    context/
      StoreContext.jsx                       -- MODIFIÉ (choix Local/Supabase)
      StoreContext.test.jsx                  -- MODIFIÉ
    components/
      StorageSetup.jsx                       -- NOUVEAU
      StorageSetup.test.jsx                  -- NOUVEAU
      Auth.jsx                                -- NOUVEAU
      Auth.test.jsx                           -- NOUVEAU
      LinkByCode.jsx                          -- NOUVEAU
      LinkByCode.test.jsx                     -- NOUVEAU
      TeacherRoster.jsx                       -- NOUVEAU
      TeacherRoster.test.jsx                  -- NOUVEAU
    App.jsx                                  -- MODIFIÉ (câblage StorageSetup → Auth → app)
```

---

### Task 1: Migration Supabase — tables et RLS

**Files:**
- Create: `supabase/migrations/20260718120000_create_focus_tables.sql`

- [ ] **Step 1: Écrire la migration complète**

```sql
-- supabase/migrations/20260718120000_create_focus_tables.sql

create table if not exists public.focus_contexts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  emoji text not null default '📌',
  locked boolean not null default false,
  locked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.focus_tasks (
  id uuid primary key default gen_random_uuid(),
  context_id uuid not null references public.focus_contexts(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'done')),
  parent_task_id uuid references public.focus_tasks(id) on delete cascade,
  step_order integer not null default 0,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

create index if not exists focus_tasks_context_id_idx on public.focus_tasks(context_id);
create index if not exists focus_tasks_parent_task_id_idx on public.focus_tasks(parent_task_id);

create table if not exists public.focus_links (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users(id) on delete cascade,
  student_id uuid references auth.users(id) on delete cascade,
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  initiated_by text not null check (initiated_by in ('teacher', 'student')),
  status text not null default 'pending' check (status in ('pending', 'linked')),
  created_at timestamptz not null default now(),
  linked_at timestamptz
);

alter table public.focus_contexts enable row level security;
alter table public.focus_tasks enable row level security;
alter table public.focus_links enable row level security;

-- focus_contexts : le propriétaire a tous les droits
create policy "focus_contexts_owner_all" on public.focus_contexts
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- focus_contexts : un enseignant lié peut voir les contextes de l'élève
create policy "focus_contexts_teacher_select" on public.focus_contexts
  for select
  using (
    exists (
      select 1 from public.focus_links l
      where l.status = 'linked' and l.teacher_id = auth.uid() and l.student_id = focus_contexts.owner_id
    )
  );

-- focus_contexts : un enseignant ne peut modifier/créer que les contextes qu'il verrouille lui-même
create policy "focus_contexts_teacher_manage_locked" on public.focus_contexts
  for update
  using (locked_by = auth.uid())
  with check (locked_by = auth.uid());

create policy "focus_contexts_teacher_insert_locked" on public.focus_contexts
  for insert
  with check (
    locked_by = auth.uid()
    and exists (
      select 1 from public.focus_links l
      where l.status = 'linked' and l.teacher_id = auth.uid() and l.student_id = focus_contexts.owner_id
    )
  );

-- focus_tasks : accessible à qui a accès au contexte parent (propriétaire ou enseignant verrouillant)
create policy "focus_tasks_via_context" on public.focus_tasks
  for all
  using (
    exists (
      select 1 from public.focus_contexts c
      where c.id = focus_tasks.context_id
        and (c.owner_id = auth.uid() or c.locked_by = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.focus_contexts c
      where c.id = focus_tasks.context_id
        and (c.owner_id = auth.uid() or c.locked_by = auth.uid())
    )
  );

-- focus_links : chaque partie voit ses propres liens
create policy "focus_links_visible_to_parties" on public.focus_links
  for select
  using (auth.uid() = teacher_id or auth.uid() = student_id);

-- focus_links : chacun ne peut créer qu'un lien "en attente" à son propre nom
create policy "focus_links_insert_own" on public.focus_links
  for insert
  with check (
    (initiated_by = 'teacher' and teacher_id = auth.uid() and student_id is null)
    or (initiated_by = 'student' and student_id = auth.uid() and teacher_id is null)
  );

-- focus_links : chaque partie peut révoquer un lien qui la concerne
create policy "focus_links_owner_delete" on public.focus_links
  for delete
  using (auth.uid() = teacher_id or auth.uid() = student_id);

-- Réclamation d'un lien par code : passe par une fonction SECURITY DEFINER,
-- pas par une politique RLS permissive (qui exposerait les codes/lignes en attente
-- de tout le monde à qui que ce soit sachant faire un SELECT).
create or replace function public.focus_claim_link(p_code text)
returns public.focus_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.focus_links;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_link from public.focus_links
    where invite_code = p_code and status = 'pending'
    for update;

  if not found then
    raise exception 'invalid_or_used_code';
  end if;

  if v_link.initiated_by = 'teacher' then
    if v_link.teacher_id = v_uid then
      raise exception 'invalid_or_used_code';
    end if;
    update public.focus_links
      set student_id = v_uid, status = 'linked', linked_at = now()
      where id = v_link.id
      returning * into v_link;
  else
    if v_link.student_id = v_uid then
      raise exception 'invalid_or_used_code';
    end if;
    update public.focus_links
      set teacher_id = v_uid, status = 'linked', linked_at = now()
      where id = v_link.id
      returning * into v_link;
  end if;

  return v_link;
end;
$$;

grant execute on function public.focus_claim_link(text) to authenticated;
```

- [ ] **Step 2: Appliquer la migration au projet Supabase de développement**

Cette étape est manuelle (pas de CLI Supabase configurée dans ce workspace pour l'instant) :
1. Ouvrir le dashboard Supabase du projet `dfoaumjleqtxjeaplnna` → SQL Editor.
2. Coller le contenu du fichier de migration ci-dessus, exécuter.
3. Vérifier dans Table Editor que `focus_contexts`, `focus_tasks`, `focus_links` existent, RLS activé (icône verrouillée) sur les 3.
4. Vérifier dans Database → Functions que `focus_claim_link` existe.

- [ ] **Step 3: Vérifier l'absence de conflit de nommage avant de committer**

Run: `grep -rn "focus_" "C:/Users/jfbeg/OneDrive/claude-workspace" --include="*.sql"`
Expected: seuls les fichiers de ce projet (`focusactif/supabase/...`) apparaissent — aucune autre app du projet partagé n'utilise déjà le préfixe `focus_`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260718120000_create_focus_tables.sql
git commit -m "feat: Supabase schema for focus_contexts/focus_tasks/focus_links with RLS and claim function"
```

---

### Task 2: Client Supabase et dépendance

**Files:**
- Create: `src/lib/supabaseClient.js`
- Create: `.env.example`
- Modify: `package.json`

- [ ] **Step 1: Installer la dépendance**

```bash
npm install @supabase/supabase-js@^2.57.4
```

- [ ] **Step 2: Créer `.env.example`**

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

- [ ] **Step 3: Créer `src/lib/supabaseClient.js`**

```js
// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 4: Vérifier que le build ne casse pas en l'absence de variables d'env**

`supabaseClient.js` lève une exception au chargement si les variables sont absentes — c'est voulu (échec explicite plutôt que client silencieusement cassé), mais cela ne doit être importé que lorsque le mode compte est réellement choisi (pas au chargement initial de l'app). Ce point est traité au Task 6 (`StoreContext`) via un import dynamique. Pour l'instant, vérifier simplement que ce fichier seul ne casse pas `npm run build` (il n'est importé nulle part encore) :

Run: `npm run build`
Expected: build réussi (le fichier existe mais n'est pas encore importé, donc jamais exécuté).

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabaseClient.js .env.example package.json package-lock.json
git commit -m "feat: add Supabase client and env var documentation"
```

---

### Task 3: `SupabaseStore` — contextes et tâches (méthodes `TaskStore`)

**Files:**
- Create: `src/lib/supabaseStore.js`

- [ ] **Step 1: Implémenter `supabaseStore.js` en entier**

Contrairement à `LocalStore` (Plan 1, un seul fichier construit tâche par tâche), `SupabaseStore` est écrit en une fois ici car chaque méthode est une requête Supabase indépendante et courte — le découper en 4 tâches comme `LocalStore` ajouterait de la cérémonie sans bénéfice (pas de logique partagée à faire émerger progressivement, contrairement à `listSubtasksOf`/`getNextTask` du Plan 1).

```js
// src/lib/supabaseStore.js
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
```

Note : `toTask` convertit les colonnes `snake_case` de Postgres (`context_id`, `parent_task_id`, `step_order`, `created_at`, `done_at`) vers les mêmes clés `camelCase` que `LocalStore` (`contextId`, `parentTaskId`, `stepOrder`, `createdAt`, `doneAt`) — c'est ce qui permet au même `taskStore.contract.js` (écrit au Plan 1 contre `LocalStore`) de passer aussi contre `SupabaseStore` sans aucune modification : le contrat ne connaît que la forme `camelCase`, jamais le schéma SQL sous-jacent.

- [ ] **Step 2: Commit**

```bash
git add src/lib/supabaseStore.js
git commit -m "feat: SupabaseStore implementing the TaskStore contract"
```

(Pas de test unitaire isolé à cette étape — la validation complète se fait au Task 4 en rejouant `taskStore.contract.js` contre une vraie instance Supabase, seule façon de vérifier honnêtement le comportement des requêtes/tri/RLS.)

---

### Task 4: Validation de `SupabaseStore` contre le contrat partagé (test d'intégration gated)

**Files:**
- Create: `src/lib/supabaseStore.contract.test.js`
- Modify: `package.json`

- [ ] **Step 1: Ajouter le script `test:integration`**

Dans `package.json`, section `scripts` :

```json
    "test:integration": "vitest run --config vitest.integration.config.js"
```

- [ ] **Step 2: Créer `vitest.integration.config.js`**

```js
// vitest.integration.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.contract.test.js'],
    globals: true,
  },
})
```

- [ ] **Step 3: Créer `src/lib/supabaseStore.contract.test.js`**

```js
// src/lib/supabaseStore.contract.test.js
import { describe } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { runTaskStoreContractTests } from './taskStore.contract.js'
import { createSupabaseStore } from './supabaseStore.js'

const url = process.env.FOCUSACTIF_TEST_SUPABASE_URL
const anonKey = process.env.FOCUSACTIF_TEST_SUPABASE_ANON_KEY
const email = process.env.FOCUSACTIF_TEST_SUPABASE_EMAIL
const password = process.env.FOCUSACTIF_TEST_SUPABASE_PASSWORD

const hasCredentials = Boolean(url && anonKey && email && password)

describe.skipIf(!hasCredentials)('SupabaseStore (intégration réelle)', () => {
  runTaskStoreContractTests(async () => {
    const client = createClient(url, anonKey)
    const { error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw error
    return createSupabaseStore(client)
  })
})
```

**Pourquoi gated par variables d'environnement, pas mocké** : `taskStore.contract.js` teste un comportement réel (ordre de retour, priorité sous-étape/parent, filtrage par statut) — un mock du client Supabase qui simulerait fidèlement ce comportement reviendrait à réimplémenter `SupabaseStore` une seconde fois dans le mock, ce qui ne prouverait rien. Ce test ne tourne donc pas dans `npm test` (silencieusement ignoré sans les 4 variables d'environnement `FOCUSACTIF_TEST_SUPABASE_*`), mais tourne dans `npm run test:integration` dès qu'un compte de test dédié existe sur le projet `dfoaumjleqtxjeaplnna`.

- [ ] **Step 4: Créer le compte de test et lancer les tests d'intégration**

1. Dans le dashboard Supabase du projet `dfoaumjleqtxjeaplnna` → Authentication → ajouter un utilisateur de test (email/mot de passe dédiés, ex. `focusactif-test@jfb4plai.com`).
2. Définir les variables d'environnement localement (ne jamais les committer) :
```bash
export FOCUSACTIF_TEST_SUPABASE_URL="https://dfoaumjleqtxjeaplnna.supabase.co"
export FOCUSACTIF_TEST_SUPABASE_ANON_KEY="<clé anon du projet>"
export FOCUSACTIF_TEST_SUPABASE_EMAIL="focusactif-test@jfb4plai.com"
export FOCUSACTIF_TEST_SUPABASE_PASSWORD="<mot de passe du compte de test>"
```
3. Run: `npm run test:integration`
Expected: PASS — les 11 tests du contrat partagé (les mêmes que `LocalStore` au Plan 1) passent contre le vrai `SupabaseStore`.

- [ ] **Step 5: Vérifier que `npm test` (suite normale) ignore bien ce fichier sans plantage**

Run: `npm test`
Expected: PASS — `supabaseStore.contract.test.js` n'est PAS exécuté par la config normale (`vite.config.js`, qui scanne `src/**/*.test.jsx`/`.test.js` par défaut, mais ce fichier utilise `describe.skipIf` et de toute façon les variables d'env de test ne sont pas définies en local par défaut — vérifier qu'aucune erreur d'import ne survient au chargement du fichier même sans ces variables, uniquement un skip propre).

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabaseStore.contract.test.js vitest.integration.config.js package.json
git commit -m "test: validate SupabaseStore against the shared TaskStore contract (gated integration test)"
```

---

### Task 5: `StorageSetup` — écran de choix local/compte

**Files:**
- Create: `src/components/StorageSetup.jsx`
- Create: `src/components/StorageSetup.test.jsx`

- [ ] **Step 1: Écrire le test qui échoue**

```jsx
// src/components/StorageSetup.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { StorageSetup } from './StorageSetup.jsx'

describe('StorageSetup', () => {
  it('déclenche onChooseLocal au clic sur "Continuer sans compte"', async () => {
    const onChooseLocal = vi.fn()
    render(<StorageSetup onChooseLocal={onChooseLocal} onChooseAccount={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /sans compte/i }))
    expect(onChooseLocal).toHaveBeenCalled()
  })

  it('déclenche onChooseAccount au clic sur "Créer un compte / Se connecter"', async () => {
    const onChooseAccount = vi.fn()
    render(<StorageSetup onChooseLocal={vi.fn()} onChooseAccount={onChooseAccount} />)
    await userEvent.click(screen.getByRole('button', { name: /créer un compte|se connecter/i }))
    expect(onChooseAccount).toHaveBeenCalled()
  })

  it('affiche la limite du mode local (pas de configuration enseignant à distance)', () => {
    render(<StorageSetup onChooseLocal={vi.fn()} onChooseAccount={vi.fn()} />)
    expect(screen.getByText(/enseignant.*à distance/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- StorageSetup`
Expected: FAIL — `Cannot find module './StorageSetup.jsx'`

- [ ] **Step 3: Implémenter `StorageSetup.jsx`**

```jsx
// src/components/StorageSetup.jsx
export function StorageSetup({ onChooseLocal, onChooseAccount }) {
  return (
    <div className="plai-section">
      <h2>Comment voulez-vous utiliser FocusActif ?</h2>

      <div className="plai-card mb-4">
        <p className="mb-3">
          <strong>Sans compte</strong> — vos contextes et tâches restent uniquement sur cet
          appareil.
        </p>
        <p className="plai-help mb-3">
          Limite à connaître : dans ce mode, un enseignant ne peut pas configurer ou verrouiller
          de contexte à distance, puisque rien n'est envoyé sur un serveur.
        </p>
        <button type="button" className="plai-btn" onClick={onChooseLocal}>
          Continuer sans compte
        </button>
      </div>

      <div className="plai-card">
        <p className="mb-3">
          <strong>Avec un compte</strong> — vos données sont synchronisées, et un enseignant lié
          peut configurer certains contextes pour vous.
        </p>
        <button type="button" className="plai-btn" onClick={onChooseAccount}>
          Créer un compte / Se connecter
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- StorageSetup`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/StorageSetup.jsx src/components/StorageSetup.test.jsx
git commit -m "feat: StorageSetup screen (local vs account choice)"
```

---

### Task 6: `Auth` — connexion/inscription Supabase

**Files:**
- Create: `src/components/Auth.jsx`
- Create: `src/components/Auth.test.jsx`

- [ ] **Step 1: Écrire le test qui échoue**

```jsx
// src/components/Auth.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Auth } from './Auth.jsx'

describe('Auth', () => {
  it('déclenche onSignIn avec email/mot de passe saisis', async () => {
    const onSignIn = vi.fn().mockResolvedValue(undefined)
    render(<Auth onSignIn={onSignIn} onSignUp={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/adresse e-mail/i), 'eleve@example.com')
    await userEvent.type(screen.getByLabelText(/mot de passe/i), 'motdepasse123')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    expect(onSignIn).toHaveBeenCalledWith('eleve@example.com', 'motdepasse123')
  })

  it('affiche une erreur générique si la connexion échoue', async () => {
    const onSignIn = vi.fn().mockRejectedValue(new Error('Invalid login credentials'))
    render(<Auth onSignIn={onSignIn} onSignUp={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/adresse e-mail/i), 'eleve@example.com')
    await userEvent.type(screen.getByLabelText(/mot de passe/i), 'mauvais')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    expect(await screen.findByText(/identifiants incorrects/i)).toBeInTheDocument()
  })

  it('bascule vers le formulaire d\'inscription et déclenche onSignUp', async () => {
    const onSignUp = vi.fn().mockResolvedValue(undefined)
    render(<Auth onSignIn={vi.fn()} onSignUp={onSignUp} />)

    await userEvent.click(screen.getByRole('button', { name: /créer un compte/i }))
    await userEvent.type(screen.getByLabelText(/adresse e-mail/i), 'nouveau@example.com')
    await userEvent.type(screen.getByLabelText(/mot de passe/i), 'motdepasse123')
    await userEvent.click(screen.getByRole('button', { name: /^créer mon compte$/i }))

    expect(onSignUp).toHaveBeenCalledWith('nouveau@example.com', 'motdepasse123')
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- Auth`
Expected: FAIL — `Cannot find module './Auth.jsx'`

- [ ] **Step 3: Implémenter `Auth.jsx`**

```jsx
// src/components/Auth.jsx
import { useId, useState } from 'react'

export function Auth({ onSignIn, onSignUp }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const emailId = useId()
  const passwordId = useId()

  async function handleSubmit() {
    setError('')
    try {
      if (mode === 'signin') {
        await onSignIn(email, password)
      } else {
        await onSignUp(email, password)
      }
    } catch {
      setError('Identifiants incorrects, ou compte déjà existant. Vérifiez et réessayez.')
    }
  }

  return (
    <div className="plai-section">
      <h2>{mode === 'signin' ? 'Se connecter' : 'Créer un compte'}</h2>

      {error && <p className="plai-error">{error}</p>}

      <div className="plai-field">
        <label htmlFor={emailId} className="plai-label">
          Adresse e-mail
        </label>
        <input
          id={emailId}
          type="email"
          className="plai-input"
          placeholder="ex : eleve@ecole.be"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className="plai-help">Sert uniquement à retrouver votre compte, jamais partagée.</p>
      </div>

      <div className="plai-field">
        <label htmlFor={passwordId} className="plai-label">
          Mot de passe
        </label>
        <input
          id={passwordId}
          type="password"
          className="plai-input"
          placeholder="ex : au moins 8 caractères"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <button type="button" className="plai-btn" onClick={handleSubmit}>
        {mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
      </button>

      <button
        type="button"
        className="plai-btn-ghost mt-3"
        onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
      >
        {mode === 'signin' ? 'Créer un compte' : 'J\'ai déjà un compte'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- Auth`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/Auth.jsx src/components/Auth.test.jsx
git commit -m "feat: Auth component (sign in / sign up)"
```

---

### Task 7: `linkStore` — création et réclamation de liens enseignant/élève

**Files:**
- Create: `src/lib/linkStore.js`
- Create: `src/lib/linkStore.test.js`

- [ ] **Step 1: Écrire les tests qui échouent (client Supabase mocké)**

```js
// src/lib/linkStore.test.js
import { describe, it, expect, vi } from 'vitest'
import { createLink, claimLink, listLinks } from './linkStore.js'

function makeMockSupabase({ user, insertResult, claimResult, claimError, listResult }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: insertResult, error: null }),
        })),
      })),
      select: vi.fn(() => ({
        or: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: listResult, error: null }),
        })),
      })),
    })),
    rpc: vi.fn().mockResolvedValue(
      claimError ? { data: null, error: claimError } : { data: claimResult, error: null },
    ),
  }
}

describe('linkStore', () => {
  it('createLink insère un lien initié par l\'enseignant avec teacher_id renseigné', async () => {
    const supabase = makeMockSupabase({
      user: { id: 'teacher-1' },
      insertResult: { id: 'link-1', teacher_id: 'teacher-1', student_id: null, invite_code: 'ABC123', status: 'pending' },
    })

    const link = await createLink(supabase, 'teacher')

    expect(supabase.from).toHaveBeenCalledWith('focus_links')
    expect(link.invite_code).toBe('ABC123')
  })

  it('claimLink appelle le RPC focus_claim_link avec le code fourni', async () => {
    const supabase = makeMockSupabase({
      user: { id: 'student-1' },
      claimResult: { id: 'link-1', teacher_id: 'teacher-1', student_id: 'student-1', status: 'linked' },
    })

    const link = await claimLink(supabase, 'ABC123')

    expect(supabase.rpc).toHaveBeenCalledWith('focus_claim_link', { p_code: 'ABC123' })
    expect(link.status).toBe('linked')
  })

  it('claimLink lève une erreur générique si le RPC échoue', async () => {
    const supabase = makeMockSupabase({
      user: { id: 'student-1' },
      claimError: { message: 'invalid_or_used_code' },
    })

    await expect(claimLink(supabase, 'BADCODE')).rejects.toThrow(/code invalide/i)
  })

  it('listLinks retourne les liens où l\'utilisateur est enseignant ou élève', async () => {
    const supabase = makeMockSupabase({
      user: { id: 'teacher-1' },
      listResult: [{ id: 'link-1', teacher_id: 'teacher-1', student_id: 'student-1', status: 'linked' }],
    })

    const links = await listLinks(supabase)

    expect(links).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- linkStore`
Expected: FAIL — `Cannot find module './linkStore.js'`

- [ ] **Step 3: Implémenter `linkStore.js`**

```js
// src/lib/linkStore.js
export async function createLink(supabase, initiatedBy) {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user.id

  const payload =
    initiatedBy === 'teacher'
      ? { teacher_id: userId, initiated_by: 'teacher' }
      : { student_id: userId, initiated_by: 'student' }

  const { data, error } = await supabase.from('focus_links').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function claimLink(supabase, code) {
  const { data, error } = await supabase.rpc('focus_claim_link', { p_code: code })
  if (error) throw new Error('Code invalide ou déjà utilisé.')
  return data
}

export async function listLinks(supabase) {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user.id

  const { data, error } = await supabase
    .from('focus_links')
    .select('*')
    .or(`teacher_id.eq.${userId},student_id.eq.${userId}`)
    .eq('status', 'linked')
  if (error) throw error
  return data
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- linkStore`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/linkStore.js src/lib/linkStore.test.js
git commit -m "feat: linkStore (create/claim/list teacher-student links)"
```

---

### Task 8: `LinkByCode` — composant bidirectionnel

**Files:**
- Create: `src/components/LinkByCode.jsx`
- Create: `src/components/LinkByCode.test.jsx`

- [ ] **Step 1: Écrire le test qui échoue**

```jsx
// src/components/LinkByCode.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { LinkByCode } from './LinkByCode.jsx'

describe('LinkByCode', () => {
  it('génère un code au clic sur "Générer un code" et l\'affiche', async () => {
    const onGenerate = vi.fn().mockResolvedValue({ invite_code: 'ABC123' })
    render(<LinkByCode role="teacher" onGenerate={onGenerate} onClaim={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /générer un code/i }))

    expect(onGenerate).toHaveBeenCalledWith('teacher')
    expect(await screen.findByText('ABC123')).toBeInTheDocument()
  })

  it('déclenche onClaim avec le code saisi', async () => {
    const onClaim = vi.fn().mockResolvedValue({ status: 'linked' })
    render(<LinkByCode role="student" onGenerate={vi.fn()} onClaim={onClaim} />)

    await userEvent.type(screen.getByLabelText(/code reçu/i), 'XYZ789')
    await userEvent.click(screen.getByRole('button', { name: /valider le code/i }))

    expect(onClaim).toHaveBeenCalledWith('XYZ789')
  })

  it('affiche un message d\'erreur générique si onClaim échoue', async () => {
    const onClaim = vi.fn().mockRejectedValue(new Error('Code invalide ou déjà utilisé.'))
    render(<LinkByCode role="student" onGenerate={vi.fn()} onClaim={onClaim} />)

    await userEvent.type(screen.getByLabelText(/code reçu/i), 'BADCODE')
    await userEvent.click(screen.getByRole('button', { name: /valider le code/i }))

    expect(await screen.findByText(/code invalide/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- LinkByCode`
Expected: FAIL — `Cannot find module './LinkByCode.jsx'`

- [ ] **Step 3: Implémenter `LinkByCode.jsx`**

```jsx
// src/components/LinkByCode.jsx
import { useId, useState } from 'react'

export function LinkByCode({ role, onGenerate, onClaim }) {
  const [generatedCode, setGeneratedCode] = useState('')
  const [claimInput, setClaimInput] = useState('')
  const [error, setError] = useState('')
  const claimInputId = useId()

  async function handleGenerate() {
    const link = await onGenerate(role)
    setGeneratedCode(link.invite_code)
  }

  async function handleClaim() {
    setError('')
    try {
      await onClaim(claimInput)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="plai-card">
      <div className="mb-4">
        <button type="button" className="plai-btn" onClick={handleGenerate}>
          Générer un code
        </button>
        {generatedCode && (
          <p className="plai-help mt-2">
            Votre code : <strong>{generatedCode}</strong> — transmettez-le à l'autre personne.
          </p>
        )}
      </div>

      <div className="plai-field">
        <label htmlFor={claimInputId} className="plai-label">
          Code reçu
        </label>
        <input
          id={claimInputId}
          className="plai-input"
          placeholder="ex : ABC123"
          value={claimInput}
          onChange={(e) => setClaimInput(e.target.value)}
        />
        <p className="plai-help">Saisissez ici le code transmis par l'enseignant ou l'élève.</p>
      </div>

      {error && <p className="plai-error">{error}</p>}

      <button type="button" className="plai-btn" onClick={handleClaim}>
        Valider le code
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- LinkByCode`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/LinkByCode.jsx src/components/LinkByCode.test.jsx
git commit -m "feat: LinkByCode bidirectional component"
```

---

### Task 9: `TeacherRoster` — élèves liés et verrouillage de contexte

**Files:**
- Create: `src/components/TeacherRoster.jsx`
- Create: `src/components/TeacherRoster.test.jsx`

- [ ] **Step 1: Écrire le test qui échoue**

```jsx
// src/components/TeacherRoster.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TeacherRoster } from './TeacherRoster.jsx'

const LINKS = [
  { id: 'link-1', student_id: 'student-1', teacher_id: 'teacher-1', status: 'linked' },
  { id: 'link-2', student_id: 'student-2', teacher_id: 'teacher-1', status: 'linked' },
]

describe('TeacherRoster', () => {
  it('affiche un élément par élève lié', () => {
    render(<TeacherRoster links={LINKS} onSelectStudent={vi.fn()} />)
    expect(screen.getAllByTestId('roster-item')).toHaveLength(2)
  })

  it('déclenche onSelectStudent avec le student_id au clic', async () => {
    const onSelectStudent = vi.fn()
    render(<TeacherRoster links={LINKS} onSelectStudent={onSelectStudent} />)

    await userEvent.click(screen.getAllByTestId('roster-item')[0])

    expect(onSelectStudent).toHaveBeenCalledWith('student-1')
  })

  it('affiche un état vide si aucun élève n\'est lié', () => {
    render(<TeacherRoster links={[]} onSelectStudent={vi.fn()} />)
    expect(screen.getByText(/aucun élève lié/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- TeacherRoster`
Expected: FAIL — `Cannot find module './TeacherRoster.jsx'`

- [ ] **Step 3: Implémenter `TeacherRoster.jsx`**

```jsx
// src/components/TeacherRoster.jsx
export function TeacherRoster({ links, onSelectStudent }) {
  return (
    <div className="plai-section">
      <h2>Mes élèves liés</h2>

      {links.length === 0 && <p className="plai-empty">Aucun élève lié pour l'instant.</p>}

      <ul>
        {links.map((link) => (
          <li
            key={link.id}
            data-testid="roster-item"
            className="plai-card mb-2"
            role="button"
            tabIndex={0}
            onClick={() => onSelectStudent(link.student_id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelectStudent(link.student_id)
            }}
          >
            Élève {link.student_id.slice(0, 8)}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

Note : `TeacherRoster` ne connaît pas les vrais noms des élèves (codes anonymes, conformément à la règle absolue PLAI — pas de nom d'élève stocké). L'affichage utilise un extrait de l'id technique le temps du MVP ; un futur ajout (hors Plan 2) pourrait permettre à l'élève de choisir un code lisible partagé avec l'enseignant lors de la liaison.

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- TeacherRoster`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/TeacherRoster.jsx src/components/TeacherRoster.test.jsx
git commit -m "feat: TeacherRoster component (linked students list)"
```

---

### Task 10: `StoreContext` — choix Local/Supabase

**Files:**
- Modify: `src/context/StoreContext.jsx`
- Modify: `src/context/StoreContext.test.jsx`

- [ ] **Step 1: Ajouter le test du mode compte**

```jsx
// ajout dans StoreContext.test.jsx, après le test existant

import { vi } from 'vitest'

vi.mock('../lib/supabaseClient.js', () => ({
  supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) } },
}))

describe('StoreProvider — mode compte', () => {
  it('fournit une instance SupabaseStore quand storageMode="account"', async () => {
    render(
      <StoreProvider dbName="focusactif-storecontext-test-2" storageMode="account">
        <Probe />
      </StoreProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('ready'))
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- StoreContext`
Expected: FAIL — `StoreProvider` ignore actuellement `storageMode` et charge toujours `LocalStore`, donc ce test précis passerait déjà par accident (un `LocalStore` est aussi "ready"). Vérifier plutôt l'échec réel en ajoutant temporairement une assertion sur le type retourné n'est pas nécessaire ici : la vraie preuve de fonctionnement vient du Task 11 (câblage `App.jsx`) où le choix `StorageSetup` détermine effectivement quel store est utilisé de bout en bout. Ce test-ci sert de garde-fou unitaire minimal ; passer à l'étape 3 directement.

- [ ] **Step 3: Modifier `StoreContext.jsx` pour choisir l'implémentation**

```jsx
// src/context/StoreContext.jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { createLocalStore } from '../lib/localStore.js'

const StoreContext = createContext(null)

export function StoreProvider({ children, dbName = 'focusactif', storageMode = 'local' }) {
  const [store, setStore] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      if (storageMode === 'account') {
        const { supabase } = await import('../lib/supabaseClient.js')
        const { createSupabaseStore } = await import('../lib/supabaseStore.js')
        if (!cancelled) setStore(createSupabaseStore(supabase))
      } else {
        const instance = await createLocalStore(dbName)
        if (!cancelled) setStore(instance)
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [dbName, storageMode])

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useTaskStore() {
  return useContext(StoreContext)
}
```

Le chargement dynamique (`import('../lib/supabaseClient.js')`) n'exécute `createClient` (qui lève une exception si les variables d'environnement sont absentes, cf. Task 2) que si `storageMode === 'account'` — le mode local reste utilisable même sur un poste sans configuration Supabase.

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- StoreContext`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/context/StoreContext.jsx src/context/StoreContext.test.jsx
git commit -m "feat: StoreContext selects LocalStore or SupabaseStore based on storageMode"
```

---

### Task 11: Câblage `App.jsx` — StorageSetup → Auth → app

**Files:**
- Modify: `src/App.jsx`
- Create: `src/App.account.test.jsx`

- [ ] **Step 1: Écrire le test qui échoue (parcours mode compte, mocké)**

```jsx
// src/App.account.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import App from './App.jsx'

const mockStore = {
  listContexts: vi.fn().mockResolvedValue([]),
  addContext: vi.fn().mockResolvedValue({ id: 'c1', label: 'Devoirs', emoji: '📚', locked: false }),
  getNextTask: vi.fn().mockResolvedValue(null),
}

vi.mock('../lib/supabaseClient.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  },
}))

vi.mock('../lib/supabaseStore.js', () => ({
  createSupabaseStore: () => mockStore,
}))

describe('App — choix du mode de stockage', () => {
  it('affiche StorageSetup en premier, puis Auth si "compte" est choisi', async () => {
    render(<App />)

    expect(await screen.findByText(/comment voulez-vous utiliser/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /créer un compte|se connecter/i }))

    expect(await screen.findByLabelText(/adresse e-mail/i)).toBeInTheDocument()
  })

  it('affiche ContextPicker directement si "sans compte" est choisi', async () => {
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: /sans compte/i }))

    expect(await screen.findByLabelText(/nom du contexte/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- App.account`
Expected: FAIL — `App.jsx` actuel saute directement à `ContextPicker`, aucun écran `StorageSetup`/`Auth` n'existe dans le parcours.

- [ ] **Step 3: Modifier `App.jsx`**

```jsx
// src/App.jsx
import { useCallback, useEffect, useState } from 'react'
import { StoreProvider, useTaskStore } from './context/StoreContext.jsx'
import { StorageSetup } from './components/StorageSetup.jsx'
import { Auth } from './components/Auth.jsx'
import { ContextPicker } from './components/ContextPicker.jsx'
import { TaskDashboard } from './components/TaskDashboard.jsx'
import { QuickCapture } from './components/QuickCapture.jsx'
import { DecomposeSheet } from './components/DecomposeSheet.jsx'

function AppInner({ storageMode, onAuthed }) {
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
    if (!store) return
    let cancelled = false
    store.listContexts().then((result) => {
      if (!cancelled) setContexts(result)
    })
    return () => {
      cancelled = true
    }
  }, [store])

  useEffect(() => {
    if (!store || !activeContextId) return
    let cancelled = false
    store.getNextTask(activeContextId).then((result) => {
      if (!cancelled) setCurrentTask(result)
    })
    return () => {
      cancelled = true
    }
  }, [store, activeContextId])

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
    return (
      <DecomposeSheet
        parentTitle={currentTask?.title ?? ''}
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
  const [storageMode, setStorageMode] = useState(null)
  const [authed, setAuthed] = useState(false)

  if (!storageMode) {
    return (
      <StorageSetup
        onChooseLocal={() => setStorageMode('local')}
        onChooseAccount={() => setStorageMode('account')}
      />
    )
  }

  if (storageMode === 'account' && !authed) {
    return (
      <Auth
        onSignIn={async (email, password) => {
          const { supabase } = await import('./lib/supabaseClient.js')
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) throw error
          setAuthed(true)
        }}
        onSignUp={async (email, password) => {
          const { supabase } = await import('./lib/supabaseClient.js')
          const { error } = await supabase.auth.signUp({ email, password })
          if (error) throw error
          setAuthed(true)
        }}
      />
    )
  }

  return (
    <StoreProvider storageMode={storageMode}>
      <AppInner storageMode={storageMode} />
    </StoreProvider>
  )
}

export default App
```

Note : `handleCreateContext`/`refreshContexts` restent identiques au Plan 1 — `AppInner` ne sait pas si `store` est un `LocalStore` ou un `SupabaseStore`, exactement le bénéfice recherché par le contrat `TaskStore` commun.

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- App.account`
Expected: PASS (2 tests)

- [ ] **Step 5: Lancer toute la suite (hors intégration)**

Run: `npm test`
Expected: PASS — tous les tests, y compris `App.test.jsx` du Plan 1 (parcours mode local, doit continuer à fonctionner puisque `App.jsx` passe maintenant par `StorageSetup` → il faudra vérifier si `App.test.jsx` (Plan 1) a besoin d'un clic supplémentaire sur "Continuer sans compte" avant de commencer son propre parcours — l'ajuster si besoin, SANS changer les assertions sur le parcours local lui-même, seulement ajouter l'étape de choix initiale.

- [ ] **Step 6: Ajuster `App.test.jsx` (Plan 1) si nécessaire**

Si l'étape 5 échoue sur `App.test.jsx`, ajouter au tout début du test (avant "Créer un contexte") :

```jsx
    await userEvent.click(await screen.findByRole('button', { name: /sans compte/i }))
```

- [ ] **Step 7: Vérifier le build**

Run: `npm run build`
Expected: build réussi, 0 erreur.

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx src/App.account.test.jsx src/App.test.jsx
git commit -m "feat: wire StorageSetup and Auth into App.jsx entry flow"
```

---

### Task 12: Faire respecter `locked` côté UI (l'élève ne modifie pas un contexte verrouillé)

**Files:**
- Modify: `src/components/TaskDashboard.jsx`
- Modify: `src/components/TaskDashboard.test.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Ajouter le test qui échoue**

```jsx
// ajout dans TaskDashboard.test.jsx

  it('masque les actions de capture/décomposition si le contexte est verrouillé', () => {
    const task = { id: 't1', title: 'Choisir le sujet', status: 'todo', parentTaskId: null }
    render(
      <TaskDashboard
        task={task}
        contextLocked
        onComplete={vi.fn()}
        onDecompose={vi.fn()}
        onOpenCapture={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: /décomposer/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ajouter une tâche/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /fait/i })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm test -- TaskDashboard`
Expected: FAIL — `TaskDashboard` n'accepte pas encore de prop `contextLocked`, les deux boutons restent affichés.

- [ ] **Step 3: Modifier `TaskDashboard.jsx`**

```jsx
// src/components/TaskDashboard.jsx
export function TaskDashboard({ task, contextLocked = false, onComplete, onDecompose, onOpenCapture }) {
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
      {!contextLocked && (
        <button type="button" className="plai-btn mt-6" onClick={onOpenCapture}>
          + Ajouter une tâche
        </button>
      )}
    </div>
  )
}
```

Note : le garde `!task.parentTaskId` (Plan 1, Task 10 follow-up) et le nouveau garde `!contextLocked` se combinent — les deux raisons de masquer "Décomposer" sont indépendantes et doivent toutes les deux être satisfaites pour l'afficher.

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npm test -- TaskDashboard`
Expected: PASS (5 tests : les 4 du Plan 1 + celui-ci)

- [ ] **Step 5: Câbler `contextLocked` dans `App.jsx`**

Dans `AppInner`, `TaskDashboard` est actuellement invoqué sans `contextLocked`. Modifier l'appel pour le déduire du contexte actif :

```jsx
// remplacer, dans AppInner, le rendu final de TaskDashboard :
  const activeContext = contexts.find((c) => c.id === activeContextId)

  return (
    <TaskDashboard
      task={currentTask}
      contextLocked={Boolean(activeContext?.locked)}
      onComplete={handleComplete}
      onDecompose={setDecomposing}
      onOpenCapture={() => setCapturing(true)}
    />
  )
```

(Ajouter la ligne `const activeContext = ...` juste avant ce `return`, à l'intérieur de `AppInner`.)

- [ ] **Step 6: Lancer toute la suite**

Run: `npm test`
Expected: PASS — tous les tests (Plan 1 + Plan 2).

- [ ] **Step 7: Vérifier le build**

Run: `npm run build`
Expected: build réussi, 0 erreur.

- [ ] **Step 8: Commit**

```bash
git add src/components/TaskDashboard.jsx src/components/TaskDashboard.test.jsx src/App.jsx
git commit -m "feat: enforce locked contexts in TaskDashboard UI"
```

---

## Vérification manuelle finale (avant de considérer le Plan 2 terminé)

- [ ] Créer deux comptes réels (un "enseignant", un "élève") sur le projet Supabase de développement.
- [ ] Depuis le compte élève : générer un code de liaison, choisir le mode compte, vérifier la persistance entre rafraîchissements de page.
- [ ] Depuis le compte enseignant : saisir ce code, vérifier l'apparition de l'élève dans `TeacherRoster`.
- [ ] Créer un contexte verrouillé pour l'élève depuis le compte enseignant, vérifier dans Supabase (Table Editor) que `locked_by` est bien l'id enseignant.
- [ ] Se reconnecter avec le compte élève, vérifier que le contexte verrouillé apparaît mais qu'aucun bouton de capture/décomposition n'y est proposé (Task 12 doit garantir ce comportement).
- [ ] Vérifier RLS croisée : tenter (via un second onglet/compte non lié) d'accéder aux contextes de l'élève — doit échouer silencieusement (liste vide), jamais d'erreur qui fuite des données.
