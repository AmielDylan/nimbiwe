import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme';

type Option = { id: number; libelle: string };

type Props = {
  toutLibelle: string;
  options: Option[];
  selection: number | null;
  onChoisir: (id: number | null) => void;
};

export function Filtres({ toutLibelle, options, selection, onChoisir }: Props) {
  const theme = useTheme();
  const puces = [{ id: null, libelle: toutLibelle }, ...options];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ligne}>
      {puces.map((puce) => {
        const active = puce.id === selection;
        return (
          <Pressable
            key={puce.id ?? 'tous'}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChoisir(puce.id)}
            style={[
              styles.puce,
              { backgroundColor: active ? theme.accent : theme.carte, borderColor: theme.bordure },
            ]}>
            <Text style={{ color: active ? theme.texteSurAccent : theme.texte }}>{puce.libelle}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ligne: { gap: 8, paddingVertical: 4 },
  puce: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 8 },
});
