import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { AppState } from 'react-native';

import { INTERVALLE_SYNCHRONISATION_MS } from '@/lib/use-synchronisation';

import {
  CLE_DE_SESSION,
  marches,
  prixCourant,
  produits,
  sessionDeTest,
  simulerApi,
  UTILISATEUR_ID,
} from './api-factice';
import { simulerPosition } from './position-factice';

const donnees = { marches, produits, prix_courants: [prixCourant({})] };
const CLE_FILE = 'nimbiwe.releves-en-attente';

// Les écouteurs « l'app revient au premier plan » : le test les déclenche pour simuler le retour du réseau.
let auPremierPlan: ((etat: string) => void)[] = [];
let espion: jest.SpyInstance;

beforeEach(async () => {
  await AsyncStorage.clear();
  auPremierPlan = [];
  espion = jest.spyOn(AppState, 'addEventListener').mockImplementation(((type: string, ecouteur: (etat: string) => void) => {
    if (type === 'change') auPremierPlan.push(ecouteur);
    return { remove: jest.fn() };
  }) as never);
});

afterEach(() => {
  espion.mockRestore();
  jest.useRealTimers();
});

async function ouvrirLeFormulaire() {
  await AsyncStorage.setItem(CLE_DE_SESSION, JSON.stringify(sessionDeTest()));
  const rendu = renderRouter('./src/app', { initialUrl: '/relever' });
  await screen.findByText('Relever un prix');
  await screen.findByRole('button', { name: 'Maïs' });
  return rendu;
}

async function relever(prix = '450') {
  fireEvent.press(screen.getByRole('button', { name: 'Maïs' }));
  fireEvent.press(screen.getByRole('button', { name: 'Ganhi' }));
  fireEvent.changeText(screen.getByLabelText('Prix total en FCFA'), prix);
  fireEvent.press(screen.getByRole('button', { name: 'Envoyer le relevé' }));
}

async function fileGardee() {
  return JSON.parse((await AsyncStorage.getItem(CLE_FILE)) ?? '[]') as Record<string, unknown>[];
}

function reveniraAuPremierPlan() {
  act(() => auPremierPlan.forEach((ecouteur) => ecouteur('active')));
}

const MESSAGE_CONSERVE =
  'Pas de connexion : votre relevé est conservé sur le téléphone et sera envoyé dès que le réseau revient.';

/** Un relevé gardé sur le téléphone du compte de test, saisi il y a `jours` jours. */
function releveGardeIlYaJours(jours: number) {
  return {
    id: `releve-ancien-${jours}`,
    proprietaire: UTILISATEUR_ID,
    produit_id: 1,
    unite_id: 10,
    marche_id: 1,
    quantite: 1,
    prix_total: 300,
    observe_le: new Date(Date.now() - jours * 24 * 60 * 60 * 1000).toISOString(),
    produit: 'maïs',
    unite: 'kg',
    marche: 'Ganhi',
    statut: 'en_attente',
  };
}

