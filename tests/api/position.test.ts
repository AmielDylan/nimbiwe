import { admin, contributeurConnecte, creerScenario, identifiants, lecteurAnonyme } from './aide';

const REFUSE_PAR_LA_SECURITE = '42501';
const CONTRAINTE_VIOLEE = '23514';

// Un marché de test à des coordonnées connues ; 0,01° de latitude vaut environ 1 112 m.
const MARCHE = { latitude: 6.36, longitude: 2.43 };

type Scenario = Awaited<ReturnType<typeof creerScenario>>;
type Contributeur = Awaited<ReturnType<typeof contributeurConnecte>>;

let scenario: Scenario;
const comptes: Contributeur[] = [];

beforeEach(async () => {
  scenario = await creerScenario(MARCHE);
});

afterEach(async () => {
  for (const compte of comptes.splice(0)) await compte.nettoyer();
  await scenario.nettoyer();
});

async function contributeur() {
  const compte = await contributeurConnecte();
  comptes.push(compte);
  return compte;
}

async function releve(champs: Record<string, unknown> = {}) {
  return {
    ...(await identifiants('maïs', 'kg')),
    marche_id: scenario.marcheId,
    quantite: 1,
    prix_total: 450,
    ...champs,
  };
}

describe('position facultative', () => {
  it('un relevé sans position est accepté, sans distance', async () => {
    const auteur = await contributeur();

    const { error } = await auteur.client.from('releves').insert(await releve());

    expect(error).toBeNull();
    const { data } = await admin.from('releves').select('latitude, distance_marche_m').eq('marche_id', scenario.marcheId).single();
    expect(data).toEqual({ latitude: null, distance_marche_m: null });
  });

  it('un relevé avec position est accepté et le serveur calcule la distance au marché', async () => {
    const auteur = await contributeur();

    const { error } = await auteur.client
      .from('releves')
      .insert(await releve({ latitude: 6.37, longitude: 2.43 })); // 0,01° au nord du marché

    expect(error).toBeNull();
    const { data } = await admin.from('releves').select('distance_marche_m').eq('marche_id', scenario.marcheId).single();
    expect(data!.distance_marche_m).toBeGreaterThan(1100);
    expect(data!.distance_marche_m).toBeLessThan(1125);
  });

  it("n'enregistre pas de distance quand le marché n'a pas de coordonnées", async () => {
    const sansCoordonnees = await creerScenario();
    try {
      const auteur = await contributeur();
      await auteur.client.from('releves').insert({
        ...(await identifiants('maïs', 'kg')),
        marche_id: sansCoordonnees.marcheId,
        quantite: 1,
        prix_total: 450,
        latitude: 6.37,
        longitude: 2.43,
      });

      const { data } = await admin
        .from('releves')
        .select('latitude, distance_marche_m')
        .eq('marche_id', sansCoordonnees.marcheId)
        .single();

      expect(data).toEqual({ latitude: 6.37, distance_marche_m: null });
    } finally {
      await sansCoordonnees.nettoyer();
    }
  });

  it.each([
    ['une latitude hors limites', { latitude: 91, longitude: 2.43 }],
    ['une longitude hors limites', { latitude: 6.37, longitude: 181 }],
    ['une latitude NaN', { latitude: 'NaN', longitude: 2.43 }],
    ['une latitude sans longitude', { latitude: 6.37 }],
    ['une longitude sans latitude', { longitude: 2.43 }],
  ])('refuse %s', async (_nom, position) => {
    const auteur = await contributeur();

    const { error } = await auteur.client.from('releves').insert(await releve(position));

    expect(error?.code).toBe(CONTRAINTE_VIOLEE);
    const { data } = await admin.from('releves').select('id').eq('marche_id', scenario.marcheId);
    expect(data).toEqual([]);
  });

  it('le client ne peut pas écrire la distance lui-même', async () => {
    const auteur = await contributeur();

    const { error } = await auteur.client
      .from('releves')
      .insert(await releve({ latitude: 6.37, longitude: 2.43, distance_marche_m: 0 }));

    expect(error?.code).toBe(REFUSE_PAR_LA_SECURITE);
  });
});

