import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { OnboardingChecklist } from './OnboardingChecklist.jsx'

describe('OnboardingChecklist', () => {
  it('affiche les deux étapes avec leur état coché/non coché', () => {
    render(<OnboardingChecklist contextDone={true} taskDone={false} />)
    expect(screen.getByText(/✓ Créer un premier contexte/)).toBeInTheDocument()
    expect(screen.getByText(/○ Ajouter une première tâche/)).toBeInTheDocument()
  })
})
