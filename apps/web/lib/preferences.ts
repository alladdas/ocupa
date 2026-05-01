import { getSupabaseBrowser } from '@/lib/supabase-browser'

export async function loadHiddenIds(userId: string): Promise<Set<string>> {
  const { data } = await getSupabaseBrowser()
    .from('user_job_preferences')
    .select('job_id')
    .eq('user_id', userId)
    .eq('action', 'not_interested')
  return new Set<string>((data ?? []).map((r: { job_id: string }) => r.job_id))
}

export function hideJobRemote(userId: string, jobId: string): void {
  void getSupabaseBrowser()
    .from('user_job_preferences')
    .insert({ user_id: userId, job_id: jobId, action: 'not_interested' })
  // Duplicate silently ignored — UNIQUE(user_id, job_id, action) constraint in DB
}

export function unhideJobRemote(userId: string, jobId: string): void {
  void getSupabaseBrowser()
    .from('user_job_preferences')
    .delete()
    .eq('user_id', userId)
    .eq('job_id', jobId)
    .eq('action', 'not_interested')
}
