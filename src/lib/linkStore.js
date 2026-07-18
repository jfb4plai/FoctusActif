export async function createLink(supabase, initiatedBy) {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user.id

  const payload =
    initiatedBy === 'teacher'
      ? { teacher_id: userId, initiated_by: 'teacher' }
      : { student_id: userId, initiated_by: 'student' }

  const { data, error } = await supabase.from('focus_links').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function claimLink(supabase, code) {
  const { data, error } = await supabase.rpc('focus_claim_link', { p_code: code })
  if (error) throw new Error('Code invalide ou déjà utilisé.')
  return data
}

export async function listLinks(supabase) {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user.id

  const { data, error } = await supabase
    .from('focus_links')
    .select('*')
    .or(`teacher_id.eq.${userId},student_id.eq.${userId}`)
    .eq('status', 'linked')
  if (error) throw error
  return data
}
