import { StyleSheet, Text, View } from 'react-native';

import { capitaliser, formaterAnciennete, formaterMontant, formaterQuantite } from '@/lib/formats';
import { useTheme } from '@/theme';

import type { MonReleve } from './use-mes-releves';

export function MesReleves({ releves, erreur }: { releves: MonReleve[] | null; erreur: boolean }) {
  const theme = useTheme();

  return (
    <View style={styles.conteneur}>
      <Text style={[styles.titre, { color: theme.texte }]}>Mes derniers relevés</Text>
      {erreur && (
        <Text style={[styles.detail, { color: theme.erreur }]}>
          Impossible de charger vos relevés. Vérifiez votre connexion.
        </Text>
      )}
      {releves?.length === 0 && (
        <Text style={[styles.detail, { color: theme.texteSecondaire }]}>Vous n'avez pas encore relevé de prix.</Text>
      )}
      {releves?.map((releve) => (
        <View key={releve.id} style={[styles.carte, { backgroundColor: theme.carte }]}>
          <Text style={[styles.prix, { color: theme.texte }]}>
            {`${formaterMontant(releve.prix_total)} FCFA pour ${formaterQuantite(releve.quantite)} ${releve.unites.symbole}`}
          </Text>
          <Text style={[styles.detail, { color: theme.texteSecondaire }]}>
            {`${capitaliser(releve.produits.nom)} · ${releve.marches.nom}`}
          </Text>
          <Text style={[styles.detail, { color: theme.texteSecondaire }]}>{formaterAnciennete(releve.observe_le)}</Text>
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
