import { useCallback, useEffect, useState } from 'react'
import { StoreProvider, useTaskStore } from './context/StoreContext.jsx'
import { StorageSetup } from './components/StorageSetup.jsx'
import { Auth } from './components/Auth.jsx'
import { ContextPicker } from './components/ContextPicker.jsx'
import { TaskDashboard } from './components/TaskDashboard.jsx'
import { QuickCapture } from './components/QuickCapture.jsx'
import { DecomposeSheet } from './components/DecomposeSheet.jsx'
import { useReminderWatcher } from './lib/useReminderWatcher.js'

function AppInner({ storageMode }) {
  const store = useTaskStore()
  const [contexts, setContexts] = useState([])
  const [activeContextId, setActiveContextId] = useState(null)
  const [currentTask, setCurrentTask] = useState(null)
  const [capturing, setCapturing] = useState(false)
  const [decomposing, setDecomposing] = useState(null)
  const [subtasks, setSubtasks] = useState([])
  const [justCompleted, setJustCompleted] = useState(null)
  const [onboardingDone, setOnboardingDone] = useState(
    () => localStorage.getItem('focusactif_onboarding_done') === '1',
  )
  const [pushPromptDismissed, setPushPromptDismissed] = useState(false)

  const showPushPrompt =
    storageMode === 'account' &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'default' &&
    !pushPromptDismissed

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

  const reminderDue = useReminderWatcher(store, currentTask)

  if (!store) return null

  async function handleCreateContext(label, emoji) {
    await store.addContext(label, emoji)
    await refreshContexts()
  }

  async function handleRenameContext(contextId, newLabel) {
    await store.renameContext(contextId, newLabel)
    await refreshContexts()
  }

  async function handleDeleteContext(contextId) {
    await store.deleteContext(contextId)
    await refreshContexts()
  }

  async function handleAddRootTask(title) {
    await store.addTask(activeContextId, title)
    setCapturing(false)
    await refreshCurrentTask()
    if (!onboardingDone) {
      localStorage.setItem('focusactif_onboarding_done', '1')
      setOnboardingDone(true)
    }
  }

  async function handleComplete(taskId) {
    const title = currentTask?.title ?? ''
    await store.completeTask(taskId)
    await refreshCurrentTask()
    setJustCompleted({ id: taskId, title })
  }

  async function handleUndoComplete() {
    if (!justCompleted) return
    await store.uncompleteTask(justCompleted.id)
    await refreshCurrentTask()
    setJustCompleted(null)
  }

  async function handleRenameTask(taskId, newTitle) {
    await store.renameTask(taskId, newTitle)
    await refreshCurrentTask()
  }

  async function handleDeleteTask(taskId) {
    await store.deleteTask(taskId)
    setJustCompleted(null)
    await refreshCurrentTask()
  }

  async function handleSetReminder(taskId, remindAtIso) {
    await store.setReminder(taskId, remindAtIso)
    await refreshCurrentTask()
  }

  async function handleClearReminder(taskId) {
    await store.clearReminder(taskId)
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

  async function handleEnablePush() {
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (vapidKey) {
      const { supabase } = await import('./lib/supabaseClient.js')
      const { subscribeToPush } = await import('./lib/pushSubscription.js')
      await subscribeToPush(supabase, vapidKey)
    }
    setPushPromptDismissed(true)
  }

  const pushPrompt = showPushPrompt && (
    <div className="plai-card mb-4">
      <p className="mb-2">
        FocusActif peut vous envoyer un vrai rappel même quand l'application est fermée. Le
        navigateur va vous demander une autorisation.
      </p>
      <div className="flex gap-2">
        <button type="button" className="plai-btn" onClick={handleEnablePush}>
          Activer les notifications
        </button>
        <button
          type="button"
          className="plai-btn-ghost"
          onClick={() => setPushPromptDismissed(true)}
        >
          Plus tard
        </button>
      </div>
    </div>
  )

  if (!activeContextId) {
    return (
      <>
        {pushPrompt}
        <ContextPicker
          contexts={contexts}
          onSelect={setActiveContextId}
          onCreate={handleCreateContext}
          onRename={handleRenameContext}
          onDelete={handleDeleteContext}
          showOnboarding={!onboardingDone}
        />
      </>
    )
  }

  const activeContext = contexts.find((c) => c.id === activeContextId)

  if (decomposing) {
    // `currentTask` is the task that was on screen when "Décomposer" was clicked
    // (the parent being decomposed) and is not refreshed while this sheet is open,
    // so it stays stable as the parent's title even as `subtasks` changes.
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
        <div className="flex justify-between items-center mb-4">
          <h2>
            Ajouter une tâche — {activeContext?.emoji} {activeContext?.label}
          </h2>
          <button type="button" className="plai-btn-ghost" onClick={() => setCapturing(false)}>
            Annuler
          </button>
        </div>
        <QuickCapture onAdd={handleAddRootTask} />
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        className="plai-btn-ghost mb-3"
        onClick={() => {
          setActiveContextId(null)
          setJustCompleted(null)
        }}
      >
        ← Mes contextes
      </button>
      {justCompleted && (
        <p className="plai-success flex items-center justify-between gap-3" role="status">
          <span>« {justCompleted.title} » marqué comme fait.</span>
          <button type="button" className="plai-btn-ghost" onClick={handleUndoComplete}>
            ↩ Annuler
          </button>
        </p>
      )}
      {reminderDue && (
        <p className="plai-success" role="status">
          Rappel : c'est le moment pour « {currentTask?.title} ».
        </p>
      )}
      <TaskDashboard
        task={currentTask}
        contextLabel={activeContext?.label}
        contextEmoji={activeContext?.emoji}
        contextLocked={Boolean(activeContext?.locked)}
        onComplete={handleComplete}
        onDecompose={(taskId) => {
          setDecomposing(taskId)
          setJustCompleted(null)
        }}
        onOpenCapture={() => {
          setCapturing(true)
          setJustCompleted(null)
        }}
        onSetReminder={handleSetReminder}
        onClearReminder={handleClearReminder}
        onRenameTask={handleRenameTask}
        onDeleteTask={handleDeleteTask}
        showOnboarding={!onboardingDone}
      />
    </>
  )
}

function App() {
  const [storageMode, setStorageMode] = useState(null)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    if (storageMode !== 'account' || !authed) return
    if (!('serviceWorker' in navigator)) return

    // Enregistrement silencieux : ne déclenche aucune demande de permission.
    // L'activation des notifications elle-même passe par un clic explicite
    // de l'utilisateur (bannière "Activer les notifications" dans AppInner),
    // jamais automatiquement — un popup de permission surprise est
    // déroutant, en particulier pour un public TDAH/TSA.
    navigator.serviceWorker.register('/sw.js')
  }, [storageMode, authed])

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
          const { data, error } = await supabase.auth.signUp({ email, password })
          if (error) throw error
          if (data.session) {
            setAuthed(true)
            return { needsConfirmation: false }
          }
          // Supabase renvoie toujours une réponse "compte créé" pour ne pas révéler
          // si l'e-mail existe déjà (anti-énumération) — mais un tableau `identities`
          // vide est le signal documenté d'un compte déjà existant et confirmé,
          // pour lequel aucun e-mail n'est réellement envoyé.
          if (data.user?.identities?.length === 0) {
            return { alreadyExists: true }
          }
          return { needsConfirmation: true }
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
