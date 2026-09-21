import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type Unite = { id: number; symbole: string };
export type Produit = { id: number; nom: string; unites: Unite[] };
export type Marche = { id: number; nom: string };

export type ReferentielPret = { statut: 'pret'; produits: Produit[]; marches: Marche[] };

// Copie du référentiel gardée sur le téléphone : sans réseau, le formulaire reste utilisable.
const CLE_COPIE = 'nimbiwe.referentiel';

async function lireLaCopie(): Promise<ReferentielPret | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_COPIE);
    return brut ? (JSON.parse(brut) as ReferentielPret) : null;
  } catch {
    return null;
  }
}

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | ReferentielPret;

/** Produits (avec leurs unités valides) et marchés proposés par le formulaire. */
export function useReferentiel() {
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });

  const charger = useCallback(async () => {
    // La copie gardée sur le téléphone s'affiche tout de suite : le formulaire sert aussi sans réseau.
    const copie = await lireLaCopie();
    setEtat(copie ?? { statut: 'chargement' });
    const [produits, marches] = await Promise.all([
      supabase.from('produits').select('id, nom, unites(id, symbole)').order('nom'),
      supabase.from('marches').select('id, nom').order('nom'),
    ]);
    if (produits.error || marches.error) {
      setEtat(copie ?? { statut: 'erreur' });
      return;
    }
    const pret: ReferentielPret = {
      statut: 'pret',
      produits: (produits.data ?? []) as Produit[],
      marches: marches.data ?? [],
    };
    AsyncStorage.setItem(CLE_COPIE, JSON.stringify(pret)).catch(() => {});
    setEtat(pret);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  return { etat, recharger: charger };
}
