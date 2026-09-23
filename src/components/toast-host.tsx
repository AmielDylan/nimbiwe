import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { useToasts } from '@/lib/toasts';
import { useTheme } from '@/theme';

function ToastUnique({ message }: { message: string }) {
  const theme = useTheme();
  const opacite = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacite, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [opacite]);

  return (
    <Animated.View style={[styles.toast, { backgroundColor: theme.texte, opacity: opacite }]}>
      <Text accessibilityLiveRegion="polite" style={[styles.texte, { color: theme.fond }]}>
        {message}
      </Text>
    </Animated.View>
  );
}

/** Monté une seule fois, à la racine de l'app (`src/app/_layout.tsx`). */
export function ToastHost() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;

  return (
    <View pointerEvents="none" style={styles.conteneur}>
      {toasts.map((toast) => (
        <ToastUnique key={toast.id} message={toast.message} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { position: 'absolute', left: 16, right: 16, bottom: 32, gap: 8 },
  toast: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  texte: { fontSize: 15, textAlign: 'center' },
});
