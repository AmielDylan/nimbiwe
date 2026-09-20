import { StyleSheet, Text, TextInput, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme';

/** Un champ de saisie avec son étiquette, qui sert aussi de libellé d'accessibilité. */
export function ChampTexte({ libelle, style, ...props }: TextInputProps & { libelle: string }) {
  const theme = useTheme();

  return (
    <>
      <Text style={[styles.etiquette, { color: theme.texte }]}>{libelle}</Text>
      <TextInput
        accessibilityLabel={libelle}
        placeholderTextColor={theme.texteSecondaire}
        style={[styles.champ, { color: theme.texte, borderColor: theme.bordure, backgroundColor: theme.carte }, style]}
        {...props}
      />
    </>
  );
}

const styles = StyleSheet.create({
  etiquette: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  champ: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17 },
});
