import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { simulerPosition } from './position-factice';
import { CLE_DE_SESSION, marches, prixCourant, produits, sessionDeTest, simulerApi } from './api-factice';

const donnees = { marches, produits, prix_courants: [prixCourant({})] };

beforeEach(async () => {
  await AsyncStorage.clear();
});

async function ouvrirLeFormulaire() {
  await AsyncStorage.setItem(CLE_DE_SESSION, JSON.stringify(sessionDeTest()));
  renderRouter('./src/app', { initialUrl: '/relever' });
  await screen.findByRole('button', { name: 'Maïs' });
}

function partagerLaPosition(actif: boolean) {
  fireEvent(screen.getByRole('switch', { name: 'Partager ma position' }), 'valueChange', actif);
}

async function remplirEtEnvoyer() {
  fireEvent.press(screen.getByRole('button', { name: 'Maïs' }));
  fireEvent.press(screen.getByRole('button', { name: 'Ganhi' }));
  fireEvent.changeText(screen.getByLabelText('Prix total en FCFA'), '450');
  fireEvent.press(screen.getByRole('button', { name: 'Envoyer le relevé' }));
}

describe('position facultative', () => {
  it('explique que la position est facultative et jamais montrée aux autres, avant toute demande', async () => {
    const { demanderAutorisation } = simulerPosition({});
    simulerApi(donnees);

    await ouvrirLeFormulaire();

    expect(screen.getByRole('switch', { name: 'Partager ma position' })).not.toBeChecked();
    expect(screen.getByText(/Votre position n’est jamais montrée aux autres/)).toBeOnTheScreen();
    expect(screen.getByText(/pèse davantage dans le prix courant/)).toBeOnTheScreen();
    expect(demanderAutorisation).not.toHaveBeenCalled();
  });

  it("envoie le relevé sans position, et sans jamais la demander, tant que le contributeur n'a rien activé", async () => {
    const { demanderAutorisation, lirePosition } = simulerPosition({});
    const api = simulerApi(donnees);
    await ouvrirLeFormulaire();

    await remplirEtEnvoyer();

    expect(await screen.findByText('Merci ! Votre relevé est enregistré.')).toBeOnTheScreen();
    expect(api.releves).toEqual([{ produit_id: 1, unite_id: 10, marche_id: 1, quantite: 1, prix_total: 450 }]);
    expect(demanderAutorisation).not.toHaveBeenCalled();
    expect(lirePosition).not.toHaveBeenCalled();
  });

  it("demande l'autorisation à l'activation, puis joint la position lue au moment de l'envoi", async () => {
    const { demanderAutorisation } = simulerPosition({ position: { latitude: 6.37, longitude: 2.43 } });
    const api = simulerApi(donnees);
    await ouvrirLeFormulaire();

    partagerLaPosition(true);
    await screen.findByRole('switch', { name: 'Partager ma position' });
    await remplirEtEnvoyer();

    expect(await screen.findByText('Merci ! Votre relevé est enregistré.')).toBeOnTheScreen();
    expect(demanderAutorisation).toHaveBeenCalledTimes(1);
    expect(api.releves).toEqual([
      { produit_id: 1, unite_id: 10, marche_id: 1, quantite: 1, prix_total: 450, latitude: 6.37, longitude: 2.43 },
    ]);
    expect(screen.getByRole('switch', { name: 'Partager ma position' })).toBeChecked();
  });

  it("si l'autorisation est refusée, le partage reste désactivé et le relevé part quand même, sans position", async () => {
    simulerPosition({ autorisation: 'refusee' });
    const api = simulerApi(donnees);
    await ouvrirLeFormulaire();

    partagerLaPosition(true);

    expect(
      await screen.findByText('Position non partagée : le relevé sera envoyé sans position et pèsera un peu moins.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Partager ma position' })).not.toBeChecked();

    await remplirEtEnvoyer();

    expect(await screen.findByText('Merci ! Votre relevé est enregistré.')).toBeOnTheScreen();
    expect(api.releves).toEqual([{ produit_id: 1, unite_id: 10, marche_id: 1, quantite: 1, prix_total: 450 }]);
  });

  it("envoie le relevé sans position quand le téléphone n'arrive pas à la lire, en le disant", async () => {
    simulerPosition({ position: 'indisponible' });
    const api = simulerApi(donnees);
    await ouvrirLeFormulaire();
    partagerLaPosition(true);
    await screen.findByRole('switch', { name: 'Partager ma position' });

    await remplirEtEnvoyer();

    expect(
      await screen.findByText('Merci ! Votre relevé est enregistré, sans position (position indisponible).'),
    ).toBeOnTheScreen();
    expect(api.releves).toEqual([{ produit_id: 1, unite_id: 10, marche_id: 1, quantite: 1, prix_total: 450 }]);
  });

  it('cesse de joindre la position quand le contributeur désactive le partage', async () => {
    const { lirePosition } = simulerPosition({});
    const api = simulerApi(donnees);
    await ouvrirLeFormulaire();
    partagerLaPosition(true);
    await screen.findByRole('switch', { name: 'Partager ma position' });

    partagerLaPosition(false);
    await remplirEtEnvoyer();

    await screen.findByText('Merci ! Votre relevé est enregistré.');
    expect(lirePosition).not.toHaveBeenCalled();
    expect(api.releves[0]).not.toHaveProperty('latitude');
  });
});
