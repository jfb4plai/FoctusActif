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

  it('affiche un état vide expliquant ce qu\'est une tâche et quoi faire', () => {
    render(
      <TaskDashboard task={null} onComplete={vi.fn()} onDecompose={vi.fn()} onOpenCapture={vi.fn()} />,
    )
    expect(screen.getByText(/aucune tâche/i)).toBeInTheDocument()
    expect(screen.getByText(/une tâche, c'est une chose à faire/i)).toBeInTheDocument()
  })

  it('explique ce que font les boutons "Fait" et "Décomposer"', () => {
    const task = { id: 't1', title: 'Choisir le sujet', status: 'todo', parentTaskId: null }
    render(
      <TaskDashboard task={task} onComplete={vi.fn()} onDecompose={vi.fn()} onOpenCapture={vi.fn()} />,
    )
    expect(screen.getByText(/marque cette tâche comme terminée/i)).toBeInTheDocument()
    expect(screen.getByText(/la diviser en plusieurs petites étapes/i)).toBeInTheDocument()
    expect(screen.getByText(/faire l'exposé.*choisir le sujet/i)).toBeInTheDocument()
  })

  it('rappelle le contexte actif (emoji + nom), avec ou sans tâche', () => {
    const { rerender } = render(
      <TaskDashboard
        task={null}
        contextLabel="routine du matin"
        contextEmoji="📌"
        onComplete={vi.fn()}
        onDecompose={vi.fn()}
        onOpenCapture={vi.fn()}
      />,
    )
    expect(screen.getByText(/routine du matin/)).toBeInTheDocument()

    const task = { id: 't1', title: 'Se brosser les dents', status: 'todo' }
    rerender(
      <TaskDashboard
        task={task}
        contextLabel="routine du matin"
        contextEmoji="📌"
        onComplete={vi.fn()}
        onDecompose={vi.fn()}
        onOpenCapture={vi.fn()}
      />,
    )
    expect(screen.getByText(/routine du matin/)).toBeInTheDocument()
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

  it('masque aussi le renommer/supprimer si le contexte est verrouillé', () => {
    const task = { id: 't1', title: 'Choisir le sujet', status: 'todo', parentTaskId: null }
    render(
      <TaskDashboard
        task={task}
        contextLocked
        onComplete={vi.fn()}
        onDecompose={vi.fn()}
        onOpenCapture={vi.fn()}
        onRenameTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: /modifier/i })).not.toBeInTheDocument()
  })

  it('permet de renommer la tâche courante', async () => {
    const onRenameTask = vi.fn()
    const task = { id: 't1', title: 'Reviser', status: 'todo', parentTaskId: null }
    render(
      <TaskDashboard
        task={task}
        onComplete={vi.fn()}
        onDecompose={vi.fn()}
        onOpenCapture={vi.fn()}
        onRenameTask={onRenameTask}
        onDeleteTask={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /modifier/i }))
    const input = screen.getByDisplayValue('Reviser')
    await userEvent.clear(input)
    await userEvent.type(input, 'Réviser')
    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    expect(onRenameTask).toHaveBeenCalledWith('t1', 'Réviser')
  })

  it('demande confirmation avant de supprimer la tâche courante', async () => {
    const onDeleteTask = vi.fn()
    const task = { id: 't1', title: 'Réviser', status: 'todo', parentTaskId: null }
    render(
      <TaskDashboard
        task={task}
        onComplete={vi.fn()}
        onDecompose={vi.fn()}
        onOpenCapture={vi.fn()}
        onRenameTask={vi.fn()}
        onDeleteTask={onDeleteTask}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /modifier/i }))
    await userEvent.click(screen.getByRole('button', { name: /^supprimer$/i }))

    expect(screen.getByText(/supprimer .*réviser/i)).toBeInTheDocument()
    expect(onDeleteTask).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /oui, supprimer/i }))
    expect(onDeleteTask).toHaveBeenCalledWith('t1')
  })

  it('affiche le ReminderPicker et relaie ses callbacks', () => {
    const task = { id: 't1', title: 'Réviser', status: 'todo', parentTaskId: null, remindAt: null }
    render(
      <TaskDashboard
        task={task}
        onComplete={vi.fn()}
        onDecompose={vi.fn()}
        onOpenCapture={vi.fn()}
        onSetReminder={vi.fn()}
        onClearReminder={vi.fn()}
      />,
    )
    expect(screen.getByLabelText(/me le rappeler à/i)).toBeInTheDocument()
  })
})
