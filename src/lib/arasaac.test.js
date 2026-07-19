import { describe, it, expect, vi } from 'vitest'
import { searchPictograms } from './arasaac.js'

describe('searchPictograms', () => {
  it('appelle la fonction Edge search-pictograms et retourne les pictogrammes mappés', async () => {
    const supabase = {
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: { pictograms: [{ id: 5064, url: 'https://api.arasaac.org/api/pictograms/5064', keywords: ['maison'] }] },
          error: null,
        }),
      },
    }

    const result = await searchPictograms(supabase, 'maison')

    expect(supabase.functions.invoke).toHaveBeenCalledWith('search-pictograms', {
      body: { word: 'maison', language: 'fr' },
    })
    expect(result).toEqual([
      { id: 5064, url: 'https://api.arasaac.org/api/pictograms/5064', keywords: ['maison'] },
    ])
  })

  it('propage l\'erreur si la fonction Edge échoue', async () => {
    const supabase = {
      functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: new Error('boom') }) },
    }

    await expect(searchPictograms(supabase, 'maison')).rejects.toThrow('boom')
  })
})
