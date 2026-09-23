import { useEffect, useState } from 'react';

/**
 * Confirmations éphémères (nom enregistré, relevé envoyé…), affichées en toast plutôt
 * qu'en texte fixe sous un bouton. Réservé aux succès ; une erreur reste un texte affiché
 * dans l'écran, souvent accompagné d'une action (Réessayer), donc pas éphémère.
 *
 * Écrit à la main (pas de bibliothèque tierce) : la seule bibliothèque d'animation testée
 * ici (Reanimated v4 + react-native-worklets) ne fonctionne pas sous Jest avec
 * expo-router/testing-library (son chargement des routes contourne les doublures de test —
 * constaté en marge du ticket #26). `Animated`, natif à React Native, n'a pas ce problème.
 */

export type Toast = { id: number; message: string };

const DUREE_AFFICHAGE_MS = 3000;

let compteur = 0;
let toasts: Toast[] = [];
const ecouteurs = new Set<(toasts: Toast[]) => void>();

function notifierEcouteurs() {
  ecouteurs.forEach((ecouteur) => ecouteur(toasts));
}

function retirer(id: number) {
  toasts = toasts.filter((toast) => toast.id !== id);
  notifierEcouteurs();
}

export const notifier = {
  succes(message: string) {
    const id = ++compteur;
    toasts = [...toasts, { id, message }];
    notifierEcouteurs();
    setTimeout(() => retirer(id), DUREE_AFFICHAGE_MS);
  },
};

/** Les toasts affichés, tenus à jour (pour le composant `ToastHost`). */
export function useToasts(): Toast[] {
  const [liste, setListe] = useState(toasts);
  useEffect(() => {
    ecouteurs.add(setListe);
    return () => {
      ecouteurs.delete(setListe);
    };
  }, []);
  return liste;
}

/** Entre deux tests : la liste des toasts est un état de module, partagé sinon. */
export function reinitialiserLesToasts() {
  toasts = [];
  notifierEcouteurs();
}
