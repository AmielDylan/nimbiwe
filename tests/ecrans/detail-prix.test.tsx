import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';

import {
  CLE_DE_SESSION,
  ilYaSecondes,
  marches,
  prixCourant,
  produits,
  sessionDeTest,
  simulerApi,
  type ReleveRecent,
} from './api-factice';

const releve = (surcharge: Partial<ReleveRecent>): ReleveRecent => ({
  id: 'r1',
  prix_total: 450,
  quantite: 1,
  prix_unitaire: 450,
  observe_le: ilYaSecondes(2 * 3600 + 60),
  auteur: 'Adjovi',
  confirmations: 2,
  contestations: 1,
  conteste: false,
  est_le_mien: false,
  ...surcharge,
});

const r1 = releve({});
const r2 = releve({ id: 'r2', prix_total: 900, quantite: 2, prix_unitaire: 450, auteur: 'Olivia', confirmations: 0, contestations: 0 });
const donnees = { marches, produits, prix_courants: [prixCourant({})], releves_recents: [r1, r2] };

beforeEach(async () => {
  await AsyncStorage.clear();
});

async function ouvrirLeDetail(connecte = true) {
  if (connecte) await AsyncStorage.setItem(CLE_DE_SESSION, JSON.stringify(sessionDeTest()));
  const rendu = renderRouter('./src/app');
  fireEvent.press(await screen.findByRole('button', { name: 'Voir les relevés récents de maïs à Ganhi' }));
  await screen.findByText('Maïs · Ganhi');
  return rendu;
}

const carte = (id: string) => within(screen.getByTestId(`carte-releve-${id}`));

describe('détail d’un prix', () => {
  it("s'ouvre depuis une carte de prix et liste les relevés récents avec l'auteur et les compteurs", async () => {
    simulerApi(donnees);

    await ouvrirLeDetail();

    expect(await screen.findByText('Adjovi')).toBeOnTheScreen();
    expect(carte('r1').getByText('450 FCFA pour 1 kg')).toBeOnTheScreen();
    expect(carte('r1').getByText('il y a 2 h')).toBeOnTheScreen();
    expect(carte('r1').getByText('2 confirmations')).toBeOnTheScreen();
    expect(carte('r1').getByText('1 contestation')).toBeOnTheScreen();
    expect(carte('r2').getByText('Olivia')).toBeOnTheScreen();
    expect(carte('r2').getByText('900 FCFA pour 2 kg')).toBeOnTheScreen();
    expect(carte('r2').getByText('0 confirmation')).toBeOnTheScreen();
  });

  it('dit quand aucun relevé récent ne correspond', async () => {
    simulerApi({ ...donnees, releves_recents: [] });

    await ouvrirLeDetail();

    expect(await screen.findByText('Aucun relevé récent pour ce prix.')).toBeOnTheScreen();
  });

  it('dit quand les relevés ne se chargent pas, et permet de réessayer', async () => {
    simulerApi(donnees, { relevesRecentsEnPanne: true });
    await ouvrirLeDetail();

    expect(
      await screen.findByText('Impossible de charger les relevés. Vérifiez votre connexion et réessayez.'),
    ).toBeOnTheScreen();

    simulerApi(donnees);
    fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Adjovi')).toBeOnTheScreen();
  });

  it("signale qu'un relevé contesté est écarté du prix courant", async () => {
    simulerApi({ ...donnees, releves_recents: [releve({ contestations: 3, conteste: true })] });

    await ouvrirLeDetail();

    expect(await screen.findByText('Contesté : écarté du prix courant')).toBeOnTheScreen();
  });
});

