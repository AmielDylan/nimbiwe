import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

/** Même limite que la contrainte de la base (supabase/migrations, profils_nom_affiche_valide). */
export const LONGUEUR_MAX_NOM = 40;

type Message = { texte: string; erreur: boolean };

/** Le nom affiché du contributeur connecté : lecture au chargement, enregistrement à la demande. */
export function useNomAffiche(utilisateurId: string) {
  const [nom, setNom] = useState('');
  const [message, setMessage] = useState<Message | null>(null);
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);

  useEffect(() => {
    let actif = true;
    supabase
      .from('profils')
      .select('nom_affiche')
      .eq('id', utilisateurId)
      .then(({ data }) => {
        if (actif) setNom(data?.[0]?.nom_affiche ?? '');
      });
    return () => {
      actif = false;
    };
  }, [utilisateurId]);

  function modifier(texte: string) {
    setNom(texte);
    setMessage(null);
  }

  async function enregistrer() {
    if (enregistrementEnCours) return;
    setEnregistrementEnCours(true);
    setMessage(null);
    const valeur = nom.trim();
    // `select` renvoie les lignes modifiées : aucune ligne, c'est que rien n'a été enregistré.
    const { data, error } = await supabase
      .from('profils')
      .update({ nom_affiche: valeur === '' ? null : valeur })
      .eq('id', utilisateurId)
      .select('id');
    setEnregistrementEnCours(false);
    setMessage(
      error || !data?.length
        ? {
            texte: `Impossible d'enregistrer le nom. Il doit faire ${LONGUEUR_MAX_NOM} caractères au plus ; réessayez.`,
            erreur: true,
          }
        : { texte: 'Nom enregistré.', erreur: false },
    );
  }

  return { nom, modifier, message, enregistrementEnCours, enregistrer };
}
