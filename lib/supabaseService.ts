import { createClient } from '@supabase/supabase-js'

// Server-side service client (do NOT import in client components)
export function createSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Supabase service role key or URL missing')
  }
  return createClient(url, serviceKey)
}
