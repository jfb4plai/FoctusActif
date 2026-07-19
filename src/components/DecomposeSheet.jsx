import { useId, useState } from 'react'
import { QuickCapture } from './QuickCapture.jsx'

function SubtaskRow({ subtask, onRenameSubtask, onDeleteSubtask }) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [draft, setDraft] = useState(subtask.title)
  const inputId = useId()

  function handleSave() {
    const trimmed = draft.trim()
    if (trimmed) onRenameSubtask(subtask.id, trimmed)
    setEditing(false)
  }

  if (confirmingDelete) {
    return (
      <li data-testid="subtask-item" className="plai-card mb-2">
        <p className="plai-error mb-3">
          Supprimer « {subtask.title} » ? Cette action est définitive.
        </p>
        <div className="flex gap-2">
          <button type="button" className="plai-btn" onClick={() => onDeleteSubtask(subtask.id)}>
            Oui, supprimer
          </button>
          <button
            type="button"
            className="plai-btn-ghost"
            onClick={() => setConfirmingDelete(false)}
          >
            Ne pas supprimer
          </button>
        </div>
      </li>
    )
  }

  if (editing) {
    return (
      <li data-testid="subtask-item" className="plai-card mb-2">
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
        <div className="flex gap-2 mt-2">
          <button type="button" className="plai-btn" onClick={handleSave}>
            Enregistrer
          </button>
          <button type="button" className="plai-btn-ghost" onClick={() => setConfirmingDelete(true)}>
            Supprimer
          </button>
          <button type="button" className="plai-btn-ghost" onClick={() => setEditing(false)}>
            Fermer
          </button>
        </div>
      </li>
    )
  }

  return (
    <li
      data-testid="subtask-item"
      className={`plai-card mb-2 flex items-center justify-between ${subtask.status === 'done' ? 'line-through opacity-50' : ''}`}
    >
      <span data-testid="subtask-title">{subtask.title}</span>
      {onRenameSubtask && onDeleteSubtask && (
        <button type="button" className="plai-btn-ghost" onClick={() => setEditing(true)}>
          Modifier
        </button>
      )}
    </li>
  )
}

export function DecomposeSheet({
  parentTitle,
  subtasks,
  onAddSubtask,
  onClose,
  onRenameSubtask,
  onDeleteSubtask,
}) {
  return (
    <div className="plai-section">
      <div className="flex justify-between items-center mb-4">
        <h2>Décomposer : {parentTitle}</h2>
        <button type="button" className="plai-btn" onClick={onClose}>
          Fermer
        </button>
      </div>

      <ul className="mb-4">
        {subtasks.map((subtask) => (
          <SubtaskRow
            key={subtask.id}
            subtask={subtask}
            onRenameSubtask={onRenameSubtask}
            onDeleteSubtask={onDeleteSubtask}
          />
        ))}
      </ul>

      <QuickCapture onAdd={onAddSubtask} placeholder="ex : Choisir le sujet" />
    </div>
  )
}
