import { useCallback, useEffect, useState } from 'react';

import { HORS_BORNES } from '@/lib/envoi-releve';
import { abonner, estEnEnvoi, lireFile, relancer, retirer, type ReleveEnAttente, synchroniser } from '@/lib/file-attente';

export type ReleveAffiche = ReleveEnAttente & { enEnvoi: boolean };

/** Les relevés du compte gardés sur le téléphone, avec leur statut, et ce qu'on peut en faire. */
export function useRelevesEnAttente(proprietaire: string) {
  const [releves, setReleves] = useState<ReleveAffiche[]>([]);

  const relire = useCallback(async () => {
    const file = await lireFile();
    setReleves(
      file
        .filter((r) => r.proprietaire === proprietaire)
        .map((r) => ({ ...r, enEnvoi: estEnEnvoi(r.id) })),
    );
  }, [proprietaire]);

  useEffect(() => {
    relire();
    return abonner(relire);
  }, [relire]);

  return {
    releves,
    envoyerMaintenant: () => synchroniser(proprietaire),
    supprimer: (id: string) => retirer(id),
    // Un refus définitif peut être retenté (le serveur a peut-être changé d'avis : limite du jour passée).
    reessayer: async (id: string) => {
      await relancer(id);
      await synchroniser(proprietaire);
    },
    // Prix jugé hors bornes à l'envoi : le contributeur le confirme, ou le supprime.
    confirmerLePrix: async (id: string) => {
      await relancer(id, { hors_bornes_confirme: true });
      await synchroniser(proprietaire);
    },
    aConfirmer: (releve: ReleveAffiche) => releve.refus?.code === HORS_BORNES,
  };
}
