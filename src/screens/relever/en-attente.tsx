import { StyleSheet, Text, View } from 'react-native';

import { Bouton } from '@/components/bouton';
import { messageDeRefus } from '@/lib/envoi-releve';
import { capitaliser, formaterAnciennete, formaterMontant, formaterQuantite } from '@/lib/formats';
import { useTheme } from '@/theme';

import type { ReleveAffiche, useRelevesEnAttente } from './use-releves-en-attente';

type Props = { attente: ReturnType<typeof useRelevesEnAttente> };

function statut(releve: ReleveAffiche, aConfirmer: boolean): string {
  if (releve.enEnvoi) return 'Envoi en cours…';
  if (releve.statut === 'en_attente') return "En attente d'envoi";
  if (aConfirmer) {
    return `Refusé : ce prix semble très ${releve.refus?.hint === 'bas' ? 'bas' : 'élevé'}. Confirmez-le ou supprimez ce relevé.`;
  }
  return `Refusé : ${messageDeRefus(releve.refus?.code, true)}`;
}

/** Les relevés saisis sans réseau et pas encore reçus par le serveur. */
export function EnAttente({ attente }: Props) {
  const theme = useTheme();
  if (attente.releves.length === 0) return null;
  const aEnvoyer = attente.releves.some((r) => r.statut === 'en_attente' && !r.enEnvoi);

  return (
    <View style={styles.conteneur}>
      <Text style={[styles.titre, { color: theme.texte }]}>Relevés en attente d’envoi</Text>
      {attente.releves.map((releve) => {
        const aConfirmer = attente.aConfirmer(releve);
        const refuse = releve.statut === 'refuse';
        return (
          <View
            key={releve.id}
            testID={`releve-en-attente-${releve.id}`}
            style={[styles.carte, { backgroundColor: theme.carte }]}>
            <Text style={[styles.prix, { color: theme.texte }]}>
              {`${formaterMontant(releve.prix_total)} FCFA pour ${formaterQuantite(releve.quantite)} ${releve.unite}`}
            </Text>
            <Text style={[styles.detail, { color: theme.texteSecondaire }]}>
              {`${capitaliser(releve.produit)} · ${releve.marche}`}
            </Text>
            <Text style={[styles.detail, { color: theme.texteSecondaire }]}>
              {`Saisi ${formaterAnciennete(releve.observe_le)}`}
            </Text>
            <Text style={[styles.detail, { color: refuse ? theme.erreur : theme.texte }]}>{statut(releve, aConfirmer)}</Text>
            {refuse && (
              <View style={styles.actions}>
                <View style={styles.action}>
                  {aConfirmer ? (
                    <Bouton libelle="Confirmer ce prix" onPress={() => attente.confirmerLePrix(releve.id)} />
                  ) : (
                    <Bouton libelle="Réessayer" onPress={() => attente.reessayer(releve.id)} />
                  )}
                </View>
                <View style={styles.action}>
                  <Bouton variante="secondaire" libelle="Supprimer" onPress={() => attente.supprimer(releve.id)} />
                </View>
              </View>
            )}
            {!refuse && !releve.enEnvoi && (
              <Bouton variante="secondaire" libelle="Supprimer" onPress={() => attente.supprimer(releve.id)} />
            )}
          </View>
        );
      })}
      {aEnvoyer && <Bouton libelle="Envoyer maintenant" onPress={attente.envoyerMaintenant} />}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { gap: 8, marginTop: 8 },
  titre: { fontSize: 18, fontWeight: '700' },
  carte: { borderRadius: 12, padding: 12, gap: 4 },
  prix: { fontSize: 16, fontWeight: '600' },
  detail: { fontSize: 14 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  action: { flex: 1 },
});
