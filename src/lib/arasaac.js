import { mapArasaacResponse } from './arasaacMapper.js'

export async function searchPictograms(supabase, word, language = 'fr') {
  const { data, error } = await supabase.functions.invoke('search-pictograms', {
    body: { word, language },
  })
  if (error) throw error
  return mapArasaacResponse(data)
}
