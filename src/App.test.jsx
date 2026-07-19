import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import App from './App.jsx'

describe('App — parcours élève autonome', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('créer un contexte → capturer une tâche → décomposer → terminer', async () => {
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: /sans compte/i }))

    // Créer un contexte
    await userEvent.type(await screen.findByLabelText(/nom du contexte/i), 'Devoirs')
    await userEvent.click(screen.getByRole('button', { name: /créer/i }))

    // Entrer dans le contexte
    await userEvent.click(await screen.findByText('Devoirs'))

    // Capturer une tâche depuis l'état vide
    await userEvent.click(screen.getByRole('button', { name: /ajouter une tâche/i }))
    expect(screen.getByText(/ajouter une tâche.*Devoirs/i)).toBeInTheDocument()
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

  it('permet de revenir à la liste des contextes depuis un contexte sélectionné', async () => {
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: /sans compte/i }))

    await userEvent.type(await screen.findByLabelText(/nom du contexte/i), 'Retour contexte test')
    await userEvent.click(screen.getByRole('button', { name: /créer/i }))
    await userEvent.click(await screen.findByText('Retour contexte test'))

    await waitFor(() => expect(screen.getByText(/ajouter une tâche/i)).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /mes contextes/i }))

    expect(await screen.findByLabelText(/nom du contexte/i)).toBeInTheDocument()
    expect(screen.getByText('Retour contexte test')).toBeInTheDocument()
  })

  it('permet d\'annuler l\'ajout d\'une tâche sans la valider', async () => {
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: /sans compte/i }))
    await userEvent.type(await screen.findByLabelText(/nom du contexte/i), 'Annulation test')
    await userEvent.click(screen.getByRole('button', { name: /créer/i }))
    await userEvent.click(await screen.findByText('Annulation test'))

    await userEvent.click(await screen.findByRole('button', { name: /ajouter une tâche/i }))
    await userEvent.click(screen.getByRole('button', { name: /annuler/i }))

    await waitFor(() => expect(screen.getByText(/ajouter une tâche/i)).toBeInTheDocument())
    expect(screen.queryByPlaceholderText(/ex :/i)).not.toBeInTheDocument()
  })

  it('permet de renommer puis de supprimer un contexte', async () => {
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: /sans compte/i }))
    await userEvent.type(await screen.findByLabelText(/nom du contexte/i), 'Contexte à renommer')
    await userEvent.click(screen.getByRole('button', { name: /créer/i }))

    await userEvent.click(await screen.findByRole('button', { name: /gérer mes contextes/i }))
    const row = screen.getByText('Contexte à renommer').closest('.plai-card')
    await userEvent.click(within(row).getByRole('button', { name: /renommer/i }))
    const input = screen.getByDisplayValue('Contexte à renommer')
    await userEvent.clear(input)
    await userEvent.type(input, 'Contexte renommé')
    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    expect(await screen.findByText('Contexte renommé')).toBeInTheDocument()

    const renamedRow = screen.getByText('Contexte renommé').closest('.plai-card')
    await userEvent.click(within(renamedRow).getByRole('button', { name: /^supprimer$/i }))
    await userEvent.click(screen.getByRole('button', { name: /oui, supprimer/i }))

    await waitFor(() => expect(screen.queryByText('Contexte renommé')).not.toBeInTheDocument())
  })

  it('permet de renommer et supprimer la tâche courante', async () => {
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: /sans compte/i }))
    await userEvent.type(await screen.findByLabelText(/nom du contexte/i), 'Contexte tâche modif')
    await userEvent.click(screen.getByRole('button', { name: /créer/i }))
    await userEvent.click(await screen.findByText('Contexte tâche modif'))

    await userEvent.click(await screen.findByRole('button', { name: /ajouter une tâche/i }))
    await userEvent.type(screen.getByPlaceholderText(/ex :/i), 'Tache a corriger')
    await userEvent.click(screen.getByRole('button', { name: /^ajouter$/i }))

    await waitFor(() => expect(screen.getByText('Tache a corriger')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /modifier/i }))
    const input = screen.getByDisplayValue('Tache a corriger')
    await userEvent.clear(input)
    await userEvent.type(input, 'Tâche corrigée')
    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => expect(screen.getByText('Tâche corrigée')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /modifier/i }))
    await userEvent.click(screen.getByRole('button', { name: /^supprimer$/i }))
    await userEvent.click(screen.getByRole('button', { name: /oui, supprimer/i }))

    await waitFor(() => expect(screen.getByText(/aucune tâche/i)).toBeInTheDocument())
  })

  it('permet d\'annuler un "Fait" accidentel via la bannière persistante', async () => {
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: /sans compte/i }))
    await userEvent.type(await screen.findByLabelText(/nom du contexte/i), 'Contexte annuler fait')
    await userEvent.click(screen.getByRole('button', { name: /créer/i }))
    await userEvent.click(await screen.findByText('Contexte annuler fait'))

    await userEvent.click(await screen.findByRole('button', { name: /ajouter une tâche/i }))
    await userEvent.type(screen.getByPlaceholderText(/ex :/i), 'Tache par erreur')
    await userEvent.click(screen.getByRole('button', { name: /^ajouter$/i }))

    await waitFor(() => expect(screen.getByText('Tache par erreur')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /fait/i }))

    expect(await screen.findByText(/tache par erreur.*marqué comme fait/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /annuler/i }))

    await waitFor(() => expect(screen.getByText('Tache par erreur')).toBeInTheDocument())
  })

  it('affiche la checklist de mise en route puis la fait disparaître définitivement après la première tâche', async () => {
    const { unmount } = render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: /sans compte/i }))
    expect(await screen.findByText(/mise en route/i)).toBeInTheDocument()

    await userEvent.type(await screen.findByLabelText(/nom du contexte/i), 'Onboarding test')
    await userEvent.click(screen.getByRole('button', { name: /créer/i }))
    await userEvent.click(await screen.findByText('Onboarding test'))

    // Toujours visible : contexte créé, mais pas encore de tâche
    expect(await screen.findByText(/mise en route/i)).toBeInTheDocument()
    expect(screen.getByText(/✓ Créer un premier contexte/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /ajouter une tâche/i }))
    await userEvent.type(screen.getByPlaceholderText(/ex :/i), 'Première tâche')
    await userEvent.click(screen.getByRole('button', { name: /^ajouter$/i }))

    await waitFor(() => expect(screen.getByText('Première tâche')).toBeInTheDocument())
    expect(screen.queryByText(/mise en route/i)).not.toBeInTheDocument()

    // La checklist ne doit jamais réapparaître, même après un rechargement complet
    unmount()
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: /sans compte/i }))
    expect(await screen.findByText('Onboarding test')).toBeInTheDocument()
    expect(screen.queryByText(/mise en route/i)).not.toBeInTheDocument()
  })

  it('ne montre jamais deux boutons "Annuler" ambigus en même temps (bannière Fait + édition)', async () => {
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: /sans compte/i }))
    await userEvent.type(await screen.findByLabelText(/nom du contexte/i), 'Contexte collision annuler')
    await userEvent.click(screen.getByRole('button', { name: /créer/i }))
    await userEvent.click(await screen.findByText('Contexte collision annuler'))

    await userEvent.click(await screen.findByRole('button', { name: /ajouter une tâche/i }))
    await userEvent.type(screen.getByPlaceholderText(/ex :/i), 'Premiere tache')
    await userEvent.click(screen.getByRole('button', { name: /^ajouter$/i }))
    await waitFor(() => expect(screen.getByText('Premiere tache')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /ajouter une tâche/i }))
    await userEvent.type(screen.getByPlaceholderText(/ex :/i), 'Deuxieme tache')
    await userEvent.click(screen.getByRole('button', { name: /^ajouter$/i }))

    // Termine la première tâche : la bannière "Annuler" apparaît, la deuxième devient courante
    await waitFor(() => expect(screen.getByText('Premiere tache')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /fait/i }))
    expect(await screen.findByText(/premiere tache.*marqué comme fait/i)).toBeInTheDocument()

    // Ouvre l'édition de la tâche suivante pendant que la bannière est encore visible
    await waitFor(() => expect(screen.getByText('Deuxieme tache')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /modifier/i }))

    expect(screen.getAllByRole('button', { name: /annuler/i })).toHaveLength(1)
  })

  it('permet de renommer et supprimer une sous-étape depuis l\'écran Décomposer', async () => {
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: /sans compte/i }))
    await userEvent.type(await screen.findByLabelText(/nom du contexte/i), 'Contexte sous-tache')
    await userEvent.click(screen.getByRole('button', { name: /créer/i }))
    await userEvent.click(await screen.findByText('Contexte sous-tache'))

    await userEvent.click(await screen.findByRole('button', { name: /ajouter une tâche/i }))
    await userEvent.type(screen.getByPlaceholderText(/ex :/i), 'Tache principale')
    await userEvent.click(screen.getByRole('button', { name: /^ajouter$/i }))
    await waitFor(() => expect(screen.getByText('Tache principale')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /décomposer/i }))
    await userEvent.type(screen.getByPlaceholderText(/ex :/i), 'Sous etape typo')
    await userEvent.click(screen.getByRole('button', { name: /^ajouter$/i }))
    await waitFor(() => expect(screen.getByText('Sous etape typo')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /modifier/i }))
    const input = screen.getByDisplayValue('Sous etape typo')
    await userEvent.clear(input)
    await userEvent.type(input, 'Sous-étape corrigée')
    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }))
    await waitFor(() => expect(screen.getByText('Sous-étape corrigée')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /modifier/i }))
    await userEvent.click(screen.getByRole('button', { name: /^supprimer$/i }))
    await userEvent.click(screen.getByRole('button', { name: /oui, supprimer/i }))
    await waitFor(() => expect(screen.queryByText('Sous-étape corrigée')).not.toBeInTheDocument())
  })

  it('regroupe le statut "Fait" dans une seule zone (pas deux bandeaux empilés)', async () => {
    const { container } = render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: /sans compte/i }))
    await userEvent.type(await screen.findByLabelText(/nom du contexte/i), 'Contexte zone statut')
    await userEvent.click(screen.getByRole('button', { name: /créer/i }))
    await userEvent.click(await screen.findByText('Contexte zone statut'))

    await userEvent.click(await screen.findByRole('button', { name: /ajouter une tâche/i }))
    await userEvent.type(screen.getByPlaceholderText(/ex :/i), 'Tache statut')
    await userEvent.click(screen.getByRole('button', { name: /^ajouter$/i }))
    await waitFor(() => expect(screen.getByText('Tache statut')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /fait/i }))
    await screen.findByText(/marqué comme fait/i)

    expect(container.querySelectorAll('[data-testid="status-zone"]')).toHaveLength(1)
  })
})
