import { createClient } from '@supabase/supabase-js'
import { publicSupabaseConfig } from './supabase-config'
const config = publicSupabaseConfig(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)
export const supabaseConfigError = config.error
export const supabase = config.url && config.key && !config.error ? createClient(config.url, config.key, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null
