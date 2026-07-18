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
})
