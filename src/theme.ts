import { useColorScheme } from 'react-native';

const clair = {
  fond: '#ffffff',
  texte: '#11181c',
  texteSecondaire: '#687076',
  accent: '#0a7ea4',
  bordure: '#e6e8eb',
};

const sombre: typeof clair = {
  fond: '#151718',
  texte: '#ecedee',
  texteSecondaire: '#9ba1a6',
  accent: '#4cc2e8',
  bordure: '#2a2d2f',
};

export function useTheme() {
  return useColorScheme() === 'dark' ? sombre : clair;
}
