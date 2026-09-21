import * as Location from 'expo-location';
import { useState } from 'react';

/** Au-delà, on envoie le relevé sans position plutôt que de faire attendre le contributeur. */
const DELAI_POSITION_MS = 8000;

export type Position = { latitude: number; longitude: number };

const MESSAGE_REFUS =
  'Position non partagée : le relevé sera envoyé sans position et pèsera un peu moins.';

/**
 * Partage facultatif de la position avec le relevé. L'autorisation est demandée
 * au moment où le contributeur active le partage ; la position est lue à l'envoi.
 * Un refus, une position introuvable ou trop lente ne bloquent jamais le relevé.
 */
export function usePosition() {
  const [partage, setPartage] = useState(false);
  const [information, setInformation] = useState<string | null>(null);

  async function changerLePartage(actif: boolean) {
    setInformation(null);
    if (!actif) {
      setPartage(false);
      return;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setPartage(true);
        return;
      }
    } catch {
      // Traité comme un refus.
    }
    setPartage(false);
    setInformation(MESSAGE_REFUS);
  }

  /** La position du téléphone, ou null si le partage est désactivé ou si elle est introuvable. */
  async function lirePosition(): Promise<Position | null> {
    if (!partage) return null;
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    try {
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, refuser) => {
          minuteur = setTimeout(() => refuser(new Error('Position trop lente')), DELAI_POSITION_MS);
        }),
      ]);
      return { latitude: position.coords.latitude, longitude: position.coords.longitude };
    } catch {
      return null;
    } finally {
      clearTimeout(minuteur);
    }
  }

  return { partage, information, changerLePartage, lirePosition };
}
