import { describe, it, expect, vi } from 'vitest'
import { createLink, claimLink, listLinks } from './linkStore.js'

function makeMockSupabase({ user, insertResult, claimResult, claimError, listResult }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: insertResult, error: null }),
        })),
      })),
      select: vi.fn(() => ({
        or: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: listResult, error: null }),
        })),
      })),
    })),
    rpc: vi.fn().mockResolvedValue(
      claimError ? { data: null, error: claimError } : { data: claimResult, error: null },
    ),
  }
}

describe('linkStore', () => {
  it('createLink insère un lien initié par l\'enseignant avec teacher_id renseigné', async () => {
    const supabase = makeMockSupabase({
      user: { id: 'teacher-1' },
      insertResult: { id: 'link-1', teacher_id: 'teacher-1', student_id: null, invite_code: 'ABC123', status: 'pending' },
    })

    const link = await createLink(supabase, 'teacher')

    expect(supabase.from).toHaveBeenCalledWith('focus_links')
    expect(link.invite_code).toBe('ABC123')
  })

  it('claimLink appelle le RPC focus_claim_link avec le code fourni', async () => {
    const supabase = makeMockSupabase({
      user: { id: 'student-1' },
      claimResult: { id: 'link-1', teacher_id: 'teacher-1', student_id: 'student-1', status: 'linked' },
    })

    const link = await claimLink(supabase, 'ABC123')

    expect(supabase.rpc).toHaveBeenCalledWith('focus_claim_link', { p_code: 'ABC123' })
    expect(link.status).toBe('linked')
  })

  it('claimLink lève une erreur générique si le RPC échoue', async () => {
    const supabase = makeMockSupabase({
      user: { id: 'student-1' },
      claimError: { message: 'invalid_or_used_code' },
    })

    await expect(claimLink(supabase, 'BADCODE')).rejects.toThrow(/code invalide/i)
  })

  it('listLinks retourne les liens où l\'utilisateur est enseignant ou élève', async () => {
    const supabase = makeMockSupabase({
      user: { id: 'teacher-1' },
      listResult: [{ id: 'link-1', teacher_id: 'teacher-1', student_id: 'student-1', status: 'linked' }],
    })

    const links = await listLinks(supabase)

    expect(links).toHaveLength(1)
  })
})
