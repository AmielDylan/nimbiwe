import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { marches, prixCourant, produits, simulerApi } from './api-factice';

beforeEach(() => {
  simulerApi({ marches, produits, prix_courants: [prixCourant({})] });
});

describe('onglets', () => {
  it("s'ouvre sur les prix avec les trois onglets en français", async () => {
    renderRouter('./src/app');

    expect(screen.getByRole('button', { name: 'Prix, onglet 1 sur 3' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Collecter, onglet 2 sur 3' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Profil, onglet 3 sur 3' })).toBeOnTheScreen();
    expect(await screen.findByText('425 FCFA / kg')).toBeOnTheScreen();
  });

  it('affiche l’écran de chaque onglet', async () => {
    renderRouter('./src/app');
    await screen.findByText('425 FCFA / kg');

    fireEvent.press(screen.getByRole('button', { name: 'Collecter, onglet 2 sur 3' }));
    expect(screen.getByText('La collecte de prix arrive bientôt.')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Profil, onglet 3 sur 3' }));
    expect(await screen.findByText('Pourquoi votre numéro de téléphone ?')).toBeOnTheScreen();
  });
});
