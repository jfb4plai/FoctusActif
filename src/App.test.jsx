import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import App from './App.jsx'

describe('App — parcours élève autonome', () => {
  it('créer un contexte → capturer une tâche → décomposer → terminer', async () => {
    render(<App />)

    // Créer un contexte
    await userEvent.type(await screen.findByLabelText(/nom du contexte/i), 'Devoirs')
    await userEvent.click(screen.getByRole('button', { name: /créer/i }))

    // Entrer dans le contexte
    await userEvent.click(await screen.findByText('Devoirs'))

    // Capturer une tâche depuis l'état vide
    await userEvent.click(screen.getByRole('button', { name: /ajouter une tâche/i }))
    await userEvent.type(screen.getByPlaceholderText(/ex :/i), 'Faire l\'exposé')
    await userEvent.click(screen.getByRole('button', { name: /^ajouter$/i }))

    // La tâche apparaît comme tâche courante
    await waitFor(() => expect(screen.getByText('Faire l\'exposé')).toBeInTheDocument())

    // Décomposer
    await userEvent.click(screen.getByRole('button', { name: /décomposer/i }))
    await userEvent.type(screen.getByPlaceholderText(/ex :/i), 'Choisir le sujet')
    await userEvent.click(screen.getByRole('button', { name: /^ajouter$/i }))
    await userEvent.click(screen.getByRole('button', { name: /fermer/i }))

    // La sous-étape est maintenant la tâche courante, pas le parent
    await waitFor(() => expect(screen.getByText('Choisir le sujet')).toBeInTheDocument())

    // Terminer la sous-étape
    await userEvent.click(screen.getByRole('button', { name: /fait/i }))

    // Le parent redevient la tâche courante
    await waitFor(() => expect(screen.getByText('Faire l\'exposé')).toBeInTheDocument())
  })
})