describe('la position reste côté serveur', () => {
  it.each(['latitude', 'longitude', 'distance_marche_m', '*'])(
    "ni l'auteur ni un autre contributeur ne peuvent lire « %s »",
    async (colonne) => {
      const auteur = await contributeur();
      const autre = await contributeur();
      await auteur.client.from('releves').insert(await releve({ latitude: 6.37, longitude: 2.43 }));

      const parAuteur = await auteur.client.from('releves').select(colonne);
      const parAutre = await autre.client.from('releves').select(colonne);

      expect(parAuteur.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
      expect(parAutre.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    },
  );

  it('un lecteur anonyme ne lit pas non plus la position', async () => {
    const { error } = await lecteurAnonyme.from('releves').select('latitude, longitude');

    expect(error?.code).toBe(REFUSE_PAR_LA_SECURITE);
  });

  it("l'auteur voit toujours ses relevés, sans la position", async () => {
    const auteur = await contributeur();
    await auteur.client.from('releves').insert(await releve({ latitude: 6.37, longitude: 2.43 }));

    const { data, error } = await auteur.client.from('releves').select('prix_total, marches(nom)');

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('les marchés restent lisibles par tous, coordonnées comprises', async () => {
    const { data, error } = await lecteurAnonyme.from('marches').select('nom, latitude, longitude').eq('id', scenario.marcheId).single();

    expect(error).toBeNull();
    expect(data).toMatchObject(MARCHE);
  });
});

describe('poids dans le prix courant', () => {
  const AVEC = { latitude: 6.37, longitude: 2.43 };

  async function prixCourant() {
    const { data, error } = await lecteurAnonyme
      .from('prix_courants')
      .select('prix, statut')
      .eq('marche_id', scenario.marcheId)
      .single();
    expect(error).toBeNull();
    return data!;
  }

  async function troisReleves(positions: [boolean, boolean, boolean]) {
    const prix = [400, 800, 1200];
    for (let i = 0; i < 3; i++) {
      await scenario.relever(await scenario.contributeur(), 'maïs', 'kg', {
        prix: prix[i],
        ...(positions[i] ? { position: AVEC } : {}),
      });
    }
  }

  it('sans position, un relevé pèse moitié moins : la médiane se rapproche des relevés avec position', async () => {
    await troisReleves([true, false, false]); // poids 1, 0,5, 0,5

    const { prix, statut } = await prixCourant();

    expect(statut).toBe('publie');
    expect(prix).toBeCloseTo(666.67, 1); // la médiane simple serait 800
  });

  it('avec des positions partout, les poids sont égaux : c’est la médiane simple', async () => {
    await troisReleves([true, true, true]);

    expect((await prixCourant()).prix).toBe(800);
  });

  it('sans aucune position, les poids sont égaux entre eux : c’est la médiane simple', async () => {
    await troisReleves([false, false, false]);

    expect((await prixCourant()).prix).toBe(800);
  });

  it('avec un nombre pair de relevés de même poids, la médiane est la moyenne des deux du milieu', async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.relever(relais, 'maïs', 'kg', { prix: 400, position: AVEC });
    await scenario.relever(await scenario.contributeur(), 'maïs', 'kg', { prix: 600, position: AVEC });

    expect((await prixCourant()).prix).toBe(500);
  });

  it('le poids est paramétrable', async () => {
    const { data: initial } = await admin.from('parametres').select('valeur').eq('cle', 'poids_releve_sans_position').single();
    await troisReleves([true, false, false]);
    await admin.from('parametres').update({ valeur: 1 }).eq('cle', 'poids_releve_sans_position');
    try {
      expect((await prixCourant()).prix).toBe(800); // tous les poids valent 1
    } finally {
      await admin.from('parametres').update({ valeur: initial!.valeur }).eq('cle', 'poids_releve_sans_position');
    }
  });

  it('le poids par défaut est de 0,5', async () => {
    const { data } = await admin.from('parametres').select('valeur').eq('cle', 'poids_releve_sans_position').single();

    expect(Number(data!.valeur)).toBe(0.5);
  });
});
