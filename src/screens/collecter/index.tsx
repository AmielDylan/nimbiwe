import { ActivityIndicator, View } from 'react-native';

import { useSession } from '@/lib/use-session';
import { useTheme } from '@/theme';

import { Formulaire } from './formulaire';
import { InviteConnexion } from './invite-connexion';

export function Collecter() {
  const theme = useTheme();
  const session = useSession();

  if (session === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.fond }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }
  return session ? <Formulaire /> : <InviteConnexion />;
}
