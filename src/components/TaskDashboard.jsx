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
          {!task.parentTaskId && (
            <button type="button" className="plai-btn" onClick={() => onDecompose(task.id)}>
              Décomposer
            </button>
          )}
        </div>
      </div>
      <button type="button" className="plai-btn mt-6" onClick={onOpenCapture}>
        + Ajouter une tâche
      </button>
    </div>
  )
}
