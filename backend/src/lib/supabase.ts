import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY env vars.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
