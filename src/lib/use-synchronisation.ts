import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { synchroniser } from '@/lib/file-attente';
import { supabase } from '@/lib/supabase';

/** Tant que l'app est ouverte, les relevés en attente sont retentés à cette cadence. */
export const INTERVALLE_SYNCHRONISATION_MS = 15_000;

/**
 * Envoie automatiquement les relevés gardés sur le téléphone : à l'ouverture, au retour de
 * l'app au premier plan et à intervalle régulier (le réseau peut revenir à tout moment).
 */
export function useSynchronisation() {
  const [proprietaire, setProprietaire] = useState<string | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_evenement, session) =>
      setProprietaire(session?.user.id ?? null),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!proprietaire) return;
    const envoyer = () => {
      synchroniser(proprietaire).catch(() => {});
    };
    envoyer();
    const minuteur = setInterval(envoyer, INTERVALLE_SYNCHRONISATION_MS);
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') envoyer();
    });
    return () => {
      clearInterval(minuteur);
      abonnement.remove();
    };
  }, [proprietaire]);
}