describe('sans compte', () => {
  it('invite à se connecter avant de réagir, et ne propose aucun bouton de réaction', async () => {
    simulerApi(donnees);
    const { getPathname } = await ouvrirLeDetail(false);

    expect(await screen.findByText('Connectez-vous pour confirmer ou contester un relevé.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Confirmer' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Contester' })).not.toBeOnTheScreen();
    expect(screen.getByText('2 confirmations')).toBeOnTheScreen(); // les compteurs restent visibles

    fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('Pourquoi votre numéro de téléphone ?')).toBeOnTheScreen();
    expect(getPathname()).toBe('/profil');
  });
});

describe('réagir', () => {
  it("confirme le relevé d'un autre et met le compteur à jour", async () => {
    const api = simulerApi(donnees);
    await ouvrirLeDetail();
    await screen.findByText('Adjovi');

    fireEvent.press(carte('r1').getByRole('button', { name: 'Confirmer' }));

    expect(await carte('r1').findByText('3 confirmations')).toBeOnTheScreen();
    expect(api.reactions).toEqual([{ methode: 'POST', releve_id: 'r1', type: 'confirmation' }]);
    expect(carte('r1').getByRole('button', { name: 'Confirmer' })).toBeSelected();
    expect(carte('r1').getByRole('button', { name: 'Contester' })).not.toBeSelected();
  });

  it('conteste le relevé d’un autre', async () => {
    const api = simulerApi(donnees);
    await ouvrirLeDetail();
    await screen.findByText('Adjovi');

    fireEvent.press(carte('r2').getByRole('button', { name: 'Contester' }));

    expect(await carte('r2').findByText('1 contestation')).toBeOnTheScreen();
    expect(api.reactions).toEqual([{ methode: 'POST', releve_id: 'r2', type: 'contestation' }]);
  });

  it('change sa réaction : passer de confirmer à contester modifie la réaction existante', async () => {
    const api = simulerApi(donnees, { mesReactions: { r1: 'confirmation' } });
    await ouvrirLeDetail();
    expect(await carte('r1').findByText('3 confirmations')).toBeOnTheScreen();

    fireEvent.press(carte('r1').getByRole('button', { name: 'Contester' }));

    expect(await carte('r1').findByText('2 contestations')).toBeOnTheScreen();
    expect(carte('r1').getByText('2 confirmations')).toBeOnTheScreen();
    expect(api.reactions).toEqual([{ methode: 'PATCH', releve_id: 'r1', type: 'contestation' }]);
  });

  it('retire sa réaction en touchant de nouveau le bouton choisi', async () => {
    const api = simulerApi(donnees, { mesReactions: { r1: 'confirmation' } });
    await ouvrirLeDetail();
    await carte('r1').findByText('3 confirmations');

    fireEvent.press(carte('r1').getByRole('button', { name: 'Confirmer' }));

    expect(await carte('r1').findByText('2 confirmations')).toBeOnTheScreen();
    expect(api.reactions).toEqual([{ methode: 'DELETE', releve_id: 'r1', type: undefined }]);
    expect(carte('r1').getByRole('button', { name: 'Confirmer' })).not.toBeSelected();
  });

  it("ne propose pas de réagir à son propre relevé", async () => {
    simulerApi({ ...donnees, releves_recents: [releve({ est_le_mien: true }), r2] });
    await ouvrirLeDetail();
    await screen.findByText('Olivia');

    expect(carte('r1').getByText('Votre relevé')).toBeOnTheScreen();
    expect(carte('r1').queryByRole('button', { name: 'Confirmer' })).not.toBeOnTheScreen();
    expect(carte('r2').getByRole('button', { name: 'Confirmer' })).toBeOnTheScreen();
  });

  it('explique un refus du serveur pour son propre relevé', async () => {
    simulerApi(donnees, { reactionRefusee: 'NB005' });
    await ouvrirLeDetail();
    await screen.findByText('Adjovi');

    fireEvent.press(carte('r1').getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByText('Vous ne pouvez pas réagir à votre propre relevé.')).toBeOnTheScreen();
  });

  it("invite à se reconnecter quand le serveur ne reconnaît plus la session", async () => {
    simulerApi(donnees, { reactionRefusee: '42501' });
    await ouvrirLeDetail();
    await screen.findByText('Adjovi');

    fireEvent.press(carte('r1').getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByText('Votre session a expiré. Reconnectez-vous pour réagir à un relevé.')).toBeOnTheScreen();
  });

  it("dit clairement quand la réaction n'a pas pu être enregistrée", async () => {
    simulerApi(donnees, { reactionRefusee: 'PGRST000' });
    await ouvrirLeDetail();
    await screen.findByText('Adjovi');

    fireEvent.press(carte('r1').getByRole('button', { name: 'Confirmer' }));

    expect(
      await screen.findByText('Impossible d’enregistrer votre réaction. Vérifiez votre connexion et réessayez.'),
    ).toBeOnTheScreen();
  });
});
