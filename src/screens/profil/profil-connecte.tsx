import type { Session } from '@supabase/supabase-js';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Bouton } from '@/components/bouton';
import { ChampTexte } from '@/components/champ-texte';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

import { LONGUEUR_MAX_NOM, useNomAffiche } from './use-nom-affiche';

export function ProfilConnecte({ session }: { session: Session }) {
  const theme = useTheme();
  const { nom, modifier, message, enregistrementEnCours, enregistrer } = useNomAffiche(session.user.id);

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={styles.contenu}
      keyboardShouldPersistTaps="handled">
      <Text style={[styles.titre, { color: theme.texte }]}>Vous êtes connecté.</Text>
      <ChampTexte
        libelle="Nom affiché"
        maxLength={LONGUEUR_MAX_NOM}
        placeholder="Comment souhaitez-vous apparaître ?"
        value={nom}
        onChangeText={modifier}
      />
      <Bouton libelle="Enregistrer" onPress={enregistrer} disabled={enregistrementEnCours} />
      {message && (
        <Text style={[styles.texte, { color: message.erreur ? theme.erreur : theme.succes }]}>{message.texte}</Text>
      )}
      <Bouton variante="secondaire" libelle="Se déconnecter" onPress={() => supabase.auth.signOut()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: 16, gap: 12 },
  titre: { fontSize: 20, fontWeight: '700' },
  texte: { fontSize: 15, lineHeight: 21 },
});
