import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type Reaction = 'confirmation' | 'contestation';

export type ReleveRecent = {
  id: string;
  prix_total: number;
  quantite: number;
  prix_unitaire: number;
  observe_le: string;
  auteur: string;
  confirmations: number;
  contestations: number;
  conteste: boolean;
  ma_reaction: Reaction | null;
  est_le_mien: boolean;
};

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; releves: ReleveRecent[] };

// Codes de refus renvoyés par la base (voir la migration « reactions »).
const COMPTE_BLOQUE = 'NB001';
const RELEVE_DE_SOI = 'NB005';
const SESSION_REFUSEE = '42501'; // le serveur ne reconnaît plus la session

function messageDeRefus(code: string | undefined): string {
  switch (code) {
    case RELEVE_DE_SOI:
      return 'Vous ne pouvez pas réagir à votre propre relevé.';
    case SESSION_REFUSEE:
      return 'Votre session a expiré. Reconnectez-vous pour réagir à un relevé.';
    case COMPTE_BLOQUE:
      return "Votre compte ne peut plus réagir aux relevés. Contactez l'équipe Nimbiwe.";
    default:
      return 'Impossible d’enregistrer votre réaction. Vérifiez votre connexion et réessayez.';
  }
}

/** Les relevés récents d'un prix courant, et les réactions du contributeur connecté. */
export function useDetailPrix(produitId: number, uniteId: number, marcheId: number) {
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const [erreur, setErreur] = useState<string | null>(null);
  const [actualisation, setActualisation] = useState(false);
  const verrou = useRef(false); // une réaction à la fois : un double appui n'en envoie qu'une

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc('releves_recents', {
      p_produit_id: produitId,
      p_unite_id: uniteId,
      p_marche_id: marcheId,
    });
    if (error) throw error;
    return (data ?? []) as ReleveRecent[];
  }, [produitId, uniteId, marcheId]);

  const chargerPremiereFois = useCallback(async () => {
    setEtat({ statut: 'chargement' });
    try {
      setEtat({ statut: 'pret', releves: await charger() });
    } catch {
      setEtat({ statut: 'erreur' });
    }
  }, [charger]);

  useEffect(() => {
    chargerPremiereFois();
  }, [chargerPremiereFois]);

  // Tirer pour rafraîchir : on garde la liste affichée si le réseau échoue.
  const actualiser = useCallback(async () => {
    setActualisation(true);
    try {
      setEtat({ statut: 'pret', releves: await charger() });
    } catch {
      setErreur('Actualisation impossible. Vérifiez votre connexion.');
    } finally {
      setActualisation(false);
    }
  }, [charger]);

  /**
   * Confirmer ou contester. Toucher la réaction déjà choisie la retire ; toucher
   * l'autre la remplace ; sinon on la crée. Le serveur refuse le relevé de soi-même.
   */
  async function reagir(releve: ReleveRecent, type: Reaction) {
    if (verrou.current) return;
    verrou.current = true;
    setErreur(null);
    try {
      const requete = supabase.from('reactions');
      const { error } =
        releve.ma_reaction === type
          ? await requete.delete().eq('releve_id', releve.id)
          : releve.ma_reaction
            ? await requete.update({ type }).eq('releve_id', releve.id)
            : await requete.insert({ releve_id: releve.id, type });
      if (error) {
        setErreur(messageDeRefus(error.code));
        return;
      }
      setEtat({ statut: 'pret', releves: await charger() });
    } catch {
      setErreur(messageDeRefus(undefined));
    } finally {
      verrou.current = false;
    }
  }

  return { etat, erreur, actualisation, actualiser, reessayer: chargerPremiereFois, reagir };
}
