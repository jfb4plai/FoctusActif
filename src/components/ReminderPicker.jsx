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

function presetInMinutes(minutes) {
  return new Date(Date.now() + minutes * 60000)
}

function presetTonight() {
  const target = new Date()
  target.setHours(18, 0, 0, 0)
  if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1)
  return target
}

function presetTomorrowMorning() {
  const target = new Date(Date.now() + 24 * 3600000)
  target.setHours(8, 0, 0, 0)
  return target
}

export function ReminderPicker({ remindAt, onSetReminder, onClearReminder }) {
  const [value, setValue] = useState('')
  const inputId = useId()

  function handleSet() {
    if (!value) return
    onSetReminder(new Date(value).toISOString())
    setValue('')
  }

  function handlePreset(compute) {
    onSetReminder(compute().toISOString())
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
      <div className="flex flex-wrap gap-2 mb-2">
        <button
          type="button"
          className="plai-btn-ghost"
          onClick={() => handlePreset(() => presetInMinutes(15))}
        >
          +15 min
        </button>
        <button
          type="button"
          className="plai-btn-ghost"
          onClick={() => handlePreset(() => presetInMinutes(30))}
        >
          +30 min
        </button>
        <button type="button" className="plai-btn-ghost" onClick={() => handlePreset(presetTonight)}>
          Ce soir (18h)
        </button>
        <button
          type="button"
          className="plai-btn-ghost"
          onClick={() => handlePreset(presetTomorrowMorning)}
        >
          Demain matin (8h)
        </button>
      </div>
      <p className="plai-help mb-2">Ou choisissez une date et une heure précises :</p>
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
