import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { DecomposeSheet } from './DecomposeSheet.jsx'

describe('DecomposeSheet', () => {
  it('affiche les sous-étapes existantes dans l\'ordre', () => {
    const subtasks = [
      { id: 's1', title: 'Choisir le sujet', status: 'todo' },
      { id: 's2', title: 'Écrire le plan', status: 'todo' },
    ]
    render(
      <DecomposeSheet
        parentTitle="Faire l'exposé"
        subtasks={subtasks}
        onAddSubtask={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const items = screen.getAllByTestId('subtask-item')
    expect(items.map((el) => el.textContent)).toEqual(['Choisir le sujet', 'Écrire le plan'])
  })

  it('déclenche onAddSubtask via le champ de capture', async () => {
    const onAddSubtask = vi.fn()
    render(
      <DecomposeSheet parentTitle="Faire l'exposé" subtasks={[]} onAddSubtask={onAddSubtask} onClose={vi.fn()} />,
    )
    await userEvent.type(screen.getByPlaceholderText(/ex :/i), 'Choisir le sujet')
    await userEvent.click(screen.getByRole('button', { name: /ajouter/i }))
    expect(onAddSubtask).toHaveBeenCalledWith('Choisir le sujet')
  })

  it('déclenche onClose au clic sur Fermer', async () => {
    const onClose = vi.fn()
    render(<DecomposeSheet parentTitle="Faire l'exposé" subtasks={[]} onAddSubtask={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /fermer/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
