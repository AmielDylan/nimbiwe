import * as Location from 'expo-location';

/** Ce que répond le téléphone quand l'app lui demande l'autorisation puis la position. */
export function simulerPosition(options: {
  autorisation?: 'accordee' | 'refusee';
  position?: { latitude: number; longitude: number } | 'indisponible';
}) {
  const { autorisation = 'accordee', position = { latitude: 6.37, longitude: 2.43 } } = options;
  const demanderAutorisation = Location.requestForegroundPermissionsAsync as jest.Mock;
  const lirePosition = Location.getCurrentPositionAsync as jest.Mock;

  demanderAutorisation.mockReset();
  lirePosition.mockReset();
  demanderAutorisation.mockResolvedValue({ status: autorisation === 'accordee' ? 'granted' : 'denied' });
  if (position === 'indisponible') {
    lirePosition.mockRejectedValue(new Error('Position indisponible'));
  } else {
    lirePosition.mockResolvedValue({ coords: position });
  }
  return { demanderAutorisation, lirePosition };
}
