import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Bouton } from '@/components/bouton';
import { useTheme } from '@/theme';

export function InviteConnexion() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.conteneur, { backgroundColor: theme.fond }]}>
      <Text style={[styles.titre, { color: theme.texte }]}>Relever un prix</Text>
      <Text style={[styles.texte, { color: theme.texteSecondaire }]}>Connectez-vous pour relever un prix.</Text>
      <Bouton libelle="Se connecter" onPress={() => router.navigate('/profil')} />
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16, gap: 12, justifyContent: 'center' },
  titre: { fontSize: 20, fontWeight: '700' },
  texte: { fontSize: 16, lineHeight: 22 },
});
