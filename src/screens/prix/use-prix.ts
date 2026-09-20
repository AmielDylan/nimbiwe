import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type PrixCourant = {
  produit_id: number;
  unite_id: number;
  marche_id: number;
  produit: string;
  unite: string;
  marche: string;
  statut: 'publie' | 'pas_assez_de_donnees';
  prix: number | null;
  nombre_signalements: number;
  derniere_observation: string;
};

export type Element = { id: number; nom: string };

type Donnees = { prix: PrixCourant[]; marches: Element[]; produits: Element[] };

type Etat =
  | { statut: 'chargement' }
  | { statut: 'erreur' }
  | ({ statut: 'pret'; actualisationEchouee: boolean } & Donnees);

async function charger(): Promise<Donnees> {
  const [prix, marches, produits] = await Promise.all([
    supabase.from('prix_courants').select('*').order('marche').order('produit'),
    supabase.from('marches').select('id, nom').order('nom'),
    supabase.from('produits').select('id, nom').order('nom'),
  ]);
  const erreur = prix.error ?? marches.error ?? produits.error;
  if (erreur) throw erreur;
  return {
    prix: (prix.data ?? []) as PrixCourant[],
    marches: marches.data ?? [],
    produits: produits.data ?? [],
  };
}

export function usePrix() {
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const [actualisation, setActualisation] = useState(false);

  const chargerPremiereFois = useCallback(async () => {
    setEtat({ statut: 'chargement' });
    try {
      setEtat({ statut: 'pret', actualisationEchouee: false, ...(await charger()) });
    } catch {
      setEtat({ statut: 'erreur' });
    }
  }, []);

  // Tirer pour rafraîchir : on garde les prix déjà affichés si le réseau échoue.
  const actualiser = useCallback(async () => {
    setActualisation(true);
    try {
      setEtat({ statut: 'pret', actualisationEchouee: false, ...(await charger()) });
    } catch {
      setEtat((courant) =>
        courant.statut === 'pret' ? { ...courant, actualisationEchouee: true } : { statut: 'erreur' },
      );
    } finally {
      setActualisation(false);
    }
  }, []);

  useEffect(() => {
    chargerPremiereFois();
  }, [chargerPremiereFois]);

  return { etat, actualisation, actualiser, reessayer: chargerPremiereFois };
}
