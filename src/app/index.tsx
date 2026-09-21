import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { Prix } from '@/screens/prix';

export default function PrixRoute() {
  const router = useRouter();
  // Les onglets restent montés : on signale à l'écran chaque retour, pour qu'il
  // recharge les prix (un relevé a pu être envoyé entre-temps). Le premier
  // affichage est déjà chargé par l'écran lui-même.
  const [retours, setRetours] = useState(0);
  const premierAffichage = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (premierAffichage.current) {
        premierAffichage.current = false;
        return;
      }
      setRetours((n) => n + 1);
    }, []),
  );

  return (
    <Prix
      retours={retours}
      onOuvrirDetail={(prix) =>
        router.push({
          pathname: '/detail-prix',
          params: {
            produit_id: prix.produit_id,
            unite_id: prix.unite_id,
            marche_id: prix.marche_id,
            produit: prix.produit,
            marche: prix.marche,
            unite: prix.unite,
          },
        })
      }
    />
  );
}
