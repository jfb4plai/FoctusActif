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
            ' « Décomposer » permet de la diviser en plusieurs petites étapes à faire une par une.'}
        </p>
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