describe('saisie sans réseau', () => {
  it('garde le relevé sur le téléphone et le montre dans la liste des relevés en attente', async () => {
    const api = simulerApi(donnees);
    await ouvrirLeFormulaire();
    api.reseauCoupe = true;

    await relever('450');

    expect(await screen.findByText(MESSAGE_CONSERVE)).toBeOnTheScreen();
    expect(screen.getByText('Relevés en attente d’envoi')).toBeOnTheScreen();
    expect(screen.getByText('450 FCFA pour 1 kg')).toBeOnTheScreen();
    expect(screen.getByText("En attente d'envoi")).toBeOnTheScreen();
    expect(screen.getByLabelText('Prix total en FCFA')).toHaveDisplayValue('');
    expect(api.releves).toEqual([]);
    expect(await fileGardee()).toEqual([
      expect.objectContaining({ proprietaire: UTILISATEUR_ID, prix_total: 450, statut: 'en_attente' }),
    ]);
  });

  it('garde aussi la position du relevé', async () => {
    simulerPosition({ position: { latitude: 6.37, longitude: 2.43 } });
    const api = simulerApi(donnees);
    await ouvrirLeFormulaire();
    fireEvent(screen.getByRole('switch', { name: 'Partager ma position' }), 'valueChange', true);
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Partager ma position' })).toBeChecked());
    api.reseauCoupe = true;

    await relever('450');
    await screen.findByText(MESSAGE_CONSERVE);

    expect(await fileGardee()).toEqual([expect.objectContaining({ latitude: 6.37, longitude: 2.43 })]);
  });

  it('garde le relevé aussi quand le serveur est en panne', async () => {
    const api = simulerApi(donnees, { releveEnPanne: true });
    await ouvrirLeFormulaire();

    await relever('450');

    expect(await screen.findByText(MESSAGE_CONSERVE)).toBeOnTheScreen();
    expect(api.releves).toEqual([]);
  });

  it('propose le formulaire sans réseau, avec les produits et marchés déjà chargés', async () => {
    const api = simulerApi(donnees);
    const { unmount } = await ouvrirLeFormulaire();
    unmount();

    api.reseauCoupe = true;
    renderRouter('./src/app', { initialUrl: '/relever' });

    expect(await screen.findByRole('button', { name: 'Maïs' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ganhi' })).toBeOnTheScreen();
  });
});

describe('reconnexion', () => {
  it('envoie automatiquement les relevés en attente au retour du réseau, avec la date de la saisie', async () => {
    const api = simulerApi(donnees);
    await ouvrirLeFormulaire();
    api.reseauCoupe = true;
    await relever('450');
    await screen.findByText("En attente d'envoi");
    const [gardee] = await fileGardee();

    reveniraAuPremierPlan(); // réseau toujours coupé : rien ne part, rien ne se perd
    await waitFor(() => expect(screen.getByText("En attente d'envoi")).toBeOnTheScreen());
    expect(api.releves).toEqual([]);

    api.reseauCoupe = false;
    reveniraAuPremierPlan();

    await waitFor(() => expect(api.releves).toHaveLength(1));
    expect(api.releves[0]).toMatchObject({ id: gardee.id, prix_total: 450, observe_le: gardee.observe_le });
    await waitFor(() => expect(screen.queryByText('Relevés en attente d’envoi')).not.toBeOnTheScreen());
    expect(await fileGardee()).toEqual([]);
  });

  it("réessaie à intervalle régulier, sans que le contributeur ait rien à faire", async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    const api = simulerApi(donnees);
    await ouvrirLeFormulaire();
    api.reseauCoupe = true;
    await relever('450');
    await screen.findByText("En attente d'envoi");
    api.reseauCoupe = false;

    await act(async () => {
      await jest.advanceTimersByTimeAsync(INTERVALLE_SYNCHRONISATION_MS);
    });

    await waitFor(() => expect(api.releves).toHaveLength(1));
  });

  it('permet de tout envoyer tout de suite', async () => {
    const api = simulerApi(donnees);
    await ouvrirLeFormulaire();
    api.reseauCoupe = true;
    await relever('450');
    await screen.findByText("En attente d'envoi");
    api.reseauCoupe = false;

    fireEvent.press(screen.getByRole('button', { name: 'Envoyer maintenant' }));

    await waitFor(() => expect(api.releves).toHaveLength(1));
  });

  it("garde le relevé, sans doublon, quand la réponse du serveur se perd en route", async () => {
    const api = simulerApi(donnees);
    await ouvrirLeFormulaire();
    api.reponsesPerdues = 1; // le serveur enregistre, mais l'app croit à une coupure

    await relever('450');

    expect(await screen.findByText(MESSAGE_CONSERVE)).toBeOnTheScreen();
    expect(api.releves).toHaveLength(1);

    reveniraAuPremierPlan(); // le renvoi est reconnu comme un doublon : il compte comme envoyé

    await waitFor(() => expect(screen.queryByText('Relevés en attente d’envoi')).not.toBeOnTheScreen());
    expect(api.releves).toHaveLength(1);
    expect(api.envoisDeReleve).toBe(2);
    expect(await fileGardee()).toEqual([]);
  });

  it("une coupure pendant la synchronisation ne perd ni ne duplique aucun relevé", async () => {
    const api = simulerApi(donnees);
    await ouvrirLeFormulaire();
    api.reseauCoupe = true;
    await relever('450');
    await screen.findByText("En attente d'envoi");
    api.reseauCoupe = false;
    api.reponsesPerdues = 1; // la première tentative de synchronisation aboutit, sans réponse

    reveniraAuPremierPlan();
    await waitFor(() => expect(api.releves).toHaveLength(1)); // le serveur a enregistré le relevé
    expect(screen.getByText("En attente d'envoi")).toBeOnTheScreen(); // mais l'app n'a pas de réponse : toujours en attente

    reveniraAuPremierPlan();

    await waitFor(() => expect(screen.queryByText('Relevés en attente d’envoi')).not.toBeOnTheScreen());
    expect(api.releves).toHaveLength(1);
  });

  it("n'envoie pas un relevé supprimé entre-temps", async () => {
    const api = simulerApi(donnees);
    await ouvrirLeFormulaire();
    api.reseauCoupe = true;
    await AsyncStorage.setItem(CLE_FILE, JSON.stringify([releveGardeIlYaJours(1)]));
    reveniraAuPremierPlan(); // la file est relue ; le réseau est coupé, le relevé reste en attente
    await screen.findByText("En attente d'envoi");

    fireEvent.press(within(screen.getByTestId(/^releve-en-attente-/)).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(screen.queryByText("En attente d'envoi")).not.toBeOnTheScreen());
    api.reseauCoupe = false;
    reveniraAuPremierPlan();
    await act(async () => {});

    expect(api.releves).toEqual([]);
  });

  it("n'envoie pas les relevés en attente d'un autre compte", async () => {
    const api = simulerApi(donnees);
    await AsyncStorage.setItem(
      CLE_FILE,
      JSON.stringify([
        {
          id: 'releve-autre-compte',
          proprietaire: 'un-autre-compte',
          produit_id: 1,
          unite_id: 10,
          marche_id: 1,
          quantite: 1,
          prix_total: 300,
          observe_le: new Date().toISOString(),
          produit: 'maïs',
          unite: 'kg',
          marche: 'Ganhi',
          statut: 'en_attente',
        },
      ]),
    );

    await ouvrirLeFormulaire();
    reveniraAuPremierPlan();
    await act(async () => {});

    expect(api.releves).toEqual([]);
    expect(screen.queryByText('Relevés en attente d’envoi')).not.toBeOnTheScreen();
    expect(await fileGardee()).toHaveLength(1);
  });
});

describe('refus à la synchronisation', () => {
  async function saisirHorsLigne(api: ReturnType<typeof simulerApi>) {
    await ouvrirLeFormulaire();
    api.reseauCoupe = true;
    await relever('450');
    await screen.findByText("En attente d'envoi");
    api.reseauCoupe = false;
    reveniraAuPremierPlan();
  }
  const carte = () => within(screen.getByTestId(/^releve-en-attente-/));

  it('dit clairement que la limite du jour est atteinte, garde le relevé, puis le renvoie sur demande', async () => {
    const api = simulerApi(donnees, { releveRefuse: 'NB002' });
    await saisirHorsLigne(api);

    expect(
      await screen.findByText(
        'Refusé : Vous avez atteint la limite de relevés du jour pour ce produit sur ce marché. Réessayez dans quelques heures.',
      ),
    ).toBeOnTheScreen();
    expect(await fileGardee()).toEqual([expect.objectContaining({ statut: 'refuse' })]);

    api.releveRefuse = null;
    fireEvent.press(carte().getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(api.releves).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText('Relevés en attente d’envoi')).not.toBeOnTheScreen());
  });

  it('dit clairement que le compte est bloqué', async () => {
    const api = simulerApi(donnees, { releveRefuse: 'NB001' });
    await saisirHorsLigne(api);

    expect(
      await screen.findByText("Refusé : Votre compte ne peut plus relever de prix. Contactez l'équipe Nimbiwe."),
    ).toBeOnTheScreen();
  });

  it('dit qu’un relevé saisi il y a plus de 7 jours ne peut plus être envoyé', async () => {
    simulerApi(donnees, { releveRefuse: 'NB004' });
    await AsyncStorage.setItem(CLE_FILE, JSON.stringify([releveGardeIlYaJours(9)]));

    await ouvrirLeFormulaire();

    expect(
      await screen.findByText('Refusé : Ce relevé a été saisi il y a plus de 7 jours : il ne peut plus être envoyé.'),
    ).toBeOnTheScreen();
  });

  it("n’accuse pas l'ancienneté quand la date refusée est récente : l'horloge du téléphone était fausse", async () => {
    const api = simulerApi(donnees, { releveRefuse: 'NB004' });
    await saisirHorsLigne(api);

    expect(
      await screen.findByText(/^Refusé : La date de saisie de ce relevé n'est pas acceptée/),
    ).toBeOnTheScreen();
  });

  it('demande de confirmer un prix jugé hors bornes, puis l’envoie confirmé', async () => {
    const api = simulerApi(donnees, { horsBornes: 'haut' });
    await saisirHorsLigne(api);

    expect(
      await screen.findByText('Refusé : ce prix semble très élevé. Confirmez-le ou supprimez ce relevé.'),
    ).toBeOnTheScreen();

    fireEvent.press(carte().getByRole('button', { name: 'Confirmer ce prix' }));

    await waitFor(() => expect(api.releves).toHaveLength(1));
    expect(api.releves[0]).toMatchObject({ hors_bornes_confirme: true });
  });

  it('permet de supprimer un relevé refusé : plus rien ne reste sur le téléphone', async () => {
    const api = simulerApi(donnees, { releveRefuse: 'NB002' });
    await saisirHorsLigne(api);
    await screen.findByText(/^Refusé/);

    fireEvent.press(carte().getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(screen.queryByText('Relevés en attente d’envoi')).not.toBeOnTheScreen());
    expect(await fileGardee()).toEqual([]);
    expect(api.releves).toEqual([]);
  });

  it('permet de supprimer un relevé pas encore envoyé', async () => {
    const api = simulerApi(donnees);
    await ouvrirLeFormulaire();
    api.reseauCoupe = true;
    await relever('450');
    await screen.findByText("En attente d'envoi");

    fireEvent.press(carte().getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(screen.queryByText('Relevés en attente d’envoi')).not.toBeOnTheScreen());
    expect(await fileGardee()).toEqual([]);
  });
});
