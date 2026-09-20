import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { normaliserNumero } from './telephone';

/** Délai avant de pouvoir redemander un code (secondes) ; le serveur applique le même en production. */
export const DELAI_AVANT_RENVOI = 60;

const MESSAGE_NUMERO_INVALIDE = 'Numéro invalide. Entrez votre numéro béninois, par exemple 01 97 00 00 00.';
const MESSAGE_ENVOI_IMPOSSIBLE = "Impossible d'envoyer le code. Vérifiez votre connexion et réessayez.";
const MESSAGE_TROP_DE_DEMANDES = 'Trop de demandes. Patientez un instant avant de redemander un code.';
const MESSAGE_CODE_REFUSE = 'Code incorrect ou expiré. Vérifiez le code ou demandez-en un nouveau.';
const MESSAGE_VERIFICATION_IMPOSSIBLE = 'Impossible de vérifier le code. Vérifiez votre connexion et réessayez.';

/** Le parcours de connexion : saisie du numéro, puis du code reçu par SMS. */
export function useConnexion() {
  const [saisie, setSaisie] = useState('');
  const [numero, setNumero] = useState<string | null>(null); // renseigné une fois le code envoyé
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [requeteEnCours, setRequeteEnCours] = useState(false);
  const [avantRenvoi, setAvantRenvoi] = useState(0);

  const decompteActif = avantRenvoi > 0;
  useEffect(() => {
    if (!decompteActif) return;
    const minuteur = setInterval(() => setAvantRenvoi((restant) => Math.max(0, restant - 1)), 1000);
    return () => clearInterval(minuteur);
  }, [decompteActif]);

  async function envoyerLeCode(destinataire: string) {
    setRequeteEnCours(true);
    setErreur(null);
    const { error } = await supabase.auth.signInWithOtp({ phone: destinataire });
    setRequeteEnCours(false);
    if (error) {
      setErreur(
        error.status === 429 || error.code === 'over_sms_send_rate_limit'
          ? MESSAGE_TROP_DE_DEMANDES
          : MESSAGE_ENVOI_IMPOSSIBLE,
      );
      return;
    }
    setNumero(destinataire);
    setAvantRenvoi(DELAI_AVANT_RENVOI);
  }

  async function demanderLeCode() {
    const destinataire = normaliserNumero(saisie);
    if (!destinataire) {
      setErreur(MESSAGE_NUMERO_INVALIDE);
      return;
    }
    await envoyerLeCode(destinataire);
  }

  async function verifierLeCode() {
    if (!numero) return;
    setRequeteEnCours(true);
    setErreur(null);
    const { error } = await supabase.auth.verifyOtp({ phone: numero, token: code.trim(), type: 'sms' });
    setRequeteEnCours(false);
    // En cas de succès, useSession bascule l'écran sur le profil.
    if (error) {
      const codeRefuse = error.status !== undefined && error.status >= 400 && error.status < 500;
      setErreur(codeRefuse ? MESSAGE_CODE_REFUSE : MESSAGE_VERIFICATION_IMPOSSIBLE);
    }
  }

  function changerDeNumero() {
    setNumero(null);
    setCode('');
    setErreur(null);
    setAvantRenvoi(0);
  }

  return {
    saisie,
    setSaisie,
    numero,
    code,
    setCode,
    erreur,
    requeteEnCours,
    avantRenvoi,
    demanderLeCode,
    verifierLeCode,
    renvoyerLeCode: () => numero && envoyerLeCode(numero),
    changerDeNumero,
  };
}
