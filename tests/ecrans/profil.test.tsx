import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { reinitialiserLesToasts } from '@/lib/toasts';

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
  reinitialiserLesToasts(); // état de module partagé entre les tests de ce fichier
  await AsyncStorage.clear();
});

async function saisirNumeroEtDemanderLeCode(numero = '01 97 00 00 00') {
  fireEvent.changeText(await screen.findByLabelText('Numéro de téléphone'), numero);
  fireEvent.press(screen.getByRole('button', { name: 'Recevoir un code' }));
}

async function seConnecter() {
  await saisirNumeroEtDemanderLeCode();
  fireEvent.changeText(await screen.findByLabelText('Chiffre 1 sur 6'), CODE_VALIDE);
  fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));
  await screen.findByText('Vous êtes connecté.');
}

describe('écran Profil, non connecté', () => {
  it("explique pourquoi le numéro est demandé avant de le saisir", async () => {
    simulerApi(donnees);

    renderRouter('./src/app', { initialUrl: '/profil' });

    expect(await screen.findByText('Pourquoi votre numéro de téléphone ?')).toBeOnTheScreen();
    expect(screen.getByText(/uniquement pour vous connecter/)).toBeOnTheScreen();
    expect(screen.getByText(/En demandant un code, vous acceptez/)).toBeOnTheScreen();
    expect(screen.getByText(/jamais montré aux autres/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Numéro de téléphone')).toBeOnTheScreen();
    expect(screen.queryByText('Vous êtes connecté.')).not.toBeOnTheScreen();
  });

  it('envoie le code au numéro saisi, au format international, puis demande le code', async () => {
    const api = simulerApi(donnees);
    renderRouter('./src/app', { initialUrl: '/profil' });

    await saisirNumeroEtDemanderLeCode('01 97 00 00 00');

    expect(await screen.findByLabelText('Chiffre 1 sur 6')).toBeOnTheScreen();
    expect(api.demandesDeCode).toEqual(['+2290197000000']);
  });

  it("refuse un numéro invalide sans rien envoyer", async () => {
    const api = simulerApi(donnees);
    renderRouter('./src/app', { initialUrl: '/profil' });

    await saisirNumeroEtDemanderLeCode('12');

    expect(await screen.findByText(/Numéro invalide/)).toBeOnTheScreen();
    expect(api.demandesDeCode).toEqual([]);
  });

  it("dit clairement quand l'envoi du code échoue", async () => {
    simulerApi(donnees, { envoiEnPanne: true });
    renderRouter('./src/app', { initialUrl: '/profil' });

    await saisirNumeroEtDemanderLeCode();

    expect(
      await screen.findByText("Impossible d'envoyer le code. Vérifiez votre connexion et réessayez."),
    ).toBeOnTheScreen();
  });

  it('connecte avec le bon code', async () => {
    simulerApi(donnees);
    renderRouter('./src/app', { initialUrl: '/profil' });

    await seConnecter();

    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeOnTheScreen();
    expect(screen.queryByLabelText('Numéro de téléphone')).not.toBeOnTheScreen();
  });

  it("distingue une panne du serveur d'un code faux quand on vérifie le code", async () => {
    simulerApi(donnees, { verificationEnPanne: true });
    renderRouter('./src/app', { initialUrl: '/profil' });
    await saisirNumeroEtDemanderLeCode();

    fireEvent.changeText(await screen.findByLabelText('Chiffre 1 sur 6'), CODE_VALIDE);
    fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));

    expect(
      await screen.findByText('Impossible de vérifier le code. Vérifiez votre connexion et réessayez.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/Code incorrect ou expiré/)).not.toBeOnTheScreen();
  });

  it('dit clairement quand le code est faux ou expiré', async () => {
    simulerApi(donnees);
    renderRouter('./src/app', { initialUrl: '/profil' });
    await saisirNumeroEtDemanderLeCode();

    fireEvent.changeText(await screen.findByLabelText('Chiffre 1 sur 6'), '000000');
    fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));

    expect(
      await screen.findByText('Code incorrect ou expiré. Vérifiez le code ou demandez-en un nouveau.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Vous êtes connecté.')).not.toBeOnTheScreen();
  });

  it('vérifie le code automatiquement une fois les 6 chiffres saisis, sans toucher un bouton', async () => {
    const api = simulerApi(donnees);
    renderRouter('./src/app', { initialUrl: '/profil' });
    await saisirNumeroEtDemanderLeCode();

    fireEvent.changeText(await screen.findByLabelText('Chiffre 1 sur 6'), CODE_VALIDE);

    expect(await screen.findByText('Vous êtes connecté.')).toBeOnTheScreen();
    expect(api.demandesDeCode).toEqual(['+2290197000000']);
  });

  it('chaque case du code a un intitulé lisible par un lecteur d’écran', async () => {
    simulerApi(donnees);
    renderRouter('./src/app', { initialUrl: '/profil' });
    await saisirNumeroEtDemanderLeCode();
    await screen.findByLabelText('Chiffre 1 sur 6');

    for (let position = 1; position <= 6; position += 1) {
      expect(screen.getByLabelText(`Chiffre ${position} sur 6`)).toBeOnTheScreen();
    }
  });

  it("un collage dans une autre case que la première n'en garde que le premier chiffre", async () => {
    simulerApi(donnees);
    renderRouter('./src/app', { initialUrl: '/profil' });
    await saisirNumeroEtDemanderLeCode();
    await screen.findByLabelText('Chiffre 1 sur 6');

    fireEvent.changeText(screen.getByLabelText('Chiffre 3 sur 6'), '789');

    expect(screen.getByLabelText('Chiffre 3 sur 6')).toHaveDisplayValue('7');
    expect(screen.getByLabelText('Chiffre 1 sur 6')).toHaveDisplayValue('');
  });

  it('ignore les caractères non numériques et un collage de plus de 6 chiffres', async () => {
    const api = simulerApi(donnees);
    renderRouter('./src/app', { initialUrl: '/profil' });
    await saisirNumeroEtDemanderLeCode();

    fireEvent.changeText(await screen.findByLabelText('Chiffre 1 sur 6'), `abc${CODE_VALIDE}789`);

    expect(await screen.findByText('Vous êtes connecté.')).toBeOnTheScreen();
    // Les 6 premiers chiffres seulement : les caractères en trop et les lettres sont écartés.
    expect(api.demandesDeCode).toEqual(['+2290197000000']);
  });

  it("un appui sur « Se connecter » juste après le remplissage automatique n'envoie qu'une vérification", async () => {
    simulerApi(donnees);
    renderRouter('./src/app', { initialUrl: '/profil' });
    await saisirNumeroEtDemanderLeCode();

    fireEvent.changeText(await screen.findByLabelText('Chiffre 1 sur 6'), CODE_VALIDE);
    // Le bouton n'est pas encore rendu indisponible : un second appui immédiat ne doit rien renvoyer.
    fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('Vous êtes connecté.')).toBeOnTheScreen();
  });

  it('redemander un code vide le champ précédent', async () => {
    jest.useFakeTimers();
    try {
      simulerApi(donnees);
      renderRouter('./src/app', { initialUrl: '/profil' });
      await saisirNumeroEtDemanderLeCode();
      fireEvent.changeText(await screen.findByLabelText('Chiffre 1 sur 6'), '000000'); // code faux, retenté après un délai

      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });
      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Renvoyer le code' }));
      });

      expect(screen.getByLabelText('Chiffre 1 sur 6')).toHaveDisplayValue('');
    } finally {
      jest.useRealTimers();
    }
  });

  it('ne permet de redemander un code qu’après un court délai', async () => {
    jest.useFakeTimers();
    try {
      const api = simulerApi(donnees);
      renderRouter('./src/app', { initialUrl: '/profil' });
      await saisirNumeroEtDemanderLeCode();
      await screen.findByLabelText('Chiffre 1 sur 6');

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

    renderRouter('./src/app', { initialUrl: '/profil' });

    expect(await screen.findByText('Vous êtes connecté.')).toBeOnTheScreen();
    expect(api.demandesDeCode).toEqual([]);
  });

  it("referme la session et revient à la connexion quand le compte n'existe plus", async () => {
    await AsyncStorage.setItem(CLE_DE_SESSION, JSON.stringify(sessionDeTest()));
    const api = simulerApi(donnees, { compteSupprime: true });

    renderRouter('./src/app', { initialUrl: '/profil' });

    expect(await screen.findByLabelText('Numéro de téléphone')).toBeOnTheScreen();
    expect(screen.queryByText('Vous êtes connecté.')).not.toBeOnTheScreen();
    expect(api.deconnexions).toBe(1);
  });

  it('affiche le nom déjà enregistré et ne montre jamais le numéro', async () => {
    await AsyncStorage.setItem(CLE_DE_SESSION, JSON.stringify(sessionDeTest('22997000000')));
    simulerApi(donnees, { nomAffiche: 'Adjovi' });

    renderRouter('./src/app', { initialUrl: '/profil' });

    expect(await screen.findByDisplayValue('Adjovi')).toBeOnTheScreen();
    expect(screen.queryByText(/22997000000/)).not.toBeOnTheScreen();
    expect(screen.getByText(/numéro n’est jamais montré aux autres/)).toBeOnTheScreen();
  });

  it('enregistre le nom affiché', async () => {
    const api = simulerApi(donnees);
    renderRouter('./src/app', { initialUrl: '/profil' });
    await seConnecter();

    fireEvent.changeText(screen.getByLabelText('Nom affiché'), 'Adjovi');
    fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Nom enregistré.')).toBeOnTheScreen();
    expect(api.nomAffiche).toBe('Adjovi');
  });

  it("dit que le nom n'a pas été enregistré quand aucun profil n'est modifié", async () => {
    simulerApi(donnees, { profilIntrouvable: true });
    renderRouter('./src/app', { initialUrl: '/profil' });
    await seConnecter();

    fireEvent.changeText(screen.getByLabelText('Nom affiché'), 'Adjovi');
    fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(
      await screen.findByText('Votre profil est introuvable. Déconnectez-vous, puis reconnectez-vous.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Nom enregistré.')).not.toBeOnTheScreen();
  });

  it('déconnecte et revient au formulaire de connexion', async () => {
    const api = simulerApi(donnees);
    renderRouter('./src/app', { initialUrl: '/profil' });
    await seConnecter();

    fireEvent.press(screen.getByRole('button', { name: 'Se déconnecter' }));

    expect(await screen.findByLabelText('Numéro de téléphone')).toBeOnTheScreen();
    expect(screen.queryByText('Vous êtes connecté.')).not.toBeOnTheScreen();
    expect(api.deconnexions).toBe(1);
  });
});
