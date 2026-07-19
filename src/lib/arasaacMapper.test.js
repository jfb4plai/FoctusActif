import { describe, it, expect } from 'vitest'
import { mapArasaacResponse } from './arasaacMapper.js'

describe('mapArasaacResponse', () => {
  it('maps a well-formed response to Pictogram[]', () => {
    const result = mapArasaacResponse({
      pictograms: [{ id: 5122, url: 'https://api.arasaac.org/api/pictograms/5122', keywords: ['main', 'mains'] }],
    })
    expect(result).toEqual([
      { id: 5122, url: 'https://api.arasaac.org/api/pictograms/5122', keywords: ['main', 'mains'] },
    ])
  })

  it('returns an empty array when the response has no pictograms field', () => {
    expect(mapArasaacResponse({})).toEqual([])
    expect(mapArasaacResponse(null)).toEqual([])
  })

  it('drops entries missing an id or url', () => {
    const result = mapArasaacResponse({ pictograms: [{ keywords: ['x'] }] })
    expect(result).toEqual([])
  })

  it('extracts the .keyword string from ARASAAC keyword objects (real API shape)', () => {
    const result = mapArasaacResponse({
      pictograms: [
        {
          id: 8977,
          url: 'https://api.arasaac.org/api/pictograms/8977',
          keywords: [
            { type: 3, keyword: 'laver', hasLocution: true },
            { keyword: 'se laver les mains', hasLocution: true, type: 3 },
          ],
        },
      ],
    })
    expect(result).toEqual([
      {
        id: 8977,
        url: 'https://api.arasaac.org/api/pictograms/8977',
        keywords: ['laver', 'se laver les mains'],
      },
    ])
  })

  it('drops malformed keyword entries (no .keyword string) instead of crashing', () => {
    const result = mapArasaacResponse({
      pictograms: [
        {
          id: 1,
          url: 'https://x',
          keywords: [{ notAKeyword: true }, { keyword: 'valide' }, 'chaine-brute'],
        },
      ],
    })
    expect(result).toEqual([{ id: 1, url: 'https://x', keywords: ['valide', 'chaine-brute'] }])
  })
})
