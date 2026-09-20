import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type MaCollecte = {
  id: string;
  prix_total: number;
  quantite: number;
  observe_le: string;
  produits: { nom: string };
  unites: { symbole: string };
  marches: { nom: string };
};

/** Les dernières collectes du contributeur connecté (la base ne lui montre que les siennes). */
export function useMesCollectes() {
  const [collectes, setCollectes] = useState<MaCollecte[] | null>(null); // null : pas encore chargées
  const [erreur, setErreur] = useState(false);

  const recharger = useCallback(async () => {
    const { data, error } = await supabase
      .from('collectes')
      .select('id, prix_total, quantite, observe_le, produits(nom), unites(symbole), marches(nom)')
      .order('cree_le', { ascending: false })
      .limit(10);
    setErreur(Boolean(error));
    if (data) setCollectes(data as unknown as MaCollecte[]);
  }, []);

  useEffect(() => {
    recharger();
  }, [recharger]);

  return { collectes, erreur, recharger };
}
