import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  libelle: string;
  onPress: () => void;
  disabled?: boolean;
  variante?: 'principal' | 'secondaire';
  /** État « choisi » d'un bouton à bascule (lu par les lecteurs d'écran). */
  selectionne?: boolean;
};

export function Bouton({ libelle, onPress, disabled = false, variante = 'principal', selectionne }: Props) {
  const theme = useTheme();
  const principal = variante === 'principal';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: selectionne }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.bouton,
        principal ? { backgroundColor: theme.accent } : { borderColor: theme.bordure, borderWidth: 1 },
        disabled && styles.desactive,
      ]}>
      <Text style={[styles.libelle, { color: principal ? theme.texteSurAccent : theme.texte }]}>{libelle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bouton: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center' },
  desactive: { opacity: 0.5 },
  libelle: { fontSize: 16, fontWeight: '600' },
});
