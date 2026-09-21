import { StyleSheet, Text, View } from 'react-native';

import { Bouton } from '@/components/bouton';
import { formaterAnciennete, formaterCompteur, formaterMontant, formaterQuantite } from '@/lib/formats';
import { useTheme } from '@/theme';

import type { Reaction, ReleveRecent } from './use-detail-prix';

type Props = {
  releve: ReleveRecent;
  unite: string;
  /** Faux quand personne n'est connecté : les compteurs restent visibles, sans boutons. */
  peutReagir: boolean;
  onReagir: (releve: ReleveRecent, type: Reaction) => void;
};

export function CarteReleve({ releve, unite, peutReagir, onReagir }: Props) {
  const theme = useTheme();

  return (
    <View testID={`carte-releve-${releve.id}`} style={[styles.carte, { backgroundColor: theme.carte }]}>
      <Text style={[styles.prix, { color: theme.texte }]}>
        {`${formaterMontant(releve.prix_total)} FCFA pour ${formaterQuantite(releve.quantite)} ${unite}`}
      </Text>
      <View style={styles.ligne}>
        <Text style={[styles.detail, { color: theme.texte }]}>{releve.auteur}</Text>
        <Text style={[styles.detail, { color: theme.texteSecondaire }]}>{formaterAnciennete(releve.observe_le)}</Text>
      </View>
      <View style={styles.ligne}>
        <Text style={[styles.detail, { color: theme.texteSecondaire }]}>
          {formaterCompteur(releve.confirmations, 'confirmation')}
        </Text>
        <Text style={[styles.detail, { color: theme.texteSecondaire }]}>
          {formaterCompteur(releve.contestations, 'contestation')}
        </Text>
      </View>
      {releve.conteste && (
        <Text style={[styles.detail, { color: theme.erreur }]}>Contesté : écarté du prix courant</Text>
      )}
      {releve.est_le_mien ? (
        <Text style={[styles.detail, { color: theme.texteSecondaire }]}>Votre relevé</Text>
      ) : (
        peutReagir && (
          <View style={styles.actions}>
            <View style={styles.action}>
              <Bouton
                libelle="Confirmer"
                variante={releve.ma_reaction === 'confirmation' ? 'principal' : 'secondaire'}
                selectionne={releve.ma_reaction === 'confirmation'}
                onPress={() => onReagir(releve, 'confirmation')}
              />
            </View>
            <View style={styles.action}>
              <Bouton
                libelle="Contester"
                variante={releve.ma_reaction === 'contestation' ? 'principal' : 'secondaire'}
                selectionne={releve.ma_reaction === 'contestation'}
                onPress={() => onReagir(releve, 'contestation')}
              />
            </View>
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: 12, padding: 14, gap: 6 },
  prix: { fontSize: 18, fontWeight: '700' },
  ligne: { flexDirection: 'row', justifyContent: 'space-between' },
  detail: { fontSize: 14 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  action: { flex: 1 },
});
