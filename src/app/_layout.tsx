import { Tabs, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import AddCircle from 'reicon-react-native/icons/AddCircle';
import Tag from 'reicon-react-native/icons/Tag';
import User from 'reicon-react-native/icons/User';

import { ToastHost } from '@/components/toast-host';
import { useSession } from '@/lib/use-session';
import { useSynchronisation } from '@/lib/use-synchronisation';
import { useTheme } from '@/theme';

export default function Layout() {
  const theme = useTheme();
  const router = useRouter();
  const session = useSession();
  useSynchronisation(); // envoie les relevés saisis hors ligne dès que possible

  // `session === undefined` tant que la session enregistrée n'est pas relue (elle survient vite,
  // avant tout affichage utile) : l'onglet suppose alors « pas connecté », comme un premier
  // lancement. Un compte déjà connecté peut donc voir l'onglet passer de « Connexion » à
  // « Profil » l'instant de cette lecture ; accepté pour l'instant (projet personnel).
  const nonConnecte = !session;

  return (
    <>
      <TabsRacine theme={theme} router={router} nonConnecte={nonConnecte} />
      <ToastHost />
    </>
  );
}

type Props = { theme: ReturnType<typeof useTheme>; router: ReturnType<typeof useRouter>; nonConnecte: boolean };

function TabsRacine({ theme, router, nonConnecte }: Props) {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.texteSecondaire,
        tabBarStyle: { backgroundColor: theme.fond, borderTopColor: theme.bordure },
        headerStyle: { backgroundColor: theme.fond },
        headerTitleStyle: { color: theme.texte },
        headerShadowVisible: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Prix',
          tabBarAccessibilityLabel: 'Prix, onglet 1 sur 3',
          tabBarIcon: ({ size, focused }) => (
            <Tag color={focused ? theme.accent : theme.texteSecondaire} size={size} weight={focused ? 'Filled' : 'Outline'} />
          ),
        }}
      />
      <Tabs.Screen
        name="relever"
        options={{
          title: 'Relever',
          tabBarAccessibilityLabel: 'Relever, onglet 2 sur 3',
          tabBarIcon: ({ size, focused }) => (
            <AddCircle color={focused ? theme.accent : theme.texteSecondaire} size={size} weight={focused ? 'Filled' : 'Outline'} />
          ),
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          // Avant connexion, l'onglet mène droit au formulaire : son nom le dit.
          title: nonConnecte ? 'Connexion' : 'Profil',
          tabBarAccessibilityLabel: nonConnecte ? 'Connexion, onglet 3 sur 3' : 'Profil, onglet 3 sur 3',
          tabBarIcon: ({ size, focused }) => (
            <User color={focused ? theme.accent : theme.texteSecondaire} size={size} weight={focused ? 'Filled' : 'Outline'} />
          ),
        }}
      />
      <Tabs.Screen
        name="detail-prix"
        options={{
          title: 'Relevés récents',
          href: null, // pas d'onglet : on y arrive depuis une carte de prix
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retour aux prix"
              onPress={() => router.navigate('/')}
              style={{ paddingHorizontal: 16 }}>
              <Text style={{ color: theme.accent, fontSize: 16 }}>Retour</Text>
            </Pressable>
          ),
        }}
      />
    </Tabs>
  );
}
