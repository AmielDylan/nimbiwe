import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { CLE_DE_SESSION, marches, prixCourant, produits, sessionDeTest, simulerApi } from './api-factice';

beforeEach(async () => {
  await AsyncStorage.clear();
  simulerApi({ marches, produits, prix_courants: [prixCourant({})] });
});

describe('onglets', () => {
  it("s'ouvre sur les prix avec les trois onglets en français", async () => {
    renderRouter('./src/app');

    expect(screen.getByRole('button', { name: 'Prix, onglet 1 sur 3' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Relever, onglet 2 sur 3' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Connexion, onglet 3 sur 3' })).toBeOnTheScreen();
    expect(await screen.findByText('425 FCFA / kg')).toBeOnTheScreen();
  });

  it('affiche l’écran de chaque onglet', async () => {
    renderRouter('./src/app');
    await screen.findByText('425 FCFA / kg');

    fireEvent.press(screen.getByRole('button', { name: 'Relever, onglet 2 sur 3' }));
    expect(await screen.findByText('Connectez-vous pour relever un prix.')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Connexion, onglet 3 sur 3' }));
    expect(await screen.findByLabelText('Numéro de téléphone')).toBeOnTheScreen();
  });

  it("nomme l'onglet « Profil » une fois connecté", async () => {
    await AsyncStorage.setItem(CLE_DE_SESSION, JSON.stringify(sessionDeTest()));

    renderRouter('./src/app');

    expect(await screen.findByRole('button', { name: 'Profil, onglet 3 sur 3' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Connexion, onglet/ })).not.toBeOnTheScreen();
  });
});
