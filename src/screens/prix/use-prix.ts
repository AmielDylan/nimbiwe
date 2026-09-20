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

export function usePrix() {
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
