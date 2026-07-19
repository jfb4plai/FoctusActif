import { useId, useState } from 'react'

function formatRelative(remindAt) {
  const diffMs = new Date(remindAt).getTime() - Date.now()
  if (diffMs <= 0) return null

  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return "dans moins d'une minute"
  if (minutes < 60) return `dans ${minutes} minute${minutes > 1 ? 's' : ''}`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `dans ${hours} heure${hours > 1 ? 's' : ''}`

  const days = Math.round(hours / 24)
  return `dans ${days} jour${days > 1 ? 's' : ''}`
}

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
    const relative = formatRelative(remindAt)
    return (
      <div className="plai-field">
        <p className="plai-help">
          Rappel prévu : {formatted}
          {relative && ` (${relative})`}
        </p>
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
