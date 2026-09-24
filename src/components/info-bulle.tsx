import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import InfoCircle from 'reicon-react-native/icons/InfoCircle';

import { useTheme } from '@/theme';

/** Un petit "i" qui révèle une explication au toucher, pour ne pas l'imposer à l'écran. */
export function InfoBulle({ libelle, children }: { libelle: string; children: string }) {
  const theme = useTheme();
  const [ouverte, setOuverte] = useState(false);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: ouverte }}
        style={styles.declencheur}
        onPress={() => setOuverte((valeur) => !valeur)}>
        <InfoCircle color={theme.texteSecondaire} size={16} />
        <Text style={[styles.libelle, { color: theme.texteSecondaire }]}>{libelle}</Text>
      </Pressable>
      {ouverte && <Text style={[styles.texte, { color: theme.texteSecondaire }]}>{children}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  declencheur: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  libelle: { fontSize: 14 },
  texte: { fontSize: 14, lineHeight: 20, marginTop: 6 },
});
