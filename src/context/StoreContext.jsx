import { createContext, useContext, useEffect, useState } from 'react'
import { createLocalStore } from '../lib/localStore.js'

const StoreContext = createContext(null)

export function StoreProvider({ children, dbName = 'focusactif', storageMode = 'local' }) {
  const [store, setStore] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      if (storageMode === 'account') {
        const { supabase } = await import('../lib/supabaseClient.js')
        const { createSupabaseStore } = await import('../lib/supabaseStore.js')
        if (!cancelled) setStore(createSupabaseStore(supabase))
      } else {
        const instance = await createLocalStore(dbName)
        if (!cancelled) setStore(instance)
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [dbName, storageMode])

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useTaskStore() {
  return useContext(StoreContext)
}
