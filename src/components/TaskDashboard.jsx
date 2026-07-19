import { useId, useState } from 'react'
import { ReminderPicker } from './ReminderPicker.jsx'
import { OnboardingChecklist } from './OnboardingChecklist.jsx'

function EditTask({ task, onRenameTask, onDeleteTask, onDone }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const inputId = useId()

  function handleSave() {
    const trimmed = draft.trim()
    if (trimmed) onRenameTask(task.id, trimmed)
    onDone()
  }

  if (confirmingDelete) {
    return (
      <div className="plai-card mb-4">
        <p className="plai-error mb-3">
          Supprimer « {task.title} » ? Cette action est définitive.
        </p>
        <div className="flex justify-center gap-2">
          <button type="button" className="plai-btn" onClick={() => onDeleteTask(task.id)}>
            Oui, supprimer
          </button>
          <button type="button" className="plai-btn-ghost" onClick={() => setConfirmingDelete(false)}>
            Annuler
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="plai-card mb-4">
      <div className="plai-field">
        <label htmlFor={inputId} className="plai-label">
          Nouveau titre
        </label>
        <input
          id={inputId}
          className="plai-input w-full"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>
      <div className="flex justify-center gap-2 mt-2">
        <button type="button" className="plai-btn" onClick={handleSave}>
          Enregistrer
        </button>
        <button type="button" className="plai-btn-ghost" onClick={() => setConfirmingDelete(true)}>
          Supprimer
        </button>
        <button type="button" className="plai-btn-ghost" onClick={onDone}>
          Annuler
        </button>
      </div>
    </div>
  )
}

export function TaskDashboard({
  task,
  contextLabel,
  contextEmoji,
  contextLocked = false,
  onComplete,
  onDecompose,
  onOpenCapture,
  onSetReminder,
  onClearReminder,
  onRenameTask,
  onDeleteTask,
  showOnboarding = false,
}) {
  const [editingTask, setEditingTask] = useState(false)

  const contextReminder = contextLabel && (
    <p className="plai-help mb-4">
      Contexte actuel : {contextEmoji} {contextLabel}
    </p>
  )

  if (!task) {
    return (
      <div className="plai-section">
        {contextReminder}
        {showOnboarding && <OnboardingChecklist contextDone taskDone={false} />}
        <p className="plai-empty">Aucune tâche ici pour l'instant.</p>
        <p className="plai-help mb-4">
          Une tâche, c'est une chose à faire, comme « Ranger mon sac » ou « Faire mes devoirs de
          maths ». Cliquez sur le bouton ci-dessous pour en ajouter une.
        </p>
        {!contextLocked && (
          <button type="button" className="plai-btn mt-4" onClick={onOpenCapture}>
            + Ajouter une tâche
          </button>
        )}
      </div>
    )
  }

  if (editingTask) {
    return (
      <div className="plai-section">
        {contextReminder}
        <EditTask
          task={task}
          onRenameTask={onRenameTask}
          onDeleteTask={onDeleteTask}
          onDone={() => setEditingTask(false)}
        />
      </div>
    )
  }

  return (
    <div className="plai-section">
      {contextReminder}
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
        <p className="plai-help mt-4">
          « Fait » marque cette tâche comme terminée.
          {!contextLocked && !task.parentTaskId &&
            ' « Décomposer » permet de la diviser en plusieurs petites étapes à faire une par une, par exemple « Faire l\'exposé » → « Choisir le sujet », « Chercher des infos », « Rédiger ».'}
        </p>
        {!contextLocked && (
          <button
            type="button"
            className="plai-btn-ghost mt-4"
            onClick={() => setEditingTask(true)}
          >
            Modifier cette tâche
          </button>
        )}
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
