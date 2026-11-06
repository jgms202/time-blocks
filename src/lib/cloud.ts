import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { AppData } from './model'
import { Backend } from './sync'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

/** Null means no accounts are set up, and the app saves to this browser only. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

export const googleEnabled = import.meta.env.VITE_GOOGLE_SIGNIN === 'true'

export function cloudBackend(client: SupabaseClient, userId: string): Backend {
  return {
    fetch: async () => {
      const { data, error } = await client
        .from('user_data')
        .select('data, revision')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return data
    },
    insert: async (data: AppData) => {
      const { error } = await client.from('user_data').insert({ user_id: userId, data, revision: 1 })
      if (error) throw error
    },
    update: async (data: AppData, revision: number) => {
      const { data: rows, error } = await client
        .from('user_data')
        .update({ data, revision: revision + 1, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('revision', revision)
        .select('user_id')
      if (error) throw error
      return rows.length === 1
    },
  }
}
