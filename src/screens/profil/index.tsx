import { ActivityIndicator, View } from 'react-native';

import { useSession } from '@/lib/use-session';
import { useTheme } from '@/theme';

import { Connexion } from './connexion';
import { ProfilConnecte } from './profil-connecte';

export function Profil() {
  const theme = useTheme();
  const session = useSession();

  if (session === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.fond }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }
  return session ? <ProfilConnecte session={session} /> : <Connexion />;
}
