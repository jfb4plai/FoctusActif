import { render, screen, within } from '@testing-library/react'
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
    expect(items.map((el) => within(el).getByTestId('subtask-title').textContent)).toEqual([
      'Choisir le sujet',
      'Écrire le plan',
    ])
  })

  it('permet de renommer et supprimer une sous-étape sans attendre qu\'elle devienne la tâche courante', async () => {
    const onRenameSubtask = vi.fn()
    const onDeleteSubtask = vi.fn()
    const subtasks = [{ id: 's1', title: 'Choisr le sujet', status: 'todo' }]
    render(
      <DecomposeSheet
        parentTitle="Faire l'exposé"
        subtasks={subtasks}
        onAddSubtask={vi.fn()}
        onClose={vi.fn()}
        onRenameSubtask={onRenameSubtask}
        onDeleteSubtask={onDeleteSubtask}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /modifier/i }))
    const input = screen.getByDisplayValue('Choisr le sujet')
    await userEvent.clear(input)
    await userEvent.type(input, 'Choisir le sujet')
    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }))
    expect(onRenameSubtask).toHaveBeenCalledWith('s1', 'Choisir le sujet')

    await userEvent.click(screen.getByRole('button', { name: /modifier/i }))
    await userEvent.click(screen.getByRole('button', { name: /^supprimer$/i }))
    expect(screen.getByText(/supprimer .*choisr le sujet/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /oui, supprimer/i }))
    expect(onDeleteSubtask).toHaveBeenCalledWith('s1')
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
