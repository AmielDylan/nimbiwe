import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Bouton } from '@/components/bouton';
import { ChampTexte } from '@/components/champ-texte';
import { Puces } from '@/components/puces';
import { capitaliser } from '@/lib/formats';
import { useTheme } from '@/theme';

import { EnAttente } from './en-attente';
import { MesReleves } from './mes-releves';
import { useReleve } from './use-releve';
import { useRelevesEnAttente } from './use-releves-en-attente';
import { useMesReleves } from './use-mes-releves';
import { type ReferentielPret, useReferentiel } from './use-referentiel';

export function Formulaire({ proprietaire }: { proprietaire: string }) {
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

  return <Saisie etat={etat} mesReleves={mesReleves} proprietaire={proprietaire} />;
}

function Saisie({
  etat,
  mesReleves,
  proprietaire,
}: {
  etat: ReferentielPret;
  mesReleves: ReturnType<typeof useMesReleves>;
  proprietaire: string;
}) {
  const theme = useTheme();
  const releve = useReleve(etat.produits, etat.marches, proprietaire, mesReleves.recharger);
  const attente = useRelevesEnAttente(proprietaire);

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

      <View style={styles.position}>
        <Text style={[styles.etiquette, styles.libellePosition, { color: theme.texte }]}>Partager ma position</Text>
        <Switch
          accessibilityLabel="Partager ma position"
          value={releve.position.partage}
          onValueChange={releve.position.changerLePartage}
          // Figé pendant l'envoi : le résultat se rapporte à ce que le contributeur avait choisi.
          disabled={releve.envoiEnCours}
          trackColor={{ true: theme.accent }}
        />
      </View>
      <Text style={[styles.texte, { color: theme.texteSecondaire }]}>
        Facultatif. Votre position n’est jamais montrée aux autres. Elle sert seulement à vérifier que votre relevé
        vient bien du marché : un relevé avec position pèse davantage dans le prix courant.
      </Text>
      {releve.position.information && (
        <Text style={[styles.texte, { color: theme.texteSecondaire }]}>{releve.position.information}</Text>
      )}

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

      <EnAttente attente={attente} />

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
  position: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  libellePosition: { marginTop: 0 },
});
