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

export type ResultatEnvoi =
  | { statut: 'envoye' }
  // Ni réseau, ni serveur joignable : rien n'est perdu, on réessaiera.
  | { statut: 'reseau' }
  | { statut: 'refuse'; code: string | undefined; hint?: 'haut' | 'bas' };

/**
 * Envoie un relevé. Renvoyer le même identifiant est sans danger : un relevé déjà
 * reçu est reconnu comme tel par le serveur, et compte comme envoyé.
 */
export async function envoyerReleve(charge: ChargeReleve): Promise<ResultatEnvoi> {
  const { error, status } = await supabase.from('releves').insert(charge);
  if (!error || error.code === DEJA_RECU) return { statut: 'envoye' };
  // Statut 0 : la requête n'a pas abouti (réseau coupé, délai dépassé).
  if (status === 0 || status >= 500) return { statut: 'reseau' };
  return { statut: 'refuse', code: error.code, hint: error.hint === 'bas' ? 'bas' : error.hint === 'haut' ? 'haut' : undefined };
}

/** Le message à montrer pour un refus ; `enAttente` : le relevé avait été saisi plus tôt, hors ligne. */
export function messageDeRefus(code: string | undefined, enAttente = false): string {
  switch (code) {
    case LIMITE_QUOTIDIENNE:
      return 'Vous avez atteint la limite de relevés du jour pour ce produit sur ce marché. Réessayez demain.';
    case COMPTE_BLOQUE:
      return "Votre compte ne peut plus relever de prix. Contactez l'équipe Nimbiwe.";
    case COMPTE_INCONNU:
      return "Votre compte n'est plus reconnu. Déconnectez-vous, puis reconnectez-vous depuis l'onglet Profil.";
    case DATE_INVALIDE:
      return enAttente
        ? 'Ce relevé a été saisi il y a plus de 7 jours : il ne peut plus être envoyé.'
        : 'La date de votre téléphone semble incorrecte. Vérifiez-la, puis réessayez.';
    default:
      return enAttente
        ? "Le serveur a refusé ce relevé. Vous pouvez réessayer ou le supprimer."
        : "Impossible d'envoyer le relevé. Vérifiez votre connexion et réessayez : votre saisie est conservée.";
  }
}
