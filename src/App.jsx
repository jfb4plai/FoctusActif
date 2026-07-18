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
