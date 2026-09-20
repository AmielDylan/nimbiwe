import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export function EcranAttente({ message }: { message: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.conteneur, { backgroundColor: theme.fond }]}>
      <Text style={[styles.message, { color: theme.texteSecondaire }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { fontSize: 16, textAlign: 'center' },
});
