import { QuickCapture } from './QuickCapture.jsx'

export function DecomposeSheet({ parentTitle, subtasks, onAddSubtask, onClose }) {
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
          <li key={subtask.id} data-testid="subtask-item" className="plai-card mb-2">
            {subtask.title}
          </li>
        ))}
      </ul>

      <QuickCapture onAdd={onAddSubtask} placeholder="ex : Choisir le sujet" />
    </div>
  )
}
