import * as Location from 'expo-location';
import { useRef, useState } from 'react';

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
  // Le choix le plus récent fait foi, même si une réponse du téléphone arrive après coup.
  const partageActuel = useRef(false);
  const derniereDemande = useRef(0);

  async function changerLePartage(actif: boolean) {
    const demande = ++derniereDemande.current;
    setInformation(null);
    if (!actif) {
      partageActuel.current = false;
      setPartage(false);
      return;
    }
    let accorde = false;
    try {
      accorde = (await Location.requestForegroundPermissionsAsync()).status === 'granted';
    } catch {
      // Traité comme un refus.
    }
    if (demande !== derniereDemande.current) return; // une bascule plus récente a la priorité
    partageActuel.current = accorde;
    setPartage(accorde);
    if (!accorde) setInformation(MESSAGE_REFUS);
  }

  /**
   * La position du téléphone si le partage est actif. `demandee` dit si le
   * contributeur voulait la partager, pour signaler qu'elle a manqué.
   */
  async function lirePosition(): Promise<{ position: Position | null; demandee: boolean }> {
    if (!partageActuel.current) return { position: null, demandee: false };
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    try {
      const lecture = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, refuser) => {
          minuteur = setTimeout(() => refuser(new Error('Position trop lente')), DELAI_POSITION_MS);
        }),
      ]);
      return { position: { latitude: lecture.coords.latitude, longitude: lecture.coords.longitude }, demandee: true };
    } catch {
      return { position: null, demandee: true };
    } finally {
      clearTimeout(minuteur);
    }
  }

  return { partage, information, changerLePartage, lirePosition };
}
