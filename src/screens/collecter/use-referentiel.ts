import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type Unite = { id: number; symbole: string };
export type Produit = { id: number; nom: string; unites: Unite[] };
export type Marche = { id: number; nom: string };

export type ReferentielPret = { statut: 'pret'; produits: Produit[]; marches: Marche[] };

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | ReferentielPret;

/** Produits (avec leurs unités valides) et marchés proposés par le formulaire. */
export function useReferentiel() {
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });

  const charger = useCallback(async () => {
    setEtat({ statut: 'chargement' });
    const [produits, marches] = await Promise.all([
      supabase.from('produits').select('id, nom, unites(id, symbole)').order('nom'),
      supabase.from('marches').select('id, nom').order('nom'),
    ]);
    if (produits.error || marches.error) {
      setEtat({ statut: 'erreur' });
      return;
    }
    setEtat({ statut: 'pret', produits: (produits.data ?? []) as Produit[], marches: marches.data ?? [] });
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  return { etat, recharger: charger };
}
