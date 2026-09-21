import { randomUUID } from 'expo-crypto';

/** Un identifiant unique, fixé par le téléphone à la saisie et renvoyé tel quel à chaque tentative d'envoi. */
export function nouvelIdentifiant(): string {
  return randomUUID();
}
