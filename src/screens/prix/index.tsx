import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

import { CartePrix } from './carte-prix';
import { Filtres } from './filtres';
import { capitaliser } from './formats';
import { usePrix } from './use-prix';

export function Prix() {
  const theme = useTheme();
  const {
    etat,
    actualisation,
    actualiser,
    reessayer,
    marcheId,
    choisirMarche,
    produitId,
    choisirProduit,
    prixAffiches,
    messageVide,
  } = usePrix();

  return (
    <FlatList
      testID="liste-prix"
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={styles.contenu}
      data={prixAffiches}
      keyExtractor={(p) => `${p.marche_id}-${p.produit_id}-${p.unite_id}`}
      renderItem={({ item }) => <CartePrix prix={item} />}
      refreshControl={<RefreshControl refreshing={actualisation} onRefresh={actualiser} />}
      ListHeaderComponent={
        etat.statut === 'pret' ? (
          <View style={styles.entete}>
            {etat.actualisationEchouee && (
              <Text style={[styles.avertissement, { color: theme.texteSecondaire }]}>
                Actualisation impossible. Vérifiez votre connexion.
              </Text>
            )}
            <Filtres
              toutLibelle="Tous les marchés"
              options={etat.marches.map((m) => ({ id: m.id, libelle: m.nom }))}
              selection={marcheId}
              onChoisir={choisirMarche}
            />
            <Filtres
              toutLibelle="Tous les produits"
              options={etat.produits.map((p) => ({ id: p.id, libelle: capitaliser(p.nom) }))}
              selection={produitId}
              onChoisir={choisirProduit}
            />
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.vide}>
          {etat.statut === 'chargement' && (
            <>
              <ActivityIndicator color={theme.accent} />
              <Text style={[styles.message, { color: theme.texteSecondaire }]}>Chargement des prix…</Text>
            </>
          )}
          {etat.statut === 'erreur' && (
            <>
              <Text style={[styles.message, { color: theme.texteSecondaire }]}>
                Impossible de charger les prix. Vérifiez votre connexion et réessayez.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={reessayer}
                style={[styles.bouton, { backgroundColor: theme.accent }]}>
                <Text style={{ color: theme.texteSurAccent, fontWeight: '600' }}>Réessayer</Text>
              </Pressable>
            </>
          )}
          {etat.statut === 'pret' && (
            <Text style={[styles.message, { color: theme.texteSecondaire }]}>{messageVide}</Text>
          )}
        </View>
      }
      ItemSeparatorComponent={() => <View style={styles.separateur} />}
    />
  );
}

const styles = StyleSheet.create({
  contenu: { padding: 16, flexGrow: 1 },
  entete: { gap: 4, marginBottom: 16 },
  avertissement: { fontSize: 14, marginBottom: 4 },
  vide: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  message: { fontSize: 16, textAlign: 'center' },
  bouton: { borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
  separateur: { height: 12 },
});
