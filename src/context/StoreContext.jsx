import { createContext, useContext, useEffect, useState } from 'react'
import { createLocalStore } from '../lib/localStore.js'

const StoreContext = createContext(null)

export function StoreProvider({ children, dbName = 'focusactif' }) {
  const [store, setStore] = useState(null)

  useEffect(() => {
    let cancelled = false
    createLocalStore(dbName).then((instance) => {
      if (!cancelled) setStore(instance)
    })
    return () => {
      cancelled = true
    }
  }, [dbName])

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useTaskStore() {
  return useContext(StoreContext)
}
