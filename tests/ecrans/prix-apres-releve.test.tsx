import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { reinitialiserLesToasts } from '@/lib/toasts';

import {
  CLE_DE_SESSION,
  marches,
  prixCourant,
  produits,
  sessionDeTest,
  simulerApi,
  type Simulation,
} from './api-factice';

beforeEach(async () => {
  reinitialiserLesToasts(); // état de module partagé entre les tests de ce fichier
  await AsyncStorage.clear();
  (globalThis.fetch as jest.Mock).mockClear();
});

function chargementsDesPrix(): number {
  return (globalThis.fetch as jest.Mock).mock.calls.filter(([adresse]) => String(adresse).includes('prix_courants'))
    .length;
}

function toucherLOnglet(nom: string) {
  fireEvent.press(screen.getByRole('button', { name: nom }));
}

async function envoyerUnReleve() {
  toucherLOnglet('Relever, onglet 2 sur 3');
  await screen.findByText('Relever un prix');
  fireEvent.press(screen.getByRole('button', { name: 'Maïs' }));
  fireEvent.press(screen.getByRole('button', { name: 'Ganhi' }));
  fireEvent.changeText(screen.getByLabelText('Prix total en FCFA'), '450');
  fireEvent.press(screen.getByRole('button', { name: 'Envoyer le relevé' }));
  await screen.findByText('Merci ! Votre relevé est enregistré.');
}

describe('après un relevé', () => {
  it("l'écran Prix montre le nouveau prix courant dès le retour sur l'onglet", async () => {
    await AsyncStorage.setItem(CLE_DE_SESSION, JSON.stringify(sessionDeTest()));
    // Le prix courant devient 500 FCFA une fois le relevé reçu par le serveur simulé.
    const api: Simulation = simulerApi(() => ({
      marches,
      produits,
      prix_courants: [prixCourant({ prix: api.releves.length > 0 ? 500 : 425 })],
    }));
    renderRouter('./src/app');
    expect(await screen.findByText('425 FCFA / kg')).toBeOnTheScreen();

    await envoyerUnReleve();
    toucherLOnglet('Prix, onglet 1 sur 3');

    expect(await screen.findByText('500 FCFA / kg')).toBeOnTheScreen();
    expect(screen.queryByText('425 FCFA / kg')).not.toBeOnTheScreen();
  });

  it("ne recharge pas les prix une seconde fois à l'ouverture de l'app", async () => {
    simulerApi({ marches, produits, prix_courants: [prixCourant({})] });

    renderRouter('./src/app');
    await screen.findByText('425 FCFA / kg');

    expect(chargementsDesPrix()).toBe(1);
  });

  it('recharge les prix à chaque retour sur l’onglet Prix', async () => {
    simulerApi({ marches, produits, prix_courants: [prixCourant({})] });
    renderRouter('./src/app');
    await screen.findByText('425 FCFA / kg');

    toucherLOnglet('Connexion, onglet 3 sur 3');
    await screen.findByLabelText('Numéro de téléphone');
    toucherLOnglet('Prix, onglet 1 sur 3');

    await screen.findByText('425 FCFA / kg');
    expect(chargementsDesPrix()).toBe(2);
  });
});
