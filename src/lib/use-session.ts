import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

// Réponses du serveur qui disent « ce compte n'existe plus » ou « ce jeton n'est plus valable ».
const COMPTE_INCONNU = [401, 403, 404];

// `useSession` est appelé par plusieurs composants à la fois (l'onglet Profil dans
// `_layout.tsx`, l'écran Profil lui-même…) : une vérification par compte à la fois, partagée,
// pour qu'un compte supprimé ne déclenche pas une déconnexion par appelant.
const verificationsEnCours = new Map<string, Promise<void>>();

function verifierQueLeCompteExisteEncore(utilisateurId: string): Promise<void> {
  const existante = verificationsEnCours.get(utilisateurId);
  if (existante) return existante;
  const verification = supabase.auth
    .getUser()
    .then(({ error }) => {
      if (error?.status !== undefined && COMPTE_INCONNU.includes(error.status)) {
        supabase.auth.signOut();
      }
    })
    .finally(() => {
      verificationsEnCours.delete(utilisateurId);
    });
  verificationsEnCours.set(utilisateurId, verification);
  return verification;
}

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
    verifierQueLeCompteExisteEncore(utilisateurId);
  }, [utilisateurId]);

  return session;
}
