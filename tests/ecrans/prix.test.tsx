import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { Prix } from '@/screens/prix';

import {
  ilYaJours,
  ilYaSecondes,
  marches,
  prixCourant,
  produits,
  simulerApi,
  simulerApiLente,
  simulerPanne,
} from './api-factice';

const ganhiMais = prixCourant({});
const ganhiSucre = prixCourant({
  produit_id: 2,
  produit: 'sucre',
  prix: 812.4,
  nombre_releves: 1,
  dernier_releve_le: ilYaJours(0),
});
const ouandoMais = prixCourant({
  marche_id: 2,
  marche: 'Ouando',
  prix: 1500,
  nombre_releves: 5,
  dernier_releve_le: ilYaJours(1),
});
const ouandoSucreInsuffisant = prixCourant({
  produit_id: 2,
  produit: 'sucre',
  marche_id: 2,
  marche: 'Ouando',
  statut: 'pas_assez_de_donnees',
  prix: null,
  nombre_releves: 2,
  dernier_releve_le: ilYaJours(12),
});

const donnees = {
  marches,
  produits,
  prix_courants: [ganhiMais, ganhiSucre, ouandoMais, ouandoSucreInsuffisant],
};

describe('écran Prix', () => {
  it("affiche le prix courant avec son unité, le nombre de relevés et son ancienneté", async () => {
    simulerApi({ ...donnees, prix_courants: [ganhiMais] });

    render(<Prix />);

    const carte = within(await screen.findByTestId('carte-prix'));
    expect(carte.getByText('Maïs')).toBeOnTheScreen();
    expect(carte.getByText('Ganhi')).toBeOnTheScreen();
    expect(carte.getByText('425 FCFA / kg')).toBeOnTheScreen();
    expect(carte.getByText('3 relevés sur 7 jours')).toBeOnTheScreen();
    expect(carte.getByText('Dernier relevé : il y a 2 jours')).toBeOnTheScreen();
  });

  it('arrondit le prix, met les milliers en forme et accorde « relevé » au singulier', async () => {
    simulerApi({
      ...donnees,
      prix_courants: [prixCourant({ prix: 1234.6, nombre_releves: 1, dernier_releve_le: ilYaJours(0) })],
    });

    render(<Prix />);

    expect(await screen.findByText('1 235 FCFA / kg')).toBeOnTheScreen();
    expect(screen.getByText('1 relevé sur 7 jours')).toBeOnTheScreen();
    expect(screen.getByText('Dernier relevé : à l’instant')).toBeOnTheScreen();
  });

  it('dit « pas assez de données » avec la date du dernier relevé, sans afficher de prix', async () => {
    simulerApi({ ...donnees, prix_courants: [ouandoSucreInsuffisant] });

    render(<Prix />);

    const carte = within(await screen.findByTestId('carte-prix'));
    expect(carte.getByText('Sucre')).toBeOnTheScreen();
    expect(carte.getByText('Pas assez de données')).toBeOnTheScreen();
    expect(carte.getByText('Dernier relevé : il y a 12 jours')).toBeOnTheScreen();
    expect(carte.queryByText(/FCFA/)).not.toBeOnTheScreen();
  });

  it('filtre par marché', async () => {
    simulerApi(donnees);
    render(<Prix />);
    await screen.findAllByTestId('carte-prix');

    fireEvent.press(screen.getByRole('button', { name: 'Ouando' }));

    expect(screen.getByText('1 500 FCFA / kg')).toBeOnTheScreen();
    expect(screen.queryByText('425 FCFA / kg')).not.toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Tous les marchés' }));

    expect(screen.getByText('425 FCFA / kg')).toBeOnTheScreen();
  });

  it('filtre par produit', async () => {
    simulerApi(donnees);
    render(<Prix />);
    await screen.findAllByTestId('carte-prix');

    fireEvent.press(screen.getByRole('button', { name: 'Sucre' }));

    expect(screen.getByText('812 FCFA / kg')).toBeOnTheScreen();
    expect(screen.queryByText('425 FCFA / kg')).not.toBeOnTheScreen();
    expect(screen.queryByText('1 500 FCFA / kg')).not.toBeOnTheScreen();
  });

  it("indique clairement qu'un marché n'a aucun prix", async () => {
    simulerApi(donnees);
    render(<Prix />);
    await screen.findAllByTestId('carte-prix');

    fireEvent.press(screen.getByRole('button', { name: 'Dantokpa' }));

    expect(screen.getByText('Aucun prix pour ce marché pour le moment.')).toBeOnTheScreen();
  });

  it("indique qu'aucun prix ne correspond à la combinaison d'un marché et d'un produit", async () => {
    simulerApi(donnees);
    render(<Prix />);
    await screen.findAllByTestId('carte-prix');

    fireEvent.press(screen.getByRole('button', { name: 'Dantokpa' }));
    fireEvent.press(screen.getByRole('button', { name: 'Sucre' }));

    expect(screen.getByText('Aucun prix pour cette sélection pour le moment.')).toBeOnTheScreen();
  });

  it("précise l'ancienneté du dernier relevé à la seconde, la minute, l'heure ou le jour près", async () => {
    const anciennetes: [string, string][] = [
      [ilYaSecondes(30), 'il y a 30 sec'],
      [ilYaSecondes(5 * 60 + 10), 'il y a 5 min'],
      [ilYaSecondes(3 * 3600 + 60), 'il y a 3 h'],
      [ilYaJours(1), 'hier'],
      [ilYaJours(2), 'il y a 2 jours'],
      [ilYaJours(65), 'il y a 2 mois'],
    ];
    simulerApi({
      ...donnees,
      prix_courants: anciennetes.map(([date], index) =>
        prixCourant({ produit_id: 10 + index, dernier_releve_le: date }),
      ),
    });

    render(<Prix />);

    for (const [, libelle] of anciennetes) {
      expect(await screen.findByText(`Dernier relevé : ${libelle}`)).toBeOnTheScreen();
    }
  });

  it('affiche un état de chargement', async () => {
    const repondre = simulerApiLente(donnees);

    render(<Prix />);

    expect(screen.getByText('Chargement des prix…')).toBeOnTheScreen();

    await act(async () => repondre());
    expect(await screen.findAllByTestId('carte-prix')).not.toHaveLength(0);
    expect(screen.queryByText('Chargement des prix…')).not.toBeOnTheScreen();
  });

  it("affiche une erreur claire quand les prix ne se chargent pas, et permet de réessayer", async () => {
    simulerPanne();
    render(<Prix />);

    expect(
      await screen.findByText('Impossible de charger les prix. Vérifiez votre connexion et réessayez.'),
    ).toBeOnTheScreen();

    simulerApi(donnees);
    fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findAllByTestId('carte-prix')).not.toHaveLength(0);
  });

  it('se rafraîchit en tirant vers le bas', async () => {
    let courantes = { ...donnees, prix_courants: [ganhiMais] };
    simulerApi(() => courantes);
    render(<Prix />);
    await screen.findByText('425 FCFA / kg');

    courantes = { ...donnees, prix_courants: [prixCourant({ prix: 480 })] };
    await act(async () => screen.getByTestId('liste-prix').props.refreshControl.props.onRefresh());

    expect(await screen.findByText('480 FCFA / kg')).toBeOnTheScreen();
    expect(screen.queryByText('425 FCFA / kg')).not.toBeOnTheScreen();
  });

  it("garde les prix affichés et prévient quand l'actualisation échoue", async () => {
    simulerApi({ ...donnees, prix_courants: [ganhiMais] });
    render(<Prix />);
    await screen.findByText('425 FCFA / kg');

    simulerPanne();
    await act(async () => screen.getByTestId('liste-prix').props.refreshControl.props.onRefresh());

    expect(await screen.findByText('Actualisation impossible. Vérifiez votre connexion.')).toBeOnTheScreen();
    expect(screen.getByText('425 FCFA / kg')).toBeOnTheScreen();
  });
});
