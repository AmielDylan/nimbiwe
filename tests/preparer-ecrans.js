// Le client de données garde une référence à fetch dès sa création : on
// installe la doublure avant l'import des écrans (voir tests/ecrans/api-factice.ts).
process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://api.test';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'cle-anonyme-de-test';
global.fetch = jest.fn();
