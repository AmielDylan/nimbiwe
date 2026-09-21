import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { Prix } from '@/screens/prix';

export default function PrixRoute() {
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

  return <Prix retours={retours} />;
}
