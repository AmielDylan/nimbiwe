import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import {
  CLE_DE_SESSION,
  ilYaSecondes,
  marches,
  prixCourant,
  produits,
  sessionDeTest,
  simulerApi,
} from './api-factice';

const donnees = { marches, produits, prix_courants: [prixCourant({})] };

beforeEach(async () => {
  await AsyncStorage.clear();
});

async function ouvrirLaCollecte() {
  renderRouter('./src/app', { initialUrl: '/collecter' });
  await screen.findByText('Collecter un prix');
}

async function ouvrirLaCollecteConnecte() {
  await AsyncStorage.setItem(CLE_DE_SESSION, JSON.stringify(sessionDeTest()));
  await ouvrirLaCollecte();
}

function choisir(nom: string) {
  fireEvent.press(screen.getByRole('button', { name: nom }));
}

function saisirLePrix(prix: string) {
  fireEvent.changeText(screen.getByLabelText('Prix total en FCFA'), prix);
}

async function remplirEtEnvoyer({ prix = '450' } = {}) {
  choisir('Maïs');
  choisir('Ganhi');
  saisirLePrix(prix);
  fireEvent.press(screen.getByRole('button', { name: 'Envoyer la collecte' }));
}

describe('collecter, non connecté', () => {
  it('invite à se connecter et mène à l’écran Profil', async () => {
    simulerApi(donnees);

    const { getPathname } = renderRouter('./src/app', { initialUrl: '/collecter' });

    expect(await screen.findByText('Connectez-vous pour collecter un prix.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Envoyer la collecte' })).not.toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('Pourquoi votre numéro de téléphone ?')).toBeOnTheScreen();
    expect(getPathname()).toBe('/profil');
  });
});

