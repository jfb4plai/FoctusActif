import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { StorageSetup } from './StorageSetup.jsx'

describe('StorageSetup', () => {
  it('déclenche onChooseLocal au clic sur "Continuer sans compte"', async () => {
    const onChooseLocal = vi.fn()
    render(<StorageSetup onChooseLocal={onChooseLocal} onChooseAccount={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /sans compte/i }))
    expect(onChooseLocal).toHaveBeenCalled()
  })

  it('déclenche onChooseAccount au clic sur "Créer un compte / Se connecter"', async () => {
    const onChooseAccount = vi.fn()
    render(<StorageSetup onChooseLocal={vi.fn()} onChooseAccount={onChooseAccount} />)
    await userEvent.click(screen.getByRole('button', { name: /créer un compte|se connecter/i }))
    expect(onChooseAccount).toHaveBeenCalled()
  })

  it('affiche la limite du mode local (rien n\'est sauvegardé en ligne)', () => {
    render(<StorageSetup onChooseLocal={vi.fn()} onChooseAccount={vi.fn()} />)
    expect(screen.getByText(/rien n'est sauvegardé en ligne/i)).toBeInTheDocument()
  })

  it('ne promet pas la liaison enseignant en mode compte (fonctionnalité non disponible)', () => {
    render(<StorageSetup onChooseLocal={vi.fn()} onChooseAccount={vi.fn()} />)
    expect(screen.queryByText(/enseignant lié peut configurer/i)).not.toBeInTheDocument()
  })
})
