import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

/** `undefined` tant que la session enregistrée n'est pas lue, `null` si personne n'est connecté. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_evenement, nouvelle) => setSession(nouvelle));
    return () => data.subscription.unsubscribe();
  }, []);

  return session;
}
