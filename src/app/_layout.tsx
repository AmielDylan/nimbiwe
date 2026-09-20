import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useTheme } from '@/theme';

export default function Layout() {
  const theme = useTheme();

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
          tabBarIcon: ({ color, size }) => <Ionicons name="pricetag-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="collecter"
        options={{
          title: 'Collecter',
          tabBarAccessibilityLabel: 'Collecter, onglet 2 sur 3',
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarAccessibilityLabel: 'Profil, onglet 3 sur 3',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
