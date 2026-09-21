import { useRef, useState } from 'react';

import { HORS_BORNES, type ChargeReleve, envoyerReleve, messageDeRefus } from '@/lib/envoi-releve';
import { ajouter } from '@/lib/file-attente';
import { formaterMontant, formaterQuantite } from '@/lib/formats';
import { nouvelIdentifiant } from '@/lib/identifiant';

import { usePosition } from './use-position';
import type { Marche, Produit } from './use-referentiel';

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
export function useReleve(produits: Produit[], marches: Marche[], proprietaire: string, apresEnvoi: () => void) {
  const [produitId, setProduitId] = useState<number | null>(null);
  const [marcheId, setMarcheId] = useState<number | null>(null);
  const [uniteId, setUniteId] = useState<number | null>(null);
  const [quantiteSaisie, setQuantiteSaisie] = useState('1');
  const [prixSaisi, setPrixSaisi] = useState('');
  const [message, setMessage] = useState<Message | null>(null);
  // Sens de l'écart quand le serveur juge le prix hors bornes : la confirmation est attendue.
  const [horsBornes, setHorsBornes] = useState<'haut' | 'bas' | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const position = usePosition();
  // Le state ne suffit pas contre un double appui avant le prochain rendu.
  const envoiVerrou = useRef(false);
  // Fixés au premier envoi et gardés tant que le relevé n'est ni reçu ni gardé sur le téléphone
  // (confirmation d'un prix hors bornes, nouvel essai) : un renvoi du même relevé ne peut
  // ainsi jamais en créer un second.
  const identifiant = useRef<string | null>(null);
  const saisieLe = useRef('');

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
    try {
      await tenterEnvoi(confirme);
    } finally {
      envoiVerrou.current = false;
      setEnvoiEnCours(false);
    }
  }

  async function tenterEnvoi(confirme: boolean) {
    if (!saisieValide) return;
    if (identifiant.current === null) {
      identifiant.current = nouvelIdentifiant();
      saisieLe.current = new Date().toISOString();
    }
    // La position est lue à l'envoi ; sans elle, le relevé part quand même.
    const lecture = await position.lirePosition();
    // Le client n'envoie que les champs autorisés ; le reste est décidé par le serveur.
    const charge: ChargeReleve = {
      id: identifiant.current,
      produit_id: produit.id,
      unite_id: unite.id,
      marche_id: marcheId,
      quantite,
      prix_total: prix,
      ...(lecture.position ?? {}),
      ...(confirme ? { hors_bornes_confirme: true as const } : {}),
    };
    const resultat = await envoyerReleve(charge);

    if (resultat.statut === 'reseau') {
      await garderHorsLigne(charge);
      return;
    }
    if (resultat.statut === 'envoye') {
      viderLaSaisie();
      setMessage({
        texte: lecture.demandee && lecture.position === null
          ? 'Merci ! Votre relevé est enregistré, sans position (position indisponible).'
          : 'Merci ! Votre relevé est enregistré.',
        erreur: false,
      });
      apresEnvoi();
      return;
    }
    if (resultat.code === HORS_BORNES) {
      setHorsBornes(resultat.hint === 'bas' ? 'bas' : 'haut');
      return;
    }
    setMessage({ texte: messageDeRefus(resultat.code), erreur: true });
  }

  // Pas de réseau : le relevé est gardé sur le téléphone, avec la date de la saisie.
  async function garderHorsLigne(charge: ChargeReleve) {
    try {
      await ajouter({
        ...charge,
        observe_le: saisieLe.current,
        proprietaire,
        produit: produit!.nom,
        unite: unite!.symbole,
        marche: marches.find((m) => m.id === marcheId)?.nom ?? '',
        statut: 'en_attente',
      });
    } catch {
      setMessage({
        texte: 'Impossible de garder le relevé sur le téléphone. Réessayez : votre saisie est conservée.',
        erreur: true,
      });
      return;
    }
    viderLaSaisie();
    setMessage({
      texte: 'Pas de connexion : votre relevé est conservé sur le téléphone et sera envoyé dès que le réseau revient.',
      erreur: false,
    });
  }

  // La tentative est close (reçue ou gardée sur le téléphone) : la prochaine saisie aura son identifiant.
  function viderLaSaisie() {
    identifiant.current = null;
    setHorsBornes(null);
    setPrixSaisi('');
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
    position: { partage: position.partage, information: position.information, changerLePartage: position.changerLePartage },
    corriger: () => setHorsBornes(null),
  };
}
