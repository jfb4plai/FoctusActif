import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import App from './App.jsx'

const mockStore = {
  listContexts: vi.fn().mockResolvedValue([]),
  addContext: vi.fn().mockResolvedValue({ id: 'c1', label: 'Devoirs', emoji: '📚', locked: false }),
  getNextTask: vi.fn().mockResolvedValue(null),
}

vi.mock('./lib/supabaseClient.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  },
}))

vi.mock('./lib/supabaseStore.js', () => ({
  createSupabaseStore: () => mockStore,
}))

const subscribeToPush = vi.fn().mockResolvedValue(null)
vi.mock('./lib/pushSubscription.js', () => ({
  subscribeToPush: (...args) => subscribeToPush(...args),
}))

describe('App — choix du mode de stockage', () => {
  it('affiche StorageSetup en premier, puis Auth si "compte" est choisi', async () => {
    render(<App />)

    expect(await screen.findByText(/comment voulez-vous utiliser/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /créer un compte|se connecter/i }))

    expect(await screen.findByLabelText(/adresse e-mail/i)).toBeInTheDocument()
  })

  it('affiche ContextPicker directement si "sans compte" est choisi', async () => {
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: /sans compte/i }))

    expect(await screen.findByLabelText(/nom du contexte/i)).toBeInTheDocument()
  })

  it('permet de sélectionner un contexte déjà existant après connexion', async () => {
    mockStore.listContexts.mockResolvedValueOnce([
      { id: 'c1', label: 'routine du matin', emoji: '📌', locked: false },
      { id: 'c2', label: 'maison', emoji: '📌', locked: false },
    ])

    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: /créer un compte|se connecter/i }))
    await userEvent.type(await screen.findByLabelText(/adresse e-mail/i), 'test@example.com')
    await userEvent.type(screen.getByLabelText(/mot de passe/i), 'motdepasse123')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    await userEvent.click(await screen.findByText('routine du matin'))

    expect(screen.queryByLabelText(/nom du contexte/i)).not.toBeInTheDocument()
  })

  describe('demande de permission notification', () => {
    let originalNotification

    beforeEach(() => {
      originalNotification = global.Notification
      global.Notification = {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      }
      vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'test-vapid-key')
      subscribeToPush.mockClear()
    })

    afterEach(() => {
      global.Notification = originalNotification
      vi.unstubAllEnvs()
    })

    it('explique la demande de permission avant de la déclencher, et attend un clic explicite', async () => {
      render(<App />)

      await userEvent.click(await screen.findByRole('button', { name: /créer un compte|se connecter/i }))
      await userEvent.type(await screen.findByLabelText(/adresse e-mail/i), 'test@example.com')
      await userEvent.type(screen.getByLabelText(/mot de passe/i), 'motdepasse123')
      await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))

      expect(
        await screen.findByText(/le navigateur va vous demander une autorisation/i),
      ).toBeInTheDocument()
      expect(subscribeToPush).not.toHaveBeenCalled()

      await userEvent.click(screen.getByRole('button', { name: /activer les notifications/i }))
      expect(subscribeToPush).toHaveBeenCalled()
    })

    it('permet de repousser sans déclencher la demande de permission', async () => {
      render(<App />)

      await userEvent.click(await screen.findByRole('button', { name: /créer un compte|se connecter/i }))
      await userEvent.type(await screen.findByLabelText(/adresse e-mail/i), 'test@example.com')
      await userEvent.type(screen.getByLabelText(/mot de passe/i), 'motdepasse123')
      await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))

      await userEvent.click(await screen.findByRole('button', { name: /plus tard/i }))

      expect(subscribeToPush).not.toHaveBeenCalled()
      expect(screen.queryByText(/le navigateur va vous demander une autorisation/i)).not.toBeInTheDocument()
    })
  })
})
