import { Tabs } from 'expo-router';
import AddCircle from 'reicon-react-native/icons/AddCircle';
import Tag from 'reicon-react-native/icons/Tag';
import User from 'reicon-react-native/icons/User';

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
          title: 'Profil',
          tabBarAccessibilityLabel: 'Profil, onglet 3 sur 3',
          tabBarIcon: ({ size, focused }) => (
            <User color={focused ? theme.accent : theme.texteSecondaire} size={size} weight={focused ? 'Filled' : 'Outline'} />
          ),
        }}
      />
    </Tabs>
  );
}
