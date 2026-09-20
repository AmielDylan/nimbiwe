import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { Profil } from '@/screens/profil';

import {
  CLE_DE_SESSION,
  CODE_VALIDE,
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

async function saisirNumeroEtDemanderLeCode(numero = '01 97 00 00 00') {
  fireEvent.changeText(await screen.findByLabelText('Numéro de téléphone'), numero);
  fireEvent.press(screen.getByRole('button', { name: 'Recevoir un code' }));
}

async function seConnecter() {
  await saisirNumeroEtDemanderLeCode();
  fireEvent.changeText(await screen.findByLabelText('Code reçu par SMS'), CODE_VALIDE);
  fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));
  await screen.findByText('Vous êtes connecté.');
}

describe('écran Profil, non connecté', () => {
  it("explique pourquoi le numéro est demandé avant de le saisir", async () => {
    simulerApi(donnees);

    render(<Profil />);

    expect(await screen.findByText('Pourquoi votre numéro de téléphone ?')).toBeOnTheScreen();
    expect(screen.getByText(/uniquement pour vous connecter/)).toBeOnTheScreen();
    expect(screen.getByText(/En demandant un code, vous acceptez/)).toBeOnTheScreen();
    expect(screen.getByText(/jamais montré aux autres/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Numéro de téléphone')).toBeOnTheScreen();
    expect(screen.queryByText('Vous êtes connecté.')).not.toBeOnTheScreen();
  });

  it('envoie le code au numéro saisi, au format international, puis demande le code', async () => {
    const api = simulerApi(donnees);
    render(<Profil />);

    await saisirNumeroEtDemanderLeCode('01 97 00 00 00');

    expect(await screen.findByLabelText('Code reçu par SMS')).toBeOnTheScreen();
    expect(api.demandesDeCode).toEqual(['+2290197000000']);
  });

  it("refuse un numéro invalide sans rien envoyer", async () => {
    const api = simulerApi(donnees);
    render(<Profil />);

    await saisirNumeroEtDemanderLeCode('12');

    expect(await screen.findByText(/Numéro invalide/)).toBeOnTheScreen();
    expect(api.demandesDeCode).toEqual([]);
  });

  it("dit clairement quand l'envoi du code échoue", async () => {
    simulerApi(donnees, { envoiEnPanne: true });
    render(<Profil />);

    await saisirNumeroEtDemanderLeCode();

    expect(
      await screen.findByText("Impossible d'envoyer le code. Vérifiez votre connexion et réessayez."),
    ).toBeOnTheScreen();
  });

  it('connecte avec le bon code', async () => {
    simulerApi(donnees);
    render(<Profil />);

    await seConnecter();

    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeOnTheScreen();
    expect(screen.queryByLabelText('Numéro de téléphone')).not.toBeOnTheScreen();
  });

  it("distingue une panne du serveur d'un code faux quand on vérifie le code", async () => {
    simulerApi(donnees, { verificationEnPanne: true });
    render(<Profil />);
    await saisirNumeroEtDemanderLeCode();

    fireEvent.changeText(await screen.findByLabelText('Code reçu par SMS'), CODE_VALIDE);
    fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));

    expect(
      await screen.findByText('Impossible de vérifier le code. Vérifiez votre connexion et réessayez.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/Code incorrect ou expiré/)).not.toBeOnTheScreen();
  });

  it('dit clairement quand le code est faux ou expiré', async () => {
    simulerApi(donnees);
    render(<Profil />);
    await saisirNumeroEtDemanderLeCode();

    fireEvent.changeText(await screen.findByLabelText('Code reçu par SMS'), '000000');
    fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));

    expect(
      await screen.findByText('Code incorrect ou expiré. Vérifiez le code ou demandez-en un nouveau.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Vous êtes connecté.')).not.toBeOnTheScreen();
  });

  it('ne permet de redemander un code qu’après un court délai', async () => {
    jest.useFakeTimers();
    try {
      const api = simulerApi(donnees);
      render(<Profil />);
      await saisirNumeroEtDemanderLeCode();
      await screen.findByLabelText('Code reçu par SMS');

      expect(screen.getByRole('button', { name: /Renvoyer le code dans 60 s/ })).toBeDisabled();

      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });
      fireEvent.press(screen.getByRole('button', { name: 'Renvoyer le code' }));

      await act(async () => {});
      expect(api.demandesDeCode).toEqual(['+2290197000000', '+2290197000000']);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('écran Profil, connecté', () => {
  it('garde la session ouverte après la fermeture de l’app', async () => {
    await AsyncStorage.setItem(CLE_DE_SESSION, JSON.stringify(sessionDeTest()));
    const api = simulerApi(donnees);

    render(<Profil />);

    expect(await screen.findByText('Vous êtes connecté.')).toBeOnTheScreen();
    expect(api.demandesDeCode).toEqual([]);
  });

  it("referme la session et revient à la connexion quand le compte n'existe plus", async () => {
    await AsyncStorage.setItem(CLE_DE_SESSION, JSON.stringify(sessionDeTest()));
    const api = simulerApi(donnees, { compteSupprime: true });

    render(<Profil />);

    expect(await screen.findByLabelText('Numéro de téléphone')).toBeOnTheScreen();
    expect(screen.queryByText('Vous êtes connecté.')).not.toBeOnTheScreen();
    expect(api.deconnexions).toBe(1);
  });

  it('affiche le nom déjà enregistré et ne montre jamais le numéro', async () => {
    await AsyncStorage.setItem(CLE_DE_SESSION, JSON.stringify(sessionDeTest('22997000000')));
    simulerApi(donnees, { nomAffiche: 'Adjovi' });

    render(<Profil />);

    expect(await screen.findByDisplayValue('Adjovi')).toBeOnTheScreen();
    expect(screen.queryByText(/22997000000/)).not.toBeOnTheScreen();
    expect(screen.getByText(/numéro n’est jamais montré aux autres/)).toBeOnTheScreen();
  });

  it('enregistre le nom affiché', async () => {
    const api = simulerApi(donnees);
    render(<Profil />);
    await seConnecter();

    fireEvent.changeText(screen.getByLabelText('Nom affiché'), 'Adjovi');
    fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Nom enregistré.')).toBeOnTheScreen();
    expect(api.nomAffiche).toBe('Adjovi');
  });

  it("dit que le nom n'a pas été enregistré quand aucun profil n'est modifié", async () => {
    simulerApi(donnees, { profilIntrouvable: true });
    render(<Profil />);
    await seConnecter();

    fireEvent.changeText(screen.getByLabelText('Nom affiché'), 'Adjovi');
    fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(
      await screen.findByText('Votre profil est introuvable. Déconnectez-vous, puis reconnectez-vous.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Nom enregistré.')).not.toBeOnTheScreen();
  });

  it("efface le message d'enregistrement dès que le nom est modifié", async () => {
    simulerApi(donnees);
    render(<Profil />);
    await seConnecter();
    fireEvent.changeText(screen.getByLabelText('Nom affiché'), 'Adjovi');
    fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    await screen.findByText('Nom enregistré.');

    fireEvent.changeText(screen.getByLabelText('Nom affiché'), 'Adjovi D');

    expect(screen.queryByText('Nom enregistré.')).not.toBeOnTheScreen();
  });

  it('déconnecte et revient au formulaire de connexion', async () => {
    const api = simulerApi(donnees);
    render(<Profil />);
    await seConnecter();

    fireEvent.press(screen.getByRole('button', { name: 'Se déconnecter' }));

    expect(await screen.findByLabelText('Numéro de téléphone')).toBeOnTheScreen();
    expect(screen.queryByText('Vous êtes connecté.')).not.toBeOnTheScreen();
    expect(api.deconnexions).toBe(1);
  });
});
