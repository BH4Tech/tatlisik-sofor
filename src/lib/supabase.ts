import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hyogvybvdkyabilmfjdl.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_dw0pzvTih8RSBP5MXBXayg_50Na30w1'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
