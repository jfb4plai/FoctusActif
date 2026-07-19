import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ReminderPicker } from './ReminderPicker.jsx'

describe('ReminderPicker', () => {
  it('le bouton Programmer est désactivé tant qu\'aucune date n\'est saisie', () => {
    render(<ReminderPicker remindAt={null} onSetReminder={vi.fn()} onClearReminder={vi.fn()} />)
    expect(screen.getByRole('button', { name: /programmer/i })).toBeDisabled()
  })

  it('déclenche onSetReminder avec une date ISO au clic', async () => {
    const onSetReminder = vi.fn()
    render(<ReminderPicker remindAt={null} onSetReminder={onSetReminder} onClearReminder={vi.fn()} />)

    const input = screen.getByLabelText(/me le rappeler à/i)
    await userEvent.type(input, '2026-08-01T09:00')
    await userEvent.click(screen.getByRole('button', { name: /programmer/i }))

    expect(onSetReminder).toHaveBeenCalledWith(new Date('2026-08-01T09:00').toISOString())
  })

  it('affiche le rappel programmé et déclenche onClearReminder', async () => {
    const onClearReminder = vi.fn()
    const remindAt = new Date('2026-08-01T09:00').toISOString()
    render(<ReminderPicker remindAt={remindAt} onSetReminder={vi.fn()} onClearReminder={onClearReminder} />)

    expect(screen.getByText(/rappel prévu/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /retirer le rappel/i }))
    expect(onClearReminder).toHaveBeenCalled()
  })

  it('affiche un temps relatif quand le rappel est dans quelques minutes', () => {
    const remindAt = new Date(Date.now() + 5 * 60000).toISOString()
    render(<ReminderPicker remindAt={remindAt} onSetReminder={vi.fn()} onClearReminder={vi.fn()} />)
    expect(screen.getByText(/dans \d+ minutes?/i)).toBeInTheDocument()
  })

  it('affiche un temps relatif en heures quand le rappel est le jour même', () => {
    const remindAt = new Date(Date.now() + 3 * 3600000).toISOString()
    render(<ReminderPicker remindAt={remindAt} onSetReminder={vi.fn()} onClearReminder={vi.fn()} />)
    expect(screen.getByText(/dans \d+ heures?/i)).toBeInTheDocument()
  })

  it('propose des raccourcis de rappel rapide', () => {
    render(<ReminderPicker remindAt={null} onSetReminder={vi.fn()} onClearReminder={vi.fn()} />)
    expect(screen.getByRole('button', { name: /\+15 min/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\+30 min/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ce soir/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /demain matin/i })).toBeInTheDocument()
  })

  it('le raccourci +15 min déclenche onSetReminder ~15 minutes dans le futur', async () => {
    const onSetReminder = vi.fn()
    render(<ReminderPicker remindAt={null} onSetReminder={onSetReminder} onClearReminder={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /\+15 min/i }))

    expect(onSetReminder).toHaveBeenCalledTimes(1)
    const iso = onSetReminder.mock.calls[0][0]
    const diffMinutes = (new Date(iso).getTime() - Date.now()) / 60000
    expect(diffMinutes).toBeGreaterThan(14)
    expect(diffMinutes).toBeLessThan(16)
  })

  it('le raccourci "Demain matin" programme un rappel le lendemain à 8h', async () => {
    const onSetReminder = vi.fn()
    render(<ReminderPicker remindAt={null} onSetReminder={onSetReminder} onClearReminder={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /demain matin/i }))

    const iso = onSetReminder.mock.calls[0][0]
    const target = new Date(iso)
    const tomorrow = new Date(Date.now() + 24 * 3600000)
    expect(target.getDate()).toBe(tomorrow.getDate())
    expect(target.getHours()).toBe(8)
    expect(target.getMinutes()).toBe(0)
  })

  it('le raccourci "Ce soir" programme un rappel à 18h', async () => {
    const onSetReminder = vi.fn()
    render(<ReminderPicker remindAt={null} onSetReminder={onSetReminder} onClearReminder={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /ce soir/i }))

    const iso = onSetReminder.mock.calls[0][0]
    const target = new Date(iso)
    expect(target.getHours()).toBe(18)
    expect(target.getMinutes()).toBe(0)
    expect(target.getTime()).toBeGreaterThan(Date.now())
  })
})
