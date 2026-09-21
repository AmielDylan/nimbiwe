import { supabase } from '@/lib/supabase';

// Codes de refus renvoyés par la base (voir les migrations « relever_un_prix » et « releves_hors_ligne »).
export const COMPTE_BLOQUE = 'NB001';
export const LIMITE_QUOTIDIENNE = 'NB002';
export const HORS_BORNES = 'NB003';
export const DATE_INVALIDE = 'NB004';
// Doublon : la base a déjà reçu ce relevé (même identifiant).
const DEJA_RECU = '23505';
// Clé étrangère : le compte (ou son profil) n'existe plus côté serveur.
export const COMPTE_INCONNU = '23503';

/** Ce que le téléphone envoie : les seuls champs autorisés, plus l'identifiant fixé à la saisie. */
export type ChargeReleve = {
  id: string;
  produit_id: number;
  unite_id: number;
  marche_id: number;
  quantite: number;
  prix_total: number;
  /** Date de la saisie ; absente à l'envoi immédiat, où le serveur pose sa propre heure. */
  observe_le?: string;
  latitude?: number;
  longitude?: number;
  hors_bornes_confirme?: true;
};

/** Sens de l'écart quand le serveur juge un prix hors bornes. */
export type Sens = 'haut' | 'bas';

export type ResultatEnvoi =
  | { statut: 'envoye' }
  // Ni réseau, ni serveur joignable : rien n'est perdu, on réessaiera.
  | { statut: 'reseau' }
  | { statut: 'refuse'; code: string | undefined; hint?: Sens };

/**
 * Envoie un relevé. Renvoyer le même identifiant est sans danger : un relevé déjà
 * reçu est reconnu comme tel par le serveur, et compte comme envoyé.
 */
export async function envoyerReleve(charge: ChargeReleve): Promise<ResultatEnvoi> {
  const { error, status } = await supabase.from('releves').insert(charge);
  if (!error || error.code === DEJA_RECU) return { statut: 'envoye' };
  // Statut 0 : la requête n'a pas abouti (réseau coupé, délai dépassé).
  // 408 et 429 : le serveur demande d'attendre, ce n'est pas un refus du relevé.
  if (status === 0 || status >= 500 || status === 408 || status === 429) return { statut: 'reseau' };
  const hint = error.hint === 'haut' || error.hint === 'bas' ? error.hint : undefined;
  return { statut: 'refuse', code: error.code, hint };
}

// Ancienneté maximale d'une date d'observation : valeur par défaut du serveur (`releve_anciennete_max_jours`).
const JOURS_MAX = 7;

/**
 * Le message à montrer pour un refus. `saisiLe` : la date de saisie d'un relevé gardé sur le
 * téléphone (il avait été saisi plus tôt, hors ligne).
 */
export function messageDeRefus(code: string | undefined, saisiLe?: string): string {
  const enAttente = saisiLe !== undefined;
  switch (code) {
    case LIMITE_QUOTIDIENNE:
      return 'Vous avez atteint la limite de relevés du jour pour ce produit sur ce marché. Réessayez dans quelques heures.';
    case COMPTE_BLOQUE:
      return "Votre compte ne peut plus relever de prix. Contactez l'équipe Nimbiwe.";
    case COMPTE_INCONNU:
      return "Votre compte n'est plus reconnu. Déconnectez-vous, puis reconnectez-vous depuis l'onglet Profil.";
    case DATE_INVALIDE:
      if (!enAttente) return 'La date de votre téléphone semble incorrecte. Vérifiez-la, puis réessayez.';
      return Date.now() - new Date(saisiLe).getTime() > JOURS_MAX * 24 * 60 * 60 * 1000
        ? `Ce relevé a été saisi il y a plus de ${JOURS_MAX} jours : il ne peut plus être envoyé.`
        : "La date de saisie de ce relevé n'est pas acceptée (l'horloge du téléphone était peut-être mal réglée). Supprimez-le, puis relevez de nouveau.";
    default:
      return enAttente
        ? "Le serveur a refusé ce relevé. Vous pouvez réessayer ou le supprimer."
        : "Impossible d'envoyer le relevé. Vérifiez votre connexion et réessayez : votre saisie est conservée.";
  }
}
