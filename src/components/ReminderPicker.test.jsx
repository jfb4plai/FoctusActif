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
})
