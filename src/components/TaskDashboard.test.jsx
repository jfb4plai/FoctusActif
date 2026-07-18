import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TaskDashboard } from './TaskDashboard.jsx'

describe('TaskDashboard', () => {
  it('affiche la tâche courante et déclenche onComplete au clic sur "Fait"', async () => {
    const onComplete = vi.fn()
    const task = { id: 't1', title: 'Choisir le sujet', status: 'todo' }
    render(
      <TaskDashboard
        task={task}
        onComplete={onComplete}
        onDecompose={vi.fn()}
        onOpenCapture={vi.fn()}
      />,
    )

    expect(screen.getByText('Choisir le sujet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /fait/i }))
    expect(onComplete).toHaveBeenCalledWith('t1')
  })

  it('affiche un état vide invitant à capturer une tâche s\'il n\'y en a aucune', () => {
    render(
      <TaskDashboard task={null} onComplete={vi.fn()} onDecompose={vi.fn()} onOpenCapture={vi.fn()} />,
    )
    expect(screen.getByText(/aucune tâche/i)).toBeInTheDocument()
  })

  it('déclenche onDecompose avec l\'id de la tâche courante', async () => {
    const onDecompose = vi.fn()
    const task = { id: 't1', title: 'Faire l\'exposé', status: 'todo' }
    render(
      <TaskDashboard task={task} onComplete={vi.fn()} onDecompose={onDecompose} onOpenCapture={vi.fn()} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /décomposer/i }))
    expect(onDecompose).toHaveBeenCalledWith('t1')
  })

  it('ne propose pas de décomposer une tâche qui est déjà une sous-tâche', () => {
    const task = { id: 'sub1', title: 'Rédiger l\'introduction', status: 'todo', parentTaskId: 't1' }
    render(
      <TaskDashboard task={task} onComplete={vi.fn()} onDecompose={vi.fn()} onOpenCapture={vi.fn()} />,
    )
    expect(screen.queryByRole('button', { name: /décomposer/i })).not.toBeInTheDocument()
  })

  it('masque les actions de capture/décomposition si le contexte est verrouillé', () => {
    const task = { id: 't1', title: 'Choisir le sujet', status: 'todo', parentTaskId: null }
    render(
      <TaskDashboard
        task={task}
        contextLocked
        onComplete={vi.fn()}
        onDecompose={vi.fn()}
        onOpenCapture={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: /décomposer/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ajouter une tâche/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /fait/i })).toBeInTheDocument()
  })
})
