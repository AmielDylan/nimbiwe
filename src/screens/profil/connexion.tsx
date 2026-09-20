import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Bouton } from '@/components/bouton';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

import { normaliserNumero } from './telephone';

const DELAI_AVANT_RENVOI = 30; // secondes

export function Connexion() {
  const theme = useTheme();
  const [saisie, setSaisie] = useState('');
  const [numero, setNumero] = useState<string | null>(null); // renseigné une fois le code envoyé
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [avantRenvoi, setAvantRenvoi] = useState(0);

  const decompteActif = avantRenvoi > 0;
  useEffect(() => {
    if (!decompteActif) return;
    const minuteur = setInterval(() => setAvantRenvoi((restant) => Math.max(0, restant - 1)), 1000);
    return () => clearInterval(minuteur);
  }, [decompteActif]);

  async function envoyerLeCode(destinataire: string) {
    setEnCours(true);
    setErreur(null);
    const { error } = await supabase.auth.signInWithOtp({ phone: destinataire });
    setEnCours(false);
    if (error) {
      setErreur(
        error.status === 429 || error.code === 'over_sms_send_rate_limit'
          ? 'Trop de demandes. Patientez un instant avant de redemander un code.'
          : "Impossible d'envoyer le code. Vérifiez votre connexion et réessayez.",
      );
      return false;
    }
    setNumero(destinataire);
    setAvantRenvoi(DELAI_AVANT_RENVOI);
    return true;
  }

  async function demanderLeCode() {
    const destinataire = normaliserNumero(saisie);
    if (!destinataire) {
      setErreur('Numéro invalide. Entrez votre numéro béninois, par exemple 01 97 00 00 00.');
      return;
    }
    await envoyerLeCode(destinataire);
  }

  async function verifierLeCode() {
    if (!numero) return;
    setEnCours(true);
    setErreur(null);
    const { error } = await supabase.auth.verifyOtp({ phone: numero, token: code.trim(), type: 'sms' });
    setEnCours(false);
    // En cas de succès, useSession bascule l'écran sur le profil.
    if (error) setErreur('Code incorrect ou expiré. Vérifiez le code ou demandez-en un nouveau.');
  }

  function changerDeNumero() {
    setNumero(null);
    setCode('');
    setErreur(null);
    setAvantRenvoi(0);
  }

  const champ = [styles.champ, { color: theme.texte, borderColor: theme.bordure, backgroundColor: theme.carte }];

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={styles.contenu}
      keyboardShouldPersistTaps="handled">
      {numero === null ? (
        <>
          <View style={[styles.consentement, { backgroundColor: theme.carte }]}>
            <Text style={[styles.titre, { color: theme.texte }]}>Pourquoi votre numéro de téléphone ?</Text>
            <Text style={[styles.texte, { color: theme.texteSecondaire }]}>
              Nimbiwe utilise votre numéro uniquement pour vous connecter et limiter les abus. Il n’est jamais
              montré aux autres utilisateurs. Vous pouvez consulter les prix sans vous connecter.
            </Text>
          </View>
          <Text style={[styles.etiquette, { color: theme.texte }]}>Numéro de téléphone</Text>
          <TextInput
            accessibilityLabel="Numéro de téléphone"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            placeholder="01 97 00 00 00"
            placeholderTextColor={theme.texteSecondaire}
            value={saisie}
            onChangeText={setSaisie}
            style={champ}
          />
          <Bouton libelle="Recevoir un code" onPress={demanderLeCode} disabled={enCours} />
        </>
      ) : (
        <>
          <Text style={[styles.texte, { color: theme.texte }]}>
            Entrez le code reçu par SMS au {numero}.
          </Text>
          <Text style={[styles.etiquette, { color: theme.texte }]}>Code reçu par SMS</Text>
          <TextInput
            accessibilityLabel="Code reçu par SMS"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            value={code}
            onChangeText={setCode}
            style={champ}
          />
          <Bouton libelle="Se connecter" onPress={verifierLeCode} disabled={enCours || code.trim().length === 0} />
          <Bouton
            variante="secondaire"
            libelle={avantRenvoi > 0 ? `Renvoyer le code dans ${avantRenvoi} s` : 'Renvoyer le code'}
            onPress={() => numero && envoyerLeCode(numero)}
            disabled={enCours || avantRenvoi > 0}
          />
          <Bouton variante="secondaire" libelle="Changer de numéro" onPress={changerDeNumero} />
        </>
      )}
      {erreur && <Text style={[styles.erreur, { color: theme.erreur }]}>{erreur}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: 16, gap: 12 },
  consentement: { borderRadius: 12, padding: 16, gap: 6 },
  titre: { fontSize: 17, fontWeight: '600' },
  texte: { fontSize: 15, lineHeight: 21 },
  etiquette: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  champ: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17 },
  erreur: { fontSize: 15 },
});
