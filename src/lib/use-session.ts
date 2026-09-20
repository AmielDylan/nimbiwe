import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

// Réponses du serveur qui disent « ce compte n'existe plus » ou « ce jeton n'est plus valable ».
const COMPTE_INCONNU = [401, 403, 404];

/** `undefined` tant que la session enregistrée n'est pas lue, `null` si personne n'est connecté. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_evenement, nouvelle) => setSession(nouvelle));
    return () => data.subscription.unsubscribe();
  }, []);

  // Une session enregistrée sur le téléphone survit à la suppression du compte côté
  // serveur (base réinitialisée, compte supprimé) : on vérifie qu'il existe encore,
  // sinon toute écriture échouerait sans explication.
  const utilisateurId = session?.user.id;
  useEffect(() => {
    if (!utilisateurId) return;
    let actif = true;
    supabase.auth.getUser().then(({ error }) => {
      if (actif && error?.status !== undefined && COMPTE_INCONNU.includes(error.status)) {
        supabase.auth.signOut();
      }
    });
    return () => {
      actif = false;
    };
  }, [utilisateurId]);

  return session;
}
