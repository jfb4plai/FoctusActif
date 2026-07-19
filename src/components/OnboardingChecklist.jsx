export function OnboardingChecklist({ contextDone, taskDone }) {
  return (
    <div className="plai-card mb-4" role="status">
      <p className="plai-help mb-2">Mise en route :</p>
      <ul className="flex flex-col gap-1">
        <li>{contextDone ? '✓' : '○'} Créer un premier contexte</li>
        <li>{taskDone ? '✓' : '○'} Ajouter une première tâche</li>
      </ul>
    </div>
  )
}
