import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Bouton } from '@/components/bouton';
import { ChampTexte } from '@/components/champ-texte';
import { Puces } from '@/components/puces';
import { capitaliser } from '@/lib/formats';
import { useTheme } from '@/theme';

import { MesReleves } from './mes-releves';
import { useReleve } from './use-releve';
import { useMesReleves } from './use-mes-releves';
import { type ReferentielPret, useReferentiel } from './use-referentiel';

export function Formulaire() {
  const theme = useTheme();
  const { etat, recharger } = useReferentiel();
  const mesReleves = useMesReleves();

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

  return <Saisie etat={etat} mesReleves={mesReleves} />;
}

function Saisie({
  etat,
  mesReleves,
}: {
  etat: ReferentielPret;
  mesReleves: ReturnType<typeof useMesReleves>;
}) {
  const theme = useTheme();
  const releve = useReleve(etat.produits, mesReleves.recharger);

  return (
    <ScrollView
      style={{ backgroundColor: theme.fond }}
      contentContainerStyle={styles.contenu}
      keyboardShouldPersistTaps="handled">
      <Text style={[styles.titre, { color: theme.texte }]}>Relever un prix</Text>

      <Text style={[styles.etiquette, { color: theme.texte }]}>Produit</Text>
      <Puces
        options={etat.produits.map((p) => ({ id: p.id, libelle: capitaliser(p.nom) }))}
        selection={releve.produitId}
        onChoisir={releve.choisirProduit}
      />

      <Text style={[styles.etiquette, { color: theme.texte }]}>Marché</Text>
      <Puces
        options={etat.marches.map((m) => ({ id: m.id, libelle: m.nom }))}
        selection={releve.marcheId}
        onChoisir={releve.choisirMarche}
      />

      <Text style={[styles.etiquette, { color: theme.texte }]}>Unité</Text>
      {releve.produitId === null ? (
        <Text style={[styles.texte, { color: theme.texteSecondaire }]}>Choisissez d'abord un produit.</Text>
      ) : (
        <Puces
          options={releve.unitesValides.map((u) => ({ id: u.id, libelle: u.symbole }))}
          selection={releve.uniteId}
          onChoisir={releve.choisirUnite}
        />
      )}

      <ChampTexte
        libelle="Quantité"
        keyboardType="decimal-pad"
        value={releve.quantiteSaisie}
        onChangeText={releve.saisirQuantite}
      />
      <ChampTexte
        libelle="Prix total en FCFA"
        keyboardType="number-pad"
        placeholder="450"
        value={releve.prixSaisi}
        onChangeText={releve.saisirPrix}
      />
      <Text style={[styles.texte, { color: releve.erreurPrix ? theme.erreur : theme.texteSecondaire }]}>
        {releve.erreurPrix ?? releve.libellePrix}
      </Text>

      {releve.avertissement ? (
        <View style={[styles.avertissement, { backgroundColor: theme.carte, borderColor: theme.erreur }]}>
          <Text style={[styles.texte, { color: theme.texte }]}>{releve.avertissement}</Text>
          <Bouton libelle="Confirmer ce prix" onPress={releve.confirmer} disabled={releve.envoiEnCours} />
          <Bouton variante="secondaire" libelle="Corriger" onPress={releve.corriger} />
        </View>
      ) : (
        <Bouton
          libelle="Envoyer le relevé"
          onPress={releve.envoyer}
          disabled={!releve.saisieValide || releve.envoiEnCours}
        />
      )}

      {releve.message && (
        <Text style={[styles.texte, { color: releve.message.erreur ? theme.erreur : theme.succes }]}>
          {releve.message.texte}
        </Text>
      )}

      <MesReleves releves={mesReleves.releves} erreur={mesReleves.erreur} />
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
