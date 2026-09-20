import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

import { capitaliser, formaterAnciennete, formaterMontant, formaterNombreDeSignalements } from './formats';
import type { PrixCourant } from './use-prix';

export function CartePrix({ prix }: { prix: PrixCourant }) {
  const theme = useTheme();

  return (
    <View testID="carte-prix" style={[styles.carte, { backgroundColor: theme.carte }]}>
      <View style={styles.entete}>
        <Text style={[styles.produit, { color: theme.texte }]}>{capitaliser(prix.produit)}</Text>
        <Text style={[styles.detail, { color: theme.texteSecondaire }]}>{prix.marche}</Text>
      </View>
      {prix.statut === 'publie' && prix.prix !== null ? (
        <Text style={[styles.prix, { color: theme.texte }]}>
          {`${formaterMontant(prix.prix)} FCFA / ${prix.unite}`}
        </Text>
      ) : (
        <Text style={[styles.pasAssez, { color: theme.texteSecondaire }]}>Pas assez de données</Text>
      )}
      <Text style={[styles.detail, { color: theme.texteSecondaire }]}>
        {formaterNombreDeSignalements(prix.nombre_signalements)}
      </Text>
      <Text style={[styles.detail, { color: theme.texteSecondaire }]}>
        {`Dernier signalement : ${formaterAnciennete(prix.dernier_signalement_le)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: 12, padding: 16, gap: 4 },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  produit: { fontSize: 18, fontWeight: '600' },
  prix: { fontSize: 22, fontWeight: '700', marginVertical: 2 },
  pasAssez: { fontSize: 17, fontWeight: '600', marginVertical: 2 },
  detail: { fontSize: 14 },
});
