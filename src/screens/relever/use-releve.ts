import { useRef, useState } from 'react';

import { formaterMontant, formaterQuantite } from '@/lib/formats';
import { supabase } from '@/lib/supabase';

import type { Produit } from './use-referentiel';

// Codes de refus renvoyés par la base (voir la migration « relever_un_prix »).
const COMPTE_BLOQUE = 'NB001';
const LIMITE_QUOTIDIENNE = 'NB002';
const HORS_BORNES = 'NB003';
const DATE_INVALIDE = 'NB004';
// Clé étrangère : le compte (ou son profil) n'existe plus côté serveur.
const COMPTE_INCONNU = '23503';

type Message = { texte: string; erreur: boolean };

// Mêmes plafonds que les contraintes de la table `releves`.
const PRIX_MAX = 99_999_999;
const QUANTITE_MAX = 99_999;

/** Un nombre écrit en chiffres, avec ou sans décimales ; NaN sinon (« 0x10 » et « 1e3 » sont refusés). */
function nombre(saisie: string, decimales: boolean): number {
  const propre = saisie.trim().replace(/\s/g, '');
  const forme = decimales ? /^\d+([.,]\d+)?$/ : /^\d+$/;
  return forme.test(propre) ? Number(propre.replace(',', '.')) : Number.NaN;
}

/** Le formulaire de relevé : saisie, garde-fous du serveur et envoi. */
export function useReleve(produits: Produit[], apresEnvoi: () => void) {
  const [produitId, setProduitId] = useState<number | null>(null);
  const [marcheId, setMarcheId] = useState<number | null>(null);
  const [uniteId, setUniteId] = useState<number | null>(null);
  const [quantiteSaisie, setQuantiteSaisie] = useState('1');
  const [prixSaisi, setPrixSaisi] = useState('');
  const [message, setMessage] = useState<Message | null>(null);
  // Sens de l'écart quand le serveur juge le prix hors bornes : la confirmation est attendue.
  const [horsBornes, setHorsBornes] = useState<'haut' | 'bas' | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  // Le state ne suffit pas contre un double appui avant le prochain rendu.
  const envoiVerrou = useRef(false);

  const produit = produits.find((p) => p.id === produitId) ?? null;
  const unitesValides = produit?.unites ?? [];
  const unite = unitesValides.find((u) => u.id === uniteId) ?? null;
  const quantite = nombre(quantiteSaisie, true);
  const prix = nombre(prixSaisi, false);
  const quantiteValide = quantite > 0 && quantite <= QUANTITE_MAX;
  const prixValide = prix > 0 && prix <= PRIX_MAX;
  const saisieValide = produit !== null && marcheId !== null && unite !== null && quantiteValide && prixValide;
  const erreurPrix =
    prixSaisi.trim() !== '' && !prixValide ? 'Entrez un prix entier en FCFA, sans décimales.' : null;

  // Toute modification annule l'avertissement et le message : la confirmation
  // ne vaut que pour la saisie affichée quand elle a été demandée.
  function apresModification() {
    setHorsBornes(null);
    setMessage(null);
  }

  // La saisie est figée pendant l'envoi : le résultat se rapporte à ce qui a été envoyé.
  function modifiable(): boolean {
    return !envoiVerrou.current;
  }

  function choisirProduit(id: number | null) {
    if (!modifiable()) return;
    const choisi = produits.find((p) => p.id === id);
    setProduitId(id);
    // Une seule unité valide : elle est choisie d'office ; sinon le contributeur choisit.
    setUniteId(choisi?.unites.length === 1 ? choisi.unites[0].id : null);
    apresModification();
  }

  function choisirMarche(id: number | null) {
    if (!modifiable()) return;
    setMarcheId(id);
    apresModification();
  }

  function choisirUnite(id: number | null) {
    if (!modifiable()) return;
    setUniteId(id);
    apresModification();
  }

  function saisirQuantite(saisie: string) {
    if (!modifiable()) return;
    setQuantiteSaisie(saisie);
    apresModification();
  }

  function saisirPrix(saisie: string) {
    if (!modifiable()) return;
    setPrixSaisi(saisie);
    apresModification();
  }

  async function envoyer(confirme = false) {
    if (!saisieValide || envoiVerrou.current) return;
    envoiVerrou.current = true;
    setEnvoiEnCours(true);
    setMessage(null);
    // Le client n'envoie que les champs autorisés ; le reste est décidé par le serveur.
    const { error } = await supabase.from('releves').insert({
      produit_id: produit.id,
      unite_id: unite.id,
      marche_id: marcheId,
      quantite,
      prix_total: prix,
      ...(confirme ? { hors_bornes_confirme: true } : {}),
    });
    envoiVerrou.current = false;
    setEnvoiEnCours(false);

    if (!error) {
      setHorsBornes(null);
      setPrixSaisi('');
      setMessage({ texte: 'Merci ! Votre relevé est enregistré.', erreur: false });
      apresEnvoi();
      return;
    }
    if (error.code === HORS_BORNES) {
      setHorsBornes(error.hint === 'bas' ? 'bas' : 'haut');
      return;
    }
    setMessage({ texte: messageDeRefus(error.code), erreur: true });
  }

  const avertissement =
    horsBornes && unite
      ? `Ce prix semble très ${horsBornes === 'bas' ? 'bas' : 'élevé'} pour ce produit. Est-ce bien ${formaterMontant(prix)} FCFA pour ${formaterQuantite(quantite)} ${unite.symbole} ?`
      : null;

  return {
    produitId,
    marcheId,
    uniteId,
    unitesValides,
    quantiteSaisie,
    prixSaisi,
    libellePrix: unite && quantite > 0 ? `Prix total pour ${formaterQuantite(quantite)} ${unite.symbole}` : 'Prix total',
    saisieValide,
    envoiEnCours,
    message,
    avertissement,
    choisirProduit,
    choisirMarche,
    choisirUnite,
    saisirQuantite,
    saisirPrix,
    envoyer: () => envoyer(false),
    // La confirmation n'a de sens que face à l'avertissement affiché.
    confirmer: () => horsBornes !== null && envoyer(true),
    erreurPrix,
    corriger: () => setHorsBornes(null),
  };
}

function messageDeRefus(code: string | undefined): string {
  switch (code) {
    case LIMITE_QUOTIDIENNE:
      return 'Vous avez atteint la limite de relevés du jour pour ce produit sur ce marché. Réessayez demain.';
    case COMPTE_BLOQUE:
      return "Votre compte ne peut plus relever de prix. Contactez l'équipe Nimbiwe.";
    case COMPTE_INCONNU:
      return "Votre compte n'est plus reconnu. Déconnectez-vous, puis reconnectez-vous depuis l'onglet Profil.";
    case DATE_INVALIDE:
      return "La date de votre téléphone semble incorrecte. Vérifiez-la, puis réessayez.";
    default:
      return "Impossible d'envoyer le relevé. Vérifiez votre connexion et réessayez : votre saisie est conservée.";
  }
}