describe('collecter, connecté', () => {
  it("propose produit, marché, unité, quantité et prix, l'envoi restant impossible tant que tout n'est pas renseigné", async () => {
    simulerApi(donnees);
    await ouvrirLaCollecteConnecte();

    expect(await screen.findByRole('button', { name: 'Maïs' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ganhi' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Quantité')).toBeOnTheScreen();
    expect(screen.getByLabelText('Prix total en FCFA')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Envoyer la collecte' })).toBeDisabled();

    choisir('Maïs');
    choisir('Ganhi');
    expect(screen.getByRole('button', { name: 'Envoyer la collecte' })).toBeDisabled();

    saisirLePrix('450');
    expect(screen.getByRole('button', { name: 'Envoyer la collecte' })).toBeEnabled();
  });

  it("ne propose que les unités valides pour le produit, l'unité restant obligatoire", async () => {
    simulerApi(donnees);
    await ouvrirLaCollecteConnecte();
    await screen.findByRole('button', { name: 'Igname' });

    choisir('Igname');

    expect(screen.getByRole('button', { name: 'kg' })).not.toBeSelected();
    expect(screen.getByRole('button', { name: 'pièce' })).not.toBeSelected();
    choisir('Ganhi');
    saisirLePrix('1200');
    expect(screen.getByRole('button', { name: 'Envoyer la collecte' })).toBeDisabled(); // pas d'unité choisie

    choisir('pièce');
    expect(screen.getByRole('button', { name: 'Envoyer la collecte' })).toBeEnabled();

    choisir('Maïs'); // une seule unité valide : elle est choisie d'office, l'autre disparaît
    expect(screen.getByRole('button', { name: 'kg' })).toBeSelected();
    expect(screen.queryByRole('button', { name: 'pièce' })).not.toBeOnTheScreen();
  });

  it("envoie la collecte avec les seuls champs autorisés et confirme l'enregistrement", async () => {
    const api = simulerApi(donnees);
    await ouvrirLaCollecteConnecte();
    await screen.findByRole('button', { name: 'Maïs' });

    await remplirEtEnvoyer({ prix: '450' });

    expect(await screen.findByText('Merci ! Votre collecte est enregistrée.')).toBeOnTheScreen();
    expect(api.collectes).toEqual([{ produit_id: 1, unite_id: 10, marche_id: 1, quantite: 1, prix_total: 450 }]);
    expect(screen.getByLabelText('Prix total en FCFA')).toHaveDisplayValue('');
  });

  it('envoie la quantité saisie, avec une virgule décimale', async () => {
    const api = simulerApi(donnees);
    await ouvrirLaCollecteConnecte();
    await screen.findByRole('button', { name: 'Maïs' });
    choisir('Maïs');
    choisir('Ganhi');

    fireEvent.changeText(screen.getByLabelText('Quantité'), '2,5');
    saisirLePrix('1000');
    expect(screen.getByText('Prix total pour 2,5 kg')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Envoyer la collecte' }));

    await screen.findByText('Merci ! Votre collecte est enregistrée.');
    expect(api.collectes[0]).toMatchObject({ quantite: 2.5, prix_total: 1000 });
  });

  it("explique qu'un prix décimal n'est pas accepté", async () => {
    simulerApi(donnees);
    await ouvrirLaCollecteConnecte();
    await screen.findByRole('button', { name: 'Maïs' });
    choisir('Maïs');
    choisir('Ganhi');

    saisirLePrix('4,5');

    expect(screen.getByText('Entrez un prix entier en FCFA, sans décimales.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Envoyer la collecte' })).toBeDisabled();
  });

  it("refuse les écritures scientifiques ou hexadécimales, qu'un simple Number() accepterait", async () => {
    simulerApi(donnees);
    await ouvrirLaCollecteConnecte();
    await screen.findByRole('button', { name: 'Maïs' });
    choisir('Maïs');
    choisir('Ganhi');

    for (const prix of ['1e3', '0x10', '450 FCFA']) {
      saisirLePrix(prix);
      expect(screen.getByRole('button', { name: 'Envoyer la collecte' })).toBeDisabled();
    }
  });

  it('refuse un prix nul ou une quantité nulle', async () => {
    simulerApi(donnees);
    await ouvrirLaCollecteConnecte();
    await screen.findByRole('button', { name: 'Maïs' });
    choisir('Maïs');
    choisir('Ganhi');

    saisirLePrix('0');
    expect(screen.getByRole('button', { name: 'Envoyer la collecte' })).toBeDisabled();

    saisirLePrix('450');
    fireEvent.changeText(screen.getByLabelText('Quantité'), '0');
    expect(screen.getByRole('button', { name: 'Envoyer la collecte' })).toBeDisabled();
  });
});

describe('prix hors bornes', () => {
  it("avertit d'un prix très élevé et n'envoie la collecte qu'après confirmation explicite", async () => {
    const api = simulerApi(donnees, { horsBornes: 'haut' });
    await ouvrirLaCollecteConnecte();
    await screen.findByRole('button', { name: 'Maïs' });

    await remplirEtEnvoyer({ prix: '4500' });

    expect(await screen.findByText(/Ce prix semble très élevé/)).toBeOnTheScreen();
    expect(screen.getByText(/4 500 FCFA pour 1 kg/)).toBeOnTheScreen();
    expect(api.collectes).toEqual([]);

    fireEvent.press(screen.getByRole('button', { name: 'Confirmer ce prix' }));

    expect(await screen.findByText('Merci ! Votre collecte est enregistrée.')).toBeOnTheScreen();
    expect(api.collectes).toEqual([
      { produit_id: 1, unite_id: 10, marche_id: 1, quantite: 1, prix_total: 4500, hors_bornes_confirme: true },
    ]);
  });

  it("avertit d'un prix très bas", async () => {
    simulerApi(donnees, { horsBornes: 'bas' });
    await ouvrirLaCollecteConnecte();
    await screen.findByRole('button', { name: 'Maïs' });

    await remplirEtEnvoyer({ prix: '15' });

    expect(await screen.findByText(/Ce prix semble très bas/)).toBeOnTheScreen();
  });

  it('permet de corriger le prix au lieu de le confirmer, sans rien envoyer', async () => {
    const api = simulerApi(donnees, { horsBornes: 'haut' });
    await ouvrirLaCollecteConnecte();
    await screen.findByRole('button', { name: 'Maïs' });
    await remplirEtEnvoyer({ prix: '4500' });
    await screen.findByText(/Ce prix semble très élevé/);

    fireEvent.press(screen.getByRole('button', { name: 'Corriger' }));

    expect(screen.queryByText(/Ce prix semble très élevé/)).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Prix total en FCFA')).toHaveDisplayValue('4500');
    expect(api.collectes).toEqual([]);
  });

  it("efface l'avertissement dès que le prix est modifié : la confirmation ne vaut que pour le prix affiché", async () => {
    simulerApi(donnees, { horsBornes: 'haut' });
    await ouvrirLaCollecteConnecte();
    await screen.findByRole('button', { name: 'Maïs' });
    await remplirEtEnvoyer({ prix: '4500' });
    await screen.findByText(/Ce prix semble très élevé/);

    saisirLePrix('4400');

    expect(screen.queryByRole('button', { name: 'Confirmer ce prix' })).not.toBeOnTheScreen();
  });
});

describe('refus et pannes', () => {
  it('dit clairement que la limite de collectes du jour est atteinte', async () => {
    simulerApi(donnees, { collecteRefusee: 'NB002' });
    await ouvrirLaCollecteConnecte();
    await screen.findByRole('button', { name: 'Maïs' });

    await remplirEtEnvoyer();

    expect(
      await screen.findByText(
        'Vous avez atteint la limite de collectes du jour pour ce produit sur ce marché. Réessayez demain.',
      ),
    ).toBeOnTheScreen();
  });

  it('dit clairement que le compte ne peut plus collecter', async () => {
    simulerApi(donnees, { collecteRefusee: 'NB001' });
    await ouvrirLaCollecteConnecte();
    await screen.findByRole('button', { name: 'Maïs' });

    await remplirEtEnvoyer();

    expect(
      await screen.findByText("Votre compte ne peut plus collecter de prix. Contactez l'équipe Nimbiwe."),
    ).toBeOnTheScreen();
  });

  it("n'envoie qu'une fois quand on appuie deux fois de suite sur le bouton", async () => {
    const api = simulerApi(donnees);
    await ouvrirLaCollecteConnecte();
    await screen.findByRole('button', { name: 'Maïs' });
    choisir('Maïs');
    choisir('Ganhi');
    saisirLePrix('450');

    const envoyer = screen.getByRole('button', { name: 'Envoyer la collecte' });
    fireEvent.press(envoyer);
    fireEvent.press(envoyer);

    await screen.findByText('Merci ! Votre collecte est enregistrée.');
    expect(api.envoisDeCollecte).toBe(1);
  });

  it("garde la saisie et propose de réessayer quand l'envoi échoue", async () => {
    const api = simulerApi(donnees, { collecteEnPanne: true });
    await ouvrirLaCollecteConnecte();
    await screen.findByRole('button', { name: 'Maïs' });

    await remplirEtEnvoyer({ prix: '450' });

    expect(
      await screen.findByText(
        "Impossible d'envoyer la collecte. Vérifiez votre connexion et réessayez : votre saisie est conservée.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Prix total en FCFA')).toHaveDisplayValue('450');
    expect(screen.getByRole('button', { name: 'Maïs' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Ganhi' })).toBeSelected();
    expect(api.envoisDeCollecte).toBe(1);
    expect(screen.getByRole('button', { name: 'Envoyer la collecte' })).toBeEnabled();
  });
});

describe('mes collectes', () => {
  it("montre les dernières collectes du contributeur, avec leur ancienneté", async () => {
    simulerApi(donnees, {
      mesCollectes: [
        {
          id: 'a',
          prix_total: 450,
          quantite: 1,
          observe_le: ilYaSecondes(5 * 60 + 10),
          produits: { nom: 'maïs' },
          unites: { symbole: 'kg' },
          marches: { nom: 'Ganhi' },
        },
      ],
    });

    await ouvrirLaCollecteConnecte();

    expect(await screen.findByText('Mes dernières collectes')).toBeOnTheScreen();
    expect(await screen.findByText('450 FCFA pour 1 kg')).toBeOnTheScreen();
    expect(screen.getByText('Maïs · Ganhi')).toBeOnTheScreen();
    expect(screen.getByText('il y a 5 min')).toBeOnTheScreen();
  });

  it('dit quand la liste des collectes ne se charge pas', async () => {
    simulerApi(donnees, { mesCollectesEnPanne: true });
    await ouvrirLaCollecteConnecte();

    expect(await screen.findByText('Impossible de charger vos collectes. Vérifiez votre connexion.')).toBeOnTheScreen();
  });

  it("dit qu'il n'y a encore aucune collecte", async () => {
    simulerApi(donnees);
    await ouvrirLaCollecteConnecte();

    expect(await screen.findByText("Vous n'avez pas encore collecté de prix.")).toBeOnTheScreen();
  });

  it("ajoute la collecte qui vient d'être envoyée à la liste", async () => {
    simulerApi(donnees);
    await ouvrirLaCollecteConnecte();
    await screen.findByText("Vous n'avez pas encore collecté de prix.");

    await remplirEtEnvoyer({ prix: '450' });

    expect(await screen.findByText('450 FCFA pour 1 kg')).toBeOnTheScreen();
    expect(screen.queryByText("Vous n'avez pas encore collecté de prix.")).not.toBeOnTheScreen();
  });
});
