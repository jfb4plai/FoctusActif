// ARASAAC's real API returns keyword entries as objects like
// { type, keyword, hasLocution, plural? } rather than plain strings.
function extractKeywordStrings(keywords) {
  return keywords
    .map((k) => (typeof k === 'string' ? k : k?.keyword))
    .filter((k) => typeof k === 'string')
}

export function mapArasaacResponse(json) {
  if (!json || typeof json !== 'object' || !('pictograms' in json)) {
    return []
  }
  const pictograms = json.pictograms
  if (!Array.isArray(pictograms)) return []

  return pictograms
    .filter((p) => typeof p === 'object' && p !== null)
    .map((p) => ({
      id: Number(p.id ?? 0),
      url: String(p.url ?? ''),
      keywords: Array.isArray(p.keywords) ? extractKeywordStrings(p.keywords) : [],
    }))
    .filter((p) => p.id !== 0 && p.url !== '')
}
