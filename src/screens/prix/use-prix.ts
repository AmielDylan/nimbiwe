import { useCallback, useEffect, useMemo, useState } from 'react';

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
  nombre_collectes: number;
  derniere_collecte_le: string;
};

/** Une ligne du référentiel (marché ou produit). */
export type Reference = { id: number; nom: string };

type Donnees = { prix: PrixCourant[]; marches: Reference[]; produits: Reference[] };

/** Périodes proposées pour le calcul du prix courant, en jours. */
export const PERIODES = [1, 3, 7, 30];
const PERIODE_PAR_DEFAUT = 7;

type Etat =
  | { statut: 'chargement' }
  | { statut: 'erreur' }
  // `jours` : période sur laquelle les prix affichés ont été calculés.
  | ({ statut: 'pret'; actualisationEchouee: boolean; jours: number } & Donnees);

async function charger(jours: number): Promise<Donnees> {
  const [prix, marches, produits] = await Promise.all([
    supabase.rpc('prix_courants', { jours }).order('marche').order('produit'),
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

async function chargerEtat(jours: number): Promise<Etat> {
  return { statut: 'pret', actualisationEchouee: false, jours, ...(await charger(jours)) };
}

function messageVide(marche: boolean, produit: boolean): string {
  if (marche && produit) return 'Aucun prix pour cette sélection pour le moment.';
  if (marche) return 'Aucun prix pour ce marché pour le moment.';
  if (produit) return 'Aucun prix pour ce produit pour le moment.';
  return 'Aucun prix pour le moment.';
}

export function usePrix() {
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const [actualisation, setActualisation] = useState(false);
  const [marcheId, setMarcheId] = useState<number | null>(null);
  const [produitId, setProduitId] = useState<number | null>(null);
  const [periode, setPeriode] = useState(PERIODE_PAR_DEFAUT);

  const chargerPremiereFois = useCallback(async () => {
    setEtat({ statut: 'chargement' });
    try {
      setEtat(await chargerEtat(periode));
    } catch {
      setEtat({ statut: 'erreur' });
    }
  }, [periode]);

  // Rafraîchir ou changer de période : on garde les prix déjà affichés si le
  // réseau échoue. Renvoie faux en cas d'échec.
  const actualiser = useCallback(async (jours: number): Promise<boolean> => {
    setActualisation(true);
    try {
      setEtat(await chargerEtat(jours));
      return true;
    } catch {
      setEtat((courant) =>
        courant.statut === 'pret' ? { ...courant, actualisationEchouee: true } : { statut: 'erreur' },
      );
      return false;
    } finally {
      setActualisation(false);
    }
  }, []);

  const choisirPeriode = useCallback(
    async (jours: number) => {
      const precedente = periode;
      setPeriode(jours);
      if (!(await actualiser(jours))) setPeriode(precedente);
    },
    [periode, actualiser],
  );

  useEffect(() => {
    chargerPremiereFois();
    // Chargement initial seulement : les changements de période passent par choisirPeriode.
  }, []);

  const prixAffiches = useMemo(
    () =>
      etat.statut === 'pret'
        ? etat.prix.filter(
            (p) => (marcheId === null || p.marche_id === marcheId) && (produitId === null || p.produit_id === produitId),
          )
        : [],
    [etat, marcheId, produitId],
  );

  return {
    etat,
    actualisation,
    actualiser: () => actualiser(periode),
    reessayer: chargerPremiereFois,
    periode,
    choisirPeriode,
    marcheId,
    choisirMarche: setMarcheId,
    produitId,
    choisirProduit: setProduitId,
    prixAffiches,
    messageVide: messageVide(marcheId !== null, produitId !== null),
  };
}
