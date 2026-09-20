// Les icônes chargent leur police de façon asynchrone, ce qui provoque des
// avertissements act(...) sans rien apporter aux tests : on les remplace.
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: () => <Text /> };
});

// Le client de données garde une référence à fetch dès sa création : on
// installe la doublure avant l'import des écrans (voir tests/ecrans/api-factice.ts).
process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://api.test';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'cle-anonyme-de-test';
global.fetch = jest.fn();
