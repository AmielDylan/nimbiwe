import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { Bouton } from '@/components/bouton';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

export function ProfilConnecte({ session }: { session: Session }) {
  const theme = useTheme();
  const utilisateurId = session.user.id;
  const [nom, setNom] = useState('');
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);

  useEffect(() => {
    let actif = true;
    supabase
      .from('profils')
      .select('nom_affiche')
      .eq('id', utilisateurId)
      .then(({ data }) => {
        if (actif) setNom(data?.[0]?.nom_affiche ?? '');
      });
    return () => {
      actif = false;
    };
  }, [utilisateurId]);

  async function enregistrer() {
    setMessage(null);
    const { error } = await supabase
      .from('profils')
      .update({ nom_affiche: nom.trim() === '' ? null : nom.trim() })
      .eq('id', utilisateurId);
    setMessage(
      error
        ? { texte: "Impossible d'enregistrer le nom. Vérifiez qu'il fait 40 caractères au plus, puis réessayez.", erreur: true }
        : { texte: 'Nom enregistré.', erreur: false },
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.fond }} contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
      <Text style={[styles.titre, { color: theme.texte }]}>Vous êtes connecté.</Text>
      <Text style={[styles.texte, { color: theme.texteSecondaire }]}>
        Votre numéro n’est jamais montré aux autres. Seul votre nom affiché l’est.
      </Text>
      <Text style={[styles.etiquette, { color: theme.texte }]}>Nom affiché</Text>
      <TextInput
        accessibilityLabel="Nom affiché"
        maxLength={40}
        value={nom}
        onChangeText={setNom}
        placeholder="Comment souhaitez-vous apparaître ?"
        placeholderTextColor={theme.texteSecondaire}
        style={[styles.champ, { color: theme.texte, borderColor: theme.bordure, backgroundColor: theme.carte }]}
      />
      <Bouton libelle="Enregistrer" onPress={enregistrer} />
      {message && (
        <Text style={[styles.texte, { color: message.erreur ? theme.erreur : theme.succes }]}>{message.texte}</Text>
      )}
      <Bouton variante="secondaire" libelle="Se déconnecter" onPress={() => supabase.auth.signOut()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: 16, gap: 12 },
  titre: { fontSize: 20, fontWeight: '700' },
  texte: { fontSize: 15, lineHeight: 21 },
  etiquette: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  champ: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17 },
});
