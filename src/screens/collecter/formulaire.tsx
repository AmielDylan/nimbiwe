import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Bouton } from '@/components/bouton';
import { ChampTexte } from '@/components/champ-texte';
import { Puces } from '@/components/puces';
import { capitaliser } from '@/lib/formats';
import { useTheme } from '@/theme';

import { MesCollectes } from './mes-collectes';
import { useCollecte } from './use-collecte';
import { useMesCollectes } from './use-mes-collectes';
import { type ReferentielPret, useReferentiel } from './use-referentiel';

export function Formulaire() {
  const theme = useTheme();
  const { etat, recharger } = useReferentiel();
  const mesCollectes = useMesCollectes();

  if (etat.statut === 'chargement') {
    return (
      <View style={[styles.centre, { backgroundColor: theme.fond }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }
  if (etat.statut === 'erreur') {
    return (
      <View style={[styles.centre, { backgroundColor: theme.fond }]}>
        <Text style={[styles.texte, { color: theme.texteSecondaire }]}>
          Impossible de charger le formulaire. Vérifiez votre connexion et réessayez.
        </Text>
        <Bouton libelle="Réessayer" onPress={recharger} />
      </View>
    );
  }

  return <Saisie etat={etat} mesCollectes={mesCollectes} />;
}

function Saisie({
  etat,
  mesCollectes,
}: {
  etat: ReferentielPret;
  mesCollectes: ReturnType<typeof useMesCollectes>;
}) {
  const theme = useTheme();
  const collecte = useCollecte(etat.produits, mesCollectes.recharger);

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={styles.contenu}
      keyboardShouldPersistTaps="handled">
      <Text style={[styles.titre, { color: theme.texte }]}>Collecter un prix</Text>

      <Text style={[styles.etiquette, { color: theme.texte }]}>Produit</Text>
      <Puces
        options={etat.produits.map((p) => ({ id: p.id, libelle: capitaliser(p.nom) }))}
        selection={collecte.produitId}
        onChoisir={collecte.choisirProduit}
      />

      <Text style={[styles.etiquette, { color: theme.texte }]}>Marché</Text>
      <Puces
        options={etat.marches.map((m) => ({ id: m.id, libelle: m.nom }))}
        selection={collecte.marcheId}
        onChoisir={collecte.choisirMarche}
      />

      <Text style={[styles.etiquette, { color: theme.texte }]}>Unité</Text>
      {collecte.produitId === null ? (
        <Text style={[styles.texte, { color: theme.texteSecondaire }]}>Choisissez d'abord un produit.</Text>
      ) : (
        <Puces
          options={collecte.unitesValides.map((u) => ({ id: u.id, libelle: u.symbole }))}
          selection={collecte.uniteId}
          onChoisir={collecte.choisirUnite}
        />
      )}

      <ChampTexte
        libelle="Quantité"
        keyboardType="decimal-pad"
        value={collecte.quantiteSaisie}
        onChangeText={collecte.saisirQuantite}
      />
      <ChampTexte
        libelle="Prix total en FCFA"
        keyboardType="number-pad"
        placeholder="450"
        value={collecte.prixSaisi}
        onChangeText={collecte.saisirPrix}
      />
      <Text style={[styles.texte, { color: collecte.erreurPrix ? theme.erreur : theme.texteSecondaire }]}>
        {collecte.erreurPrix ?? collecte.libellePrix}
      </Text>

      {collecte.avertissement ? (
        <View style={[styles.avertissement, { backgroundColor: theme.carte, borderColor: theme.erreur }]}>
          <Text style={[styles.texte, { color: theme.texte }]}>{collecte.avertissement}</Text>
          <Bouton libelle="Confirmer ce prix" onPress={collecte.confirmer} disabled={collecte.envoiEnCours} />
          <Bouton variante="secondaire" libelle="Corriger" onPress={collecte.corriger} />
        </View>
      ) : (
        <Bouton
          libelle="Envoyer la collecte"
          onPress={collecte.envoyer}
          disabled={!collecte.saisieValide || collecte.envoiEnCours}
        />
      )}

      {collecte.message && (
        <Text style={[styles.texte, { color: collecte.message.erreur ? theme.erreur : theme.succes }]}>
          {collecte.message.texte}
        </Text>
      )}

      <MesCollectes collectes={mesCollectes.collectes} erreur={mesCollectes.erreur} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, padding: 16, gap: 12, alignItems: 'center', justifyContent: 'center' },
  contenu: { padding: 16, gap: 8 },
  titre: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  etiquette: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  texte: { fontSize: 15, lineHeight: 21 },
  avertissement: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
});
