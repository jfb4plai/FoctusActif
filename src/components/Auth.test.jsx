import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Auth } from './Auth.jsx'

describe('Auth', () => {
  it('déclenche onSignIn avec email/mot de passe saisis', async () => {
    const onSignIn = vi.fn().mockResolvedValue(undefined)
    render(<Auth onSignIn={onSignIn} onSignUp={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/adresse e-mail/i), 'eleve@example.com')
    await userEvent.type(screen.getByLabelText(/mot de passe/i), 'motdepasse123')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    expect(onSignIn).toHaveBeenCalledWith('eleve@example.com', 'motdepasse123')
  })

  it('affiche une erreur générique si la connexion échoue', async () => {
    const onSignIn = vi.fn().mockRejectedValue(new Error('Invalid login credentials'))
    render(<Auth onSignIn={onSignIn} onSignUp={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/adresse e-mail/i), 'eleve@example.com')
    await userEvent.type(screen.getByLabelText(/mot de passe/i), 'mauvais')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    expect(await screen.findByText(/identifiants incorrects/i)).toBeInTheDocument()
  })

  it('bascule vers le formulaire d\'inscription et déclenche onSignUp', async () => {
    const onSignUp = vi.fn().mockResolvedValue(undefined)
    render(<Auth onSignIn={vi.fn()} onSignUp={onSignUp} />)

    await userEvent.click(screen.getByRole('button', { name: /créer un compte/i }))
    await userEvent.type(screen.getByLabelText(/adresse e-mail/i), 'nouveau@example.com')
    await userEvent.type(screen.getByLabelText(/mot de passe/i), 'motdepasse123')
    await userEvent.click(screen.getByRole('button', { name: /^créer mon compte$/i }))

    expect(onSignUp).toHaveBeenCalledWith('nouveau@example.com', 'motdepasse123')
  })

  it('affiche un message de confirmation email si le compte nécessite une validation', async () => {
    const onSignUp = vi.fn().mockResolvedValue({ needsConfirmation: true })
    render(<Auth onSignIn={vi.fn()} onSignUp={onSignUp} />)

    await userEvent.click(screen.getByRole('button', { name: /créer un compte/i }))
    await userEvent.type(screen.getByLabelText(/adresse e-mail/i), 'nouveau@example.com')
    await userEvent.type(screen.getByLabelText(/mot de passe/i), 'motdepasse123')
    await userEvent.click(screen.getByRole('button', { name: /^créer mon compte$/i }))

    expect(await screen.findByText(/vérifiez votre boîte mail/i)).toBeInTheDocument()
  })
})
