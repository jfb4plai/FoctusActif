// src/lib/supabaseStore.contract.test.js
import { describe } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { runTaskStoreContractTests } from './taskStore.contract.js'
import { createSupabaseStore } from './supabaseStore.js'

const url = process.env.FOCUSACTIF_TEST_SUPABASE_URL
const anonKey = process.env.FOCUSACTIF_TEST_SUPABASE_ANON_KEY
const email = process.env.FOCUSACTIF_TEST_SUPABASE_EMAIL
const password = process.env.FOCUSACTIF_TEST_SUPABASE_PASSWORD

const hasCredentials = Boolean(url && anonKey && email && password)

describe.skipIf(!hasCredentials)('SupabaseStore (intégration réelle)', () => {
  runTaskStoreContractTests(async () => {
    const client = createClient(url, anonKey)
    const { error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw error
    return createSupabaseStore(client)
  })
})
