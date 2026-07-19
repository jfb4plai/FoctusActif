import { useId, useState } from 'react'

export function ReminderPicker({ remindAt, onSetReminder, onClearReminder }) {
  const [value, setValue] = useState('')
  const inputId = useId()

  function handleSet() {
    if (!value) return
    onSetReminder(new Date(value).toISOString())
    setValue('')
  }

  if (remindAt) {
    const formatted = new Date(remindAt).toLocaleString('fr-BE', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
    return (
      <div className="plai-field">
        <p className="plai-help">Rappel prévu : {formatted}</p>
        <button type="button" className="plai-btn-ghost" onClick={onClearReminder}>
          Retirer le rappel
        </button>
      </div>
    )
  }

  return (
    <div className="plai-field">
      <label htmlFor={inputId} className="plai-label">
        Me le rappeler à
      </label>
      <input
        id={inputId}
        type="datetime-local"
        className="plai-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <p className="plai-help">
        Optionnel — un rappel doux (vibration, jamais de son) à l'heure choisie.
      </p>
      <button type="button" className="plai-btn-ghost mt-2" onClick={handleSet} disabled={!value}>
        Programmer le rappel
      </button>
    </div>
  )
}
