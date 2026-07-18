import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { StoreProvider, useTaskStore } from './StoreContext.jsx'

vi.mock('../lib/supabaseClient.js', () => ({
  supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) } },
}))

function Probe() {
  const store = useTaskStore()
  return <div data-testid="probe">{store ? 'ready' : 'loading'}</div>
}

describe('StoreProvider', () => {
  it('fournit une instance TaskStore aux enfants', async () => {
    render(
      <StoreProvider dbName="focusactif-storecontext-test">
        <Probe />
      </StoreProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('ready'))
  })
})

describe('StoreProvider — mode compte', () => {
  it('fournit une instance SupabaseStore quand storageMode="account"', async () => {
    render(
      <StoreProvider dbName="focusactif-storecontext-test-2" storageMode="account">
        <Probe />
      </StoreProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('ready'))
  })
})
