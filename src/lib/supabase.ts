import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const cleAnonyme = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !cleAnonyme) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY sont requis : copier .env.example vers .env (voir le README).',
  );
}

export const supabase = createClient(url, cleAnonyme);
