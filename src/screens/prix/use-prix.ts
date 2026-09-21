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
  nombre_releves: number;
  dernier_releve_le: string;
  /** Équivalent en unité standard d'une mesure locale, quand un facteur de conversion est connu. */
  prix_converti: number | null;
  unite_convertie: string | null;
};

/** Une ligne du référentiel (marché ou produit). */
export type Reference = { id: number; nom: string };

type Donnees = { prix: PrixCourant[]; marches: Reference[]; produits: Reference[] };

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

async function chargerEtat(): Promise<Etat> {
  return { statut: 'pret', actualisationEchouee: false, ...(await charger()) };
}

function messageVide(marche: boolean, produit: boolean): string {
  if (marche && produit) return 'Aucun prix pour cette sélection pour le moment.';
  if (marche) return 'Aucun prix pour ce marché pour le moment.';
  if (produit) return 'Aucun prix pour ce produit pour le moment.';
  return 'Aucun prix pour le moment.';
}

/** `retours` : nombre de retours sur l'onglet ; chaque retour recharge les prix. */
export function usePrix(retours = 0) {
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const [actualisation, setActualisation] = useState(false);
  const [marcheId, setMarcheId] = useState<number | null>(null);
  const [produitId, setProduitId] = useState<number | null>(null);

  const chargerPremiereFois = useCallback(async () => {
    setEtat({ statut: 'chargement' });
    try {
      setEtat(await chargerEtat());
    } catch {
      setEtat({ statut: 'erreur' });
    }
  }, []);

  // Tirer pour rafraîchir : on garde les prix déjà affichés si le réseau échoue.
  const actualiser = useCallback(async () => {
    setActualisation(true);
    try {
      setEtat(await chargerEtat());
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

  // Retour sur l'onglet : on recharge en gardant les prix déjà affichés.
  useEffect(() => {
    if (retours > 0) actualiser();
  }, [retours, actualiser]);

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
    actualiser,
    reessayer: chargerPremiereFois,
    marcheId,
    choisirMarche: setMarcheId,
    produitId,
    choisirProduit: setProduitId,
    prixAffiches,
    messageVide: messageVide(marcheId !== null, produitId !== null),
  };
}
