import { ReminderPicker } from './ReminderPicker.jsx'

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
}) {
  const contextReminder = contextLabel && (
    <p className="plai-help mb-4">
      Contexte actuel : {contextEmoji} {contextLabel}
    </p>
  )

  if (!task) {
    return (
      <div className="plai-section">
        {contextReminder}
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
