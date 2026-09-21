import * as Location from 'expo-location';

/** Ce que répond le téléphone quand l'app lui demande l'autorisation puis la position. */
export function simulerPosition(options: {
  /** `en_attente` : la réponse du téléphone n'arrive que lorsque le test appelle `accorderAutorisation`. */
  autorisation?: 'accordee' | 'refusee' | 'en_attente';
  /** `en_attente` : la position n'arrive que lorsque le test appelle `fournirPosition` (ou jamais). */
  position?: { latitude: number; longitude: number } | 'indisponible' | 'en_attente';
}) {
  const { autorisation = 'accordee', position = { latitude: 6.37, longitude: 2.43 } } = options;
  let accorderAutorisation: () => void = () => {};
  let fournirPosition: (p: { latitude: number; longitude: number }) => void = () => {};
  const demanderAutorisation = Location.requestForegroundPermissionsAsync as jest.Mock;
  const lirePosition = Location.getCurrentPositionAsync as jest.Mock;

  demanderAutorisation.mockReset();
  lirePosition.mockReset();
  if (autorisation === 'en_attente') {
    demanderAutorisation.mockReturnValue(
      new Promise((resolve) => {
        accorderAutorisation = () => resolve({ status: 'granted' });
      }),
    );
  } else {
    demanderAutorisation.mockResolvedValue({ status: autorisation === 'accordee' ? 'granted' : 'denied' });
  }
  if (position === 'indisponible') {
    lirePosition.mockRejectedValue(new Error('Position indisponible'));
  } else if (position === 'en_attente') {
    lirePosition.mockReturnValue(
      new Promise((resolve) => {
        fournirPosition = (coords) => resolve({ coords });
      }),
    );
  } else {
    lirePosition.mockResolvedValue({ coords: position });
  }
  return {
    demanderAutorisation,
    lirePosition,
    accorderAutorisation: () => accorderAutorisation(),
    fournirPosition: (p: { latitude: number; longitude: number }) => fournirPosition(p),
  };
}
