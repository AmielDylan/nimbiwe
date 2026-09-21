// Le client de données garde une référence à fetch dès sa création : on
// installe la doublure avant l'import des écrans (voir tests/ecrans/api-factice.ts).
process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://api.test';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'cle-anonyme-de-test';
global.fetch = jest.fn();

// La position du téléphone : commandée par chaque test (voir tests/ecrans/position-factice.ts).
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

// Stockage de la session : l'implémentation de test fournie par la bibliothèque.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
