import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { subscribeToPush } from './pushSubscription.js'

function base64UrlEncode(bytes) {
  return Buffer.from(bytes).toString('base64url')
}

describe('subscribeToPush', () => {
  let originalServiceWorker
  let originalNotification

  beforeEach(() => {
    originalServiceWorker = navigator.serviceWorker
    originalNotification = global.Notification
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', { value: originalServiceWorker, configurable: true })
    global.Notification = originalNotification
  })

  it('ne fait rien si la permission de notification est refusée', async () => {
    global.Notification = { requestPermission: vi.fn().mockResolvedValue('denied') }
    const supabase = { from: vi.fn() }

    const result = await subscribeToPush(supabase, 'fake-vapid-public-key')

    expect(result).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('enregistre l\'abonnement Supabase si la permission est accordée', async () => {
    global.Notification = { requestPermission: vi.fn().mockResolvedValue('granted') }

    const fakeSubscription = {
      endpoint: 'https://push.example.com/abc',
      toJSON: () => ({
        endpoint: 'https://push.example.com/abc',
        keys: { p256dh: 'fake-p256dh', auth: 'fake-auth' },
      }),
    }
    const fakeRegistration = {
      pushManager: { subscribe: vi.fn().mockResolvedValue(fakeSubscription) },
    }

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn().mockResolvedValue(fakeRegistration),
        ready: Promise.resolve(fakeRegistration),
      },
      configurable: true,
    })

    const upsert = vi.fn().mockResolvedValue({ data: null, error: null })
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: vi.fn(() => ({ upsert })),
    }

    const result = await subscribeToPush(supabase, 'fake-vapid-public-key')

    expect(fakeRegistration.pushManager.subscribe).toHaveBeenCalled()
    expect(supabase.from).toHaveBeenCalledWith('focus_push_subscriptions')
    expect(upsert).toHaveBeenCalledWith(
      {
        owner_id: 'u1',
        endpoint: 'https://push.example.com/abc',
        p256dh: 'fake-p256dh',
        auth: 'fake-auth',
      },
      { onConflict: 'endpoint' },
    )
    expect(result).toEqual(fakeSubscription)
  })
})
