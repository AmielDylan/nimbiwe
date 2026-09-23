import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { reinitialiserLesToasts } from '@/lib/toasts';

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
  reinitialiserLesToasts(); // état de module partagé entre les tests de ce fichier
  await AsyncStorage.clear();
});

async function ouvrirLaReleve() {
  renderRouter('./src/app', { initialUrl: '/relever' });
  await screen.findByText('Relever un prix');
}

async function ouvrirLaReleveConnecte() {
  await AsyncStorage.setItem(CLE_DE_SESSION, JSON.stringify(sessionDeTest()));
  await ouvrirLaReleve();
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
  fireEvent.press(screen.getByRole('button', { name: 'Envoyer le relevé' }));
}

describe('relever, non connecté', () => {
  it('invite à se connecter et mène à l’écran Profil', async () => {
    simulerApi(donnees);

    const { getPathname } = renderRouter('./src/app', { initialUrl: '/relever' });

    expect(await screen.findByText('Connectez-vous pour relever un prix.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Envoyer le relevé' })).not.toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('Pourquoi votre numéro de téléphone ?')).toBeOnTheScreen();
    expect(getPathname()).toBe('/profil');
  });
});

describe('relever, connecté', () => {
  it("propose produit, marché, unité, quantité et prix, l'envoi restant impossible tant que tout n'est pas renseigné", async () => {
    simulerApi(donnees);
    await ouvrirLaReleveConnecte();

    expect(await screen.findByRole('button', { name: 'Maïs' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ganhi' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Quantité')).toBeOnTheScreen();
    expect(screen.getByLabelText('Prix total en FCFA')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Envoyer le relevé' })).toBeDisabled();

    choisir('Maïs');
    choisir('Ganhi');
    expect(screen.getByRole('button', { name: 'Envoyer le relevé' })).toBeDisabled();

    saisirLePrix('450');
    expect(screen.getByRole('button', { name: 'Envoyer le relevé' })).toBeEnabled();
  });

  it("ne propose que les unités valides pour le produit, l'unité restant obligatoire", async () => {
    simulerApi(donnees);
    await ouvrirLaReleveConnecte();
    await screen.findByRole('button', { name: 'Igname' });

    choisir('Igname');

    expect(screen.getByRole('button', { name: 'kg' })).not.toBeSelected();
    expect(screen.getByRole('button', { name: 'pièce' })).not.toBeSelected();
    choisir('Ganhi');
    saisirLePrix('1200');
    expect(screen.getByRole('button', { name: 'Envoyer le relevé' })).toBeDisabled(); // pas d'unité choisie

    choisir('pièce');
    expect(screen.getByRole('button', { name: 'Envoyer le relevé' })).toBeEnabled();

    choisir('Maïs'); // une seule unité valide : elle est choisie d'office, l'autre disparaît
    expect(screen.getByRole('button', { name: 'kg' })).toBeSelected();
    expect(screen.queryByRole('button', { name: 'pièce' })).not.toBeOnTheScreen();
  });

  it("envoie le relevé avec les seuls champs autorisés et confirme l'enregistrement", async () => {
    const api = simulerApi(donnees);
    await ouvrirLaReleveConnecte();
    await screen.findByRole('button', { name: 'Maïs' });

    await remplirEtEnvoyer({ prix: '450' });

    expect(await screen.findByText('Merci ! Votre relevé est enregistré.')).toBeOnTheScreen();
    expect(api.releves).toEqual([{ id: expect.any(String), produit_id: 1, unite_id: 10, marche_id: 1, quantite: 1, prix_total: 450 }]);
    expect(screen.getByLabelText('Prix total en FCFA')).toHaveDisplayValue('');
  });

  it('envoie la quantité saisie, avec une virgule décimale', async () => {
    const api = simulerApi(donnees);
    await ouvrirLaReleveConnecte();
    await screen.findByRole('button', { name: 'Maïs' });
    choisir('Maïs');
    choisir('Ganhi');

    fireEvent.changeText(screen.getByLabelText('Quantité'), '2,5');
    saisirLePrix('1000');
    expect(screen.getByText('Prix total pour 2,5 kg')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Envoyer le relevé' }));

    await screen.findByText('Merci ! Votre relevé est enregistré.');
    expect(api.releves[0]).toMatchObject({ quantite: 2.5, prix_total: 1000 });
  });

  it("explique qu'un prix décimal n'est pas accepté", async () => {
    simulerApi(donnees);
    await ouvrirLaReleveConnecte();
    await screen.findByRole('button', { name: 'Maïs' });
    choisir('Maïs');
    choisir('Ganhi');

    saisirLePrix('4,5');

    expect(screen.getByText('Entrez un prix entier en FCFA, sans décimales.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Envoyer le relevé' })).toBeDisabled();
  });

  it("refuse les écritures scientifiques ou hexadécimales, qu'un simple Number() accepterait", async () => {
    simulerApi(donnees);
    await ouvrirLaReleveConnecte();
    await screen.findByRole('button', { name: 'Maïs' });
    choisir('Maïs');
    choisir('Ganhi');

    for (const prix of ['1e3', '0x10', '450 FCFA']) {
      saisirLePrix(prix);
      expect(screen.getByRole('button', { name: 'Envoyer le relevé' })).toBeDisabled();
    }
  });

  it('refuse un prix nul ou une quantité nulle', async () => {
    simulerApi(donnees);
    await ouvrirLaReleveConnecte();
    await screen.findByRole('button', { name: 'Maïs' });
    choisir('Maïs');
    choisir('Ganhi');

    saisirLePrix('0');
    expect(screen.getByRole('button', { name: 'Envoyer le relevé' })).toBeDisabled();

    saisirLePrix('450');
    fireEvent.changeText(screen.getByLabelText('Quantité'), '0');
    expect(screen.getByRole('button', { name: 'Envoyer le relevé' })).toBeDisabled();
  });
});

describe('prix hors bornes', () => {
  it("avertit d'un prix très élevé et n'envoie le relevé qu'après confirmation explicite", async () => {
    const api = simulerApi(donnees, { horsBornes: 'haut' });
    await ouvrirLaReleveConnecte();
    await screen.findByRole('button', { name: 'Maïs' });

    await remplirEtEnvoyer({ prix: '4500' });

    expect(await screen.findByText(/Ce prix semble très élevé/)).toBeOnTheScreen();
    expect(screen.getByText(/4 500 FCFA pour 1 kg/)).toBeOnTheScreen();
    expect(api.releves).toEqual([]);

    fireEvent.press(screen.getByRole('button', { name: 'Confirmer ce prix' }));

    expect(await screen.findByText('Merci ! Votre relevé est enregistré.')).toBeOnTheScreen();
    expect(api.releves).toEqual([
      { id: expect.any(String), produit_id: 1, unite_id: 10, marche_id: 1, quantite: 1, prix_total: 4500, hors_bornes_confirme: true },
    ]);
  });

  it("avertit d'un prix très bas", async () => {
    simulerApi(donnees, { horsBornes: 'bas' });
    await ouvrirLaReleveConnecte();
    await screen.findByRole('button', { name: 'Maïs' });

    await remplirEtEnvoyer({ prix: '15' });

    expect(await screen.findByText(/Ce prix semble très bas/)).toBeOnTheScreen();
  });

  it('permet de corriger le prix au lieu de le confirmer, sans rien envoyer', async () => {
    const api = simulerApi(donnees, { horsBornes: 'haut' });
    await ouvrirLaReleveConnecte();
    await screen.findByRole('button', { name: 'Maïs' });
    await remplirEtEnvoyer({ prix: '4500' });
    await screen.findByText(/Ce prix semble très élevé/);

    fireEvent.press(screen.getByRole('button', { name: 'Corriger' }));

    expect(screen.queryByText(/Ce prix semble très élevé/)).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Prix total en FCFA')).toHaveDisplayValue('4500');
    expect(api.releves).toEqual([]);
  });

  it("efface l'avertissement dès que le prix est modifié : la confirmation ne vaut que pour le prix affiché", async () => {
    simulerApi(donnees, { horsBornes: 'haut' });
    await ouvrirLaReleveConnecte();
    await screen.findByRole('button', { name: 'Maïs' });
    await remplirEtEnvoyer({ prix: '4500' });
    await screen.findByText(/Ce prix semble très élevé/);

    saisirLePrix('4400');

    expect(screen.queryByRole('button', { name: 'Confirmer ce prix' })).not.toBeOnTheScreen();
  });
});

describe('refus et pannes', () => {
  it('dit clairement que la limite de relevés du jour est atteinte', async () => {
    simulerApi(donnees, { releveRefuse: 'NB002' });
    await ouvrirLaReleveConnecte();
    await screen.findByRole('button', { name: 'Maïs' });

    await remplirEtEnvoyer();

    expect(
      await screen.findByText(
        'Vous avez atteint la limite de relevés du jour pour ce produit sur ce marché. Réessayez dans quelques heures.',
      ),
    ).toBeOnTheScreen();
  });

  it('dit clairement que le compte ne peut plus relever', async () => {
    simulerApi(donnees, { releveRefuse: 'NB001' });
    await ouvrirLaReleveConnecte();
    await screen.findByRole('button', { name: 'Maïs' });

    await remplirEtEnvoyer();

    expect(
      await screen.findByText("Votre compte ne peut plus relever de prix. Contactez l'équipe Nimbiwe."),
    ).toBeOnTheScreen();
  });

  it("n'envoie qu'une fois quand on appuie deux fois de suite sur le bouton", async () => {
    const api = simulerApi(donnees);
    await ouvrirLaReleveConnecte();
    await screen.findByRole('button', { name: 'Maïs' });
    choisir('Maïs');
    choisir('Ganhi');
    saisirLePrix('450');

    const envoyer = screen.getByRole('button', { name: 'Envoyer le relevé' });
    fireEvent.press(envoyer);
    fireEvent.press(envoyer);

    await screen.findByText('Merci ! Votre relevé est enregistré.');
    expect(api.envoisDeReleve).toBe(1);
  });

  it("dit de se reconnecter quand le compte n'est plus reconnu par le serveur", async () => {
    simulerApi(donnees, { releveRefuse: '23503' });
    await ouvrirLaReleveConnecte();
    await screen.findByRole('button', { name: 'Maïs' });

    await remplirEtEnvoyer();

    expect(
      await screen.findByText(
        "Votre compte n'est plus reconnu. Déconnectez-vous, puis reconnectez-vous depuis l'onglet Profil.",
      ),
    ).toBeOnTheScreen();
  });

  it("garde la saisie et propose de réessayer quand l'envoi échoue", async () => {
    const api = simulerApi(donnees, { releveRefuse: 'XX000' });
    await ouvrirLaReleveConnecte();
    await screen.findByRole('button', { name: 'Maïs' });

    await remplirEtEnvoyer({ prix: '450' });

    expect(
      await screen.findByText(
        "Impossible d'envoyer le relevé. Vérifiez votre connexion et réessayez : votre saisie est conservée.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Prix total en FCFA')).toHaveDisplayValue('450');
    expect(screen.getByRole('button', { name: 'Maïs' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Ganhi' })).toBeSelected();
    expect(api.envoisDeReleve).toBe(1);
    expect(screen.getByRole('button', { name: 'Envoyer le relevé' })).toBeEnabled();
  });
});

describe('mes relevés', () => {
  it("montre les derniers relevés du contributeur, avec leur ancienneté", async () => {
    simulerApi(donnees, {
      mesReleves: [
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

    await ouvrirLaReleveConnecte();

    expect(await screen.findByText('Mes derniers relevés')).toBeOnTheScreen();
    expect(await screen.findByText('450 FCFA pour 1 kg')).toBeOnTheScreen();
    expect(screen.getByText('Maïs · Ganhi')).toBeOnTheScreen();
    expect(screen.getByText('il y a 5 min')).toBeOnTheScreen();
  });

  it('dit quand la liste des relevés ne se charge pas', async () => {
    simulerApi(donnees, { mesRelevesEnPanne: true });
    await ouvrirLaReleveConnecte();

    expect(await screen.findByText('Impossible de charger vos relevés. Vérifiez votre connexion.')).toBeOnTheScreen();
  });

  it("dit qu'il n'y a encore aucun relevé", async () => {
    simulerApi(donnees);
    await ouvrirLaReleveConnecte();

    expect(await screen.findByText("Vous n'avez pas encore relevé de prix.")).toBeOnTheScreen();
  });

  it("ajoute le relevé qui vient d'être envoyé à la liste", async () => {
    simulerApi(donnees);
    await ouvrirLaReleveConnecte();
    await screen.findByText("Vous n'avez pas encore relevé de prix.");

    await remplirEtEnvoyer({ prix: '450' });

    expect(await screen.findByText('450 FCFA pour 1 kg')).toBeOnTheScreen();
    expect(screen.queryByText("Vous n'avez pas encore relevé de prix.")).not.toBeOnTheScreen();
  });
});
