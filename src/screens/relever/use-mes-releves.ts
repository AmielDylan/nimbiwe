import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type MonReleve = {
  id: string;
  prix_total: number;
  quantite: number;
  observe_le: string;
  produits: { nom: string };
  unites: { symbole: string };
  marches: { nom: string };
};

/** Les derniers relevés du contributeur connecté (la base ne lui montre que les siens). */
export function useMesReleves() {
  const [releves, setReleves] = useState<MonReleve[] | null>(null); // null : pas encore chargés
  const [erreur, setErreur] = useState(false);

  const recharger = useCallback(async () => {
    const { data, error } = await supabase
      .from('releves')
      .select('id, prix_total, quantite, observe_le, produits(nom), unites(symbole), marches(nom)')
      .order('cree_le', { ascending: false })
      .limit(10);
    setErreur(Boolean(error));
    if (data) setReleves(data as unknown as MonReleve[]);
  }, []);

  useEffect(() => {
    recharger();
  }, [recharger]);

  return { releves, erreur, recharger };
}
