import { useId, useState } from 'react'
import { OnboardingChecklist } from './OnboardingChecklist.jsx'

const DEFAULT_EMOJI = '📌'

function ManageContextRow({ context, onRename, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [draft, setDraft] = useState(context.label)
  const inputId = useId()

  function handleSave() {
    const trimmed = draft.trim()
    if (trimmed) onRename(context.id, trimmed)
    setEditing(false)
  }

  if (confirmingDelete) {
    return (
      <div className="plai-card">
        <p className="plai-error mb-3">
          Supprimer « {context.label} » et toutes ses tâches ? Cette action est définitive.
        </p>
        <div className="flex gap-2">
          <button type="button" className="plai-btn" onClick={() => onDelete(context.id)}>
            Oui, supprimer
          </button>
          <button
            type="button"
            className="plai-btn-ghost"
            onClick={() => setConfirmingDelete(false)}
          >
            Annuler
          </button>
        </div>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="plai-card">
        <div className="plai-field">
          <label htmlFor={inputId} className="plai-label">
            Nouveau nom pour « {context.label} »
          </label>
          <input
            id={inputId}
            className="plai-input w-full"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
        <div className="flex gap-2 mt-2">
          <button type="button" className="plai-btn" onClick={handleSave}>
            Enregistrer
          </button>
          <button type="button" className="plai-btn-ghost" onClick={() => setEditing(false)}>
            Annuler
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="plai-card flex items-center justify-between">
      <span>
        <span className="text-2xl mr-2">{context.emoji}</span>
        {context.label}
      </span>
      <div className="flex gap-2">
        <button type="button" className="plai-btn-ghost" onClick={() => setEditing(true)}>
          Renommer
        </button>
        <button type="button" className="plai-btn-ghost" onClick={() => setConfirmingDelete(true)}>
          Supprimer
        </button>
      </div>
    </div>
  )
}

export function ContextPicker({
  contexts,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  showOnboarding = false,
  pictosEnabled = false,
  onTogglePictos,
}) {
  const [label, setLabel] = useState('')
  const [managing, setManaging] = useState(false)
  const inputId = useId()

  function handleCreate() {
    const trimmed = label.trim()
    if (!trimmed) return
    onCreate(trimmed, DEFAULT_EMOJI)
    setLabel('')
  }

  return (
    <div className="plai-section">
      <h2>Mes contextes</h2>

      {showOnboarding && (
        <OnboardingChecklist contextDone={contexts.length > 0} taskDone={false} />
      )}

      {contexts.length === 0 && (
        <p className="plai-empty">Aucun contexte pour l'instant. Créez-en un pour commencer.</p>
      )}

      {contexts.length > 0 && !managing && (
        <p className="plai-help mb-3">Touchez un contexte pour l'ouvrir et voir ses tâches.</p>
      )}

      {managing ? (
        <div className="mb-6">
          <button type="button" className="plai-btn-ghost mb-3" onClick={() => setManaging(false)}>
            Terminé
          </button>
          <div className="flex flex-col gap-2">
            {contexts.map((context) => (
              <ManageContextRow
                key={context.id}
                context={context}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ) : (
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
      )}

      {contexts.length > 0 && !managing && (
        <button type="button" className="plai-btn-ghost mb-6" onClick={() => setManaging(true)}>
          Gérer mes contextes
        </button>
      )}

      {!managing && (
        <div className="flex gap-2">
          <div className="plai-field flex-1">
            <label htmlFor={inputId} className="plai-label">
              Nom du contexte
            </label>
            <input
              id={inputId}
              className="plai-input w-full"
              placeholder="ex : Devoirs du soir"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <p className="plai-help">
              Ce nom identifie un domaine de vie (école, maison, devoirs...) pour regrouper les tâches qui s'y rapportent.
            </p>
          </div>
          <button type="button" className="plai-btn mt-7" onClick={handleCreate}>
            Créer
          </button>
        </div>
      )}

      {!managing && (
        <div className="plai-field mt-4">
          <button type="button" className="plai-btn-ghost" onClick={onTogglePictos}>
            {pictosEnabled ? 'Désactiver les pictogrammes' : 'Activer les pictogrammes'}
          </button>
          <p className="plai-help">
            Ajoute une image à côté du titre de chaque tâche pour aider à comprendre d'un coup
            d'œil. Optionnel, à activer seulement si ça vous aide.
          </p>
        </div>
      )}
    </div>
  )
}
