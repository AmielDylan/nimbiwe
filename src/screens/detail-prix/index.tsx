import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Bouton } from '@/components/bouton';
import { useSession } from '@/lib/use-session';
import { useTheme } from '@/theme';

import { CarteReleve } from './carte-releve';
import { useDetailPrix } from './use-detail-prix';

type Props = {
  produitId: number;
  uniteId: number;
  marcheId: number;
  /** « Maïs · Ganhi » */
  titre: string;
  unite: string;
};

export function DetailPrix({ produitId, uniteId, marcheId, titre, unite }: Props) {
  const theme = useTheme();
  const router = useRouter();
  const session = useSession();
  const { etat, erreur, actualisation, actualiser, reessayer, reagir } = useDetailPrix(produitId, uniteId, marcheId);

  const entete = (
    <View style={styles.entete}>
      <Text style={[styles.titre, { color: theme.texte }]}>{titre}</Text>
      {session === null && (
        <View style={[styles.invitation, { backgroundColor: theme.carte }]}>
          <Text style={[styles.texte, { color: theme.texte }]}>
            Connectez-vous pour confirmer ou contester un relevé.
          </Text>
          <Bouton libelle="Se connecter" onPress={() => router.navigate('/profil')} />
        </View>
      )}
      {erreur && <Text style={[styles.texte, { color: theme.erreur }]}>{erreur}</Text>}
    </View>
  );

  return (
    <FlatList
      testID="liste-releves"
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={styles.contenu}
      data={etat.statut === 'pret' ? etat.releves : []}
      keyExtractor={(releve) => releve.id}
      renderItem={({ item }) => (
        <CarteReleve releve={item} unite={unite} peutReagir={Boolean(session)} onReagir={reagir} />
      )}
      refreshControl={<RefreshControl refreshing={actualisation} onRefresh={actualiser} />}
      ListHeaderComponent={entete}
      ItemSeparatorComponent={() => <View style={styles.separateur} />}
      ListEmptyComponent={
        <View style={styles.vide}>
          {etat.statut === 'chargement' && <ActivityIndicator color={theme.accent} />}
          {etat.statut === 'erreur' && (
            <>
              <Text style={[styles.texte, { color: theme.texteSecondaire }]}>
                Impossible de charger les relevés. Vérifiez votre connexion et réessayez.
              </Text>
              <Bouton libelle="Réessayer" onPress={reessayer} />
            </>
          )}
          {etat.statut === 'pret' && (
            <Text style={[styles.texte, { color: theme.texteSecondaire }]}>Aucun relevé récent pour ce prix.</Text>
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  contenu: { padding: 16, flexGrow: 1 },
  entete: { gap: 10, marginBottom: 12 },
  titre: { fontSize: 22, fontWeight: '700' },
  invitation: { borderRadius: 12, padding: 14, gap: 10 },
  texte: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  vide: { alignItems: 'center', gap: 12, padding: 24 },
  separateur: { height: 10 },
});
