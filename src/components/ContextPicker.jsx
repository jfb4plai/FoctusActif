import { useId, useState } from 'react'

const DEFAULT_EMOJI = '📌'

export function ContextPicker({ contexts, onSelect, onCreate }) {
  const [label, setLabel] = useState('')
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

      {contexts.length === 0 && (
        <p className="plai-empty">Aucun contexte pour l'instant. Créez-en un pour commencer.</p>
      )}

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

      <div className="flex gap-2 items-end">
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
        <button type="button" className="plai-btn" onClick={handleCreate}>
          Créer
        </button>
      </div>
    </div>
  )
}
