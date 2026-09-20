import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const cleAnonyme = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !cleAnonyme) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY sont requis : copier .env.example vers .env (voir le README).',
  );
}

export const supabase = createClient(url, cleAnonyme, {
  auth: {
    // La session survit à la fermeture de l'app.
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Le rafraîchissement du jeton ne tourne que lorsque l'app est au premier plan.
AppState.addEventListener('change', (etat) => {
  if (etat === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
