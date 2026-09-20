import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

describe('onglets', () => {
  it("s'ouvre sur les prix avec les trois onglets en français", () => {
    renderRouter('./src/app');

    expect(screen.getByRole('button', { name: 'Prix, onglet 1 sur 3' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Signaler, onglet 2 sur 3' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Profil, onglet 3 sur 3' })).toBeOnTheScreen();
    expect(screen.getByText('Les prix arrivent bientôt.')).toBeOnTheScreen();
  });

  it('affiche un écran d’attente pour chaque onglet', () => {
    renderRouter('./src/app');

    fireEvent.press(screen.getByRole('button', { name: 'Signaler, onglet 2 sur 3' }));
    expect(screen.getByText('Le signalement de prix arrive bientôt.')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Profil, onglet 3 sur 3' }));
    expect(screen.getByText('Votre profil arrive bientôt.')).toBeOnTheScreen();
  });
});
