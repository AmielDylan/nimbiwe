import { StyleSheet, Text, View } from 'react-native';

import { capitaliser, formaterAnciennete, formaterMontant, formaterQuantite } from '@/lib/formats';
import { useTheme } from '@/theme';

import type { MaCollecte } from './use-mes-collectes';

export function MesCollectes({ collectes, erreur }: { collectes: MaCollecte[] | null; erreur: boolean }) {
  const theme = useTheme();

  return (
    <View style={styles.conteneur}>
      <Text style={[styles.titre, { color: theme.texte }]}>Mes dernières collectes</Text>
      {erreur && (
        <Text style={[styles.detail, { color: theme.erreur }]}>
          Impossible de charger vos collectes. Vérifiez votre connexion.
        </Text>
      )}
      {collectes?.length === 0 && (
        <Text style={[styles.detail, { color: theme.texteSecondaire }]}>Vous n'avez pas encore collecté de prix.</Text>
      )}
      {collectes?.map((collecte) => (
        <View key={collecte.id} style={[styles.carte, { backgroundColor: theme.carte }]}>
          <Text style={[styles.prix, { color: theme.texte }]}>
            {`${formaterMontant(collecte.prix_total)} FCFA pour ${formaterQuantite(collecte.quantite)} ${collecte.unites.symbole}`}
          </Text>
          <Text style={[styles.detail, { color: theme.texteSecondaire }]}>
            {`${capitaliser(collecte.produits.nom)} · ${collecte.marches.nom}`}
          </Text>
          <Text style={[styles.detail, { color: theme.texteSecondaire }]}>{formaterAnciennete(collecte.observe_le)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { gap: 8, marginTop: 8 },
  titre: { fontSize: 18, fontWeight: '700' },
  carte: { borderRadius: 12, padding: 12, gap: 2 },
  prix: { fontSize: 16, fontWeight: '600' },
  detail: { fontSize: 14 },
});
