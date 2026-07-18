import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StoreProvider, useTaskStore } from './StoreContext.jsx'

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
