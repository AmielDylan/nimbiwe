import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Bouton } from '@/components/bouton';
import { ChampTexte } from '@/components/champ-texte';
import { useTheme } from '@/theme';

import { useConnexion } from './use-connexion';

export function Connexion() {
  const theme = useTheme();
  const connexion = useConnexion();

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={styles.contenu}
      keyboardShouldPersistTaps="handled">
      {connexion.numero === null ? (
        <>
          <View style={[styles.consentement, { backgroundColor: theme.carte }]}>
            <Text style={[styles.titre, { color: theme.texte }]}>Pourquoi votre numéro de téléphone ?</Text>
            <Text style={[styles.texte, { color: theme.texteSecondaire }]}>
              Nimbiwe utilise votre numéro uniquement pour vous connecter et limiter les abus. Il n’est jamais
              montré aux autres utilisateurs. En demandant un code, vous acceptez cette utilisation. Vous pouvez
              consulter les prix sans vous connecter.
            </Text>
          </View>
          <ChampTexte
            libelle="Numéro de téléphone"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            placeholder="01 97 00 00 00"
            value={connexion.saisie}
            onChangeText={connexion.setSaisie}
          />
          <Bouton libelle="Recevoir un code" onPress={connexion.demanderLeCode} disabled={connexion.requeteEnCours} />
        </>
      ) : (
        <>
          <Text style={[styles.texte, { color: theme.texte }]}>
            Entrez le code reçu par SMS au {connexion.numero}.
          </Text>
          <ChampTexte
            libelle="Code reçu par SMS"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            value={connexion.code}
            onChangeText={connexion.setCode}
          />
          <Bouton
            libelle="Se connecter"
            onPress={connexion.verifierLeCode}
            disabled={connexion.requeteEnCours || connexion.code.trim().length === 0}
          />
          <Bouton
            variante="secondaire"
            libelle={
              connexion.avantRenvoi > 0 ? `Renvoyer le code dans ${connexion.avantRenvoi} s` : 'Renvoyer le code'
            }
            onPress={connexion.renvoyerLeCode}
            disabled={connexion.requeteEnCours || connexion.avantRenvoi > 0}
          />
          <Bouton
            variante="secondaire"
            libelle="Changer de numéro"
            onPress={connexion.changerDeNumero}
            disabled={connexion.requeteEnCours}
          />
        </>
      )}
      {connexion.erreur && <Text style={[styles.erreur, { color: theme.erreur }]}>{connexion.erreur}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: 16, gap: 12 },
  consentement: { borderRadius: 12, padding: 16, gap: 6 },
  titre: { fontSize: 17, fontWeight: '600' },
  texte: { fontSize: 15, lineHeight: 21 },
  erreur: { fontSize: 15 },
});
