import { useLocalSearchParams } from 'expo-router';

import { capitaliser } from '@/lib/formats';
import { DetailPrix } from '@/screens/detail-prix';

type Parametres = {
  produit_id: string;
  unite_id: string;
  marche_id: string;
  produit: string;
  marche: string;
  unite: string;
};

export default function DetailPrixRoute() {
  const p = useLocalSearchParams<Parametres>();

  return (
    <DetailPrix
      produitId={Number(p.produit_id)}
      uniteId={Number(p.unite_id)}
      marcheId={Number(p.marche_id)}
      titre={`${capitaliser(p.produit)} · ${p.marche}`}
      unite={p.unite}
    />
  );
}
