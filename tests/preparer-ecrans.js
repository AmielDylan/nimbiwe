// Les icônes chargent leur police de façon asynchrone, ce qui provoque des
// avertissements act(...) sans rien apporter aux tests : on les remplace.
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: () => <Text /> };
});
