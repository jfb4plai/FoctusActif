import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ContextPicker } from './ContextPicker.jsx'

const CONTEXTS = [
  { id: 'c1', label: 'École', emoji: '🏫', locked: false },
  { id: 'c2', label: 'Maison', emoji: '🏠', locked: false },
]

describe('ContextPicker', () => {
  it('affiche chaque contexte et déclenche onSelect au clic', async () => {
    const onSelect = vi.fn()
    render(<ContextPicker contexts={CONTEXTS} onSelect={onSelect} onCreate={vi.fn()} />)

    expect(screen.getByText('École')).toBeInTheDocument()
    expect(screen.getByText('Maison')).toBeInTheDocument()

    await userEvent.click(screen.getByText('École'))
    expect(onSelect).toHaveBeenCalledWith('c1')
  })

  it('explique que les contextes existants sont cliquables pour les ouvrir', () => {
    render(<ContextPicker contexts={CONTEXTS} onSelect={vi.fn()} onCreate={vi.fn()} />)
    expect(screen.getByText(/touchez un contexte pour l'ouvrir/i)).toBeInTheDocument()
  })

  it('affiche un état vide invitant à créer un contexte si la liste est vide', () => {
    render(<ContextPicker contexts={[]} onSelect={vi.fn()} onCreate={vi.fn()} />)
    expect(screen.getByText(/aucun contexte/i)).toBeInTheDocument()
  })

  it('déclenche onCreate avec le libellé et l\'emoji saisis', async () => {
    const onCreate = vi.fn()
    render(<ContextPicker contexts={[]} onSelect={vi.fn()} onCreate={onCreate} />)

    await userEvent.type(screen.getByLabelText(/nom du contexte/i), 'Devoirs')
    await userEvent.click(screen.getByRole('button', { name: /créer/i }))

    expect(onCreate).toHaveBeenCalledWith('Devoirs', expect.any(String))
  })
})
