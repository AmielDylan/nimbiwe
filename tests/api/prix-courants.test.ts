import { admin, creerScenario, ilYaJours, lecteurAnonyme } from './aide';

type Scenario = Awaited<ReturnType<typeof creerScenario>>;

let scenario: Scenario;

beforeEach(async () => {
  scenario = await creerScenario();
});

afterEach(async () => {
  await scenario.nettoyer();
});

async function lirePrix() {
  const { data, error } = await lecteurAnonyme
    .from('prix_courants')
    .select('*')
    .eq('marche_id', scenario.marcheId);
  expect(error).toBeNull();
  return data ?? [];
}

describe('prix courant', () => {
  it('est la médiane des signalements des 7 derniers jours, sans compte pour le lire', async () => {
    const relais = await scenario.contributeur({ relais: true });
    const a = await scenario.contributeur();
    const b = await scenario.contributeur();
    await scenario.signaler(relais, 'maïs', 'kg', { prix: 400 });
    await scenario.signaler(a, 'maïs', 'kg', { prix: 500, joursPasses: 3 });
    await scenario.signaler(b, 'maïs', 'kg', { prix: 900, joursPasses: 6 });
    await scenario.signaler(b, 'maïs', 'kg', { prix: 5000, joursPasses: 10 }); // trop ancien

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({
      produit: 'maïs',
      unite: 'kg',
      statut: 'publie',
      prix: 500,
      nombre_signalements: 3,
    });
  });

  it('est calculé par prix unitaire : 1 000 FCFA pour 2 kg font 500 FCFA le kilo', async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.signaler(relais, 'riz', 'kg', { prix: 1000, quantite: 2 });

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({ produit: 'riz', prix: 500 });
  });

  it('ne mélange jamais deux unités du même produit', async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.signaler(relais, 'maïs', 'kg', { prix: 400 });
    await scenario.signaler(relais, 'maïs', 'bol', { prix: 250 });

    const prix = await lirePrix();

    expect(prix.map((p) => [p.unite, p.prix]).sort()).toEqual([
      ['bol', 250],
      ['kg', 400],
    ]);
  });
});

describe('publication', () => {
  it("un seul signalement d'un relais suffit", async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.signaler(relais, 'gari', 'kg', { prix: 600 });

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({ statut: 'publie', prix: 600 });
  });

  it('trois contributeurs sans relais suffisent', async () => {
    for (const montant of [300, 400, 500]) {
      await scenario.signaler(await scenario.contributeur(), 'tomate', 'kg', { prix: montant });
    }

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({ statut: 'publie', prix: 400 });
  });

  it('deux contributeurs sans relais : pas assez de données, avec la date du dernier signalement', async () => {
    const a = await scenario.contributeur();
    const b = await scenario.contributeur();
    await scenario.signaler(a, 'oignon', 'kg', { prix: 700, joursPasses: 4 });
    await scenario.signaler(b, 'oignon', 'kg', { prix: 800, joursPasses: 1 });

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({ statut: 'pas_assez_de_donnees', prix: null, nombre_signalements: 2 });
    expect(new Date(prix.derniere_observation).getTime()).toBeCloseTo(
      new Date(ilYaJours(1)).getTime(),
      -4, // à quelques secondes près
    );
  });

  it("un même contributeur qui signale trois fois ne compte que pour un", async () => {
    const a = await scenario.contributeur();
    const b = await scenario.contributeur();
    await scenario.signaler(a, 'piment', 'kg', { prix: 1000 });
    await scenario.signaler(a, 'piment', 'kg', { prix: 1100, joursPasses: 1 });
    await scenario.signaler(b, 'piment', 'kg', { prix: 1200 });

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({ statut: 'pas_assez_de_donnees', prix: null });
  });

  it('un relais dont le dernier signalement date de plus de 7 jours ne publie plus rien, mais la date reste indiquée', async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.signaler(relais, 'sucre', 'kg', { prix: 750, joursPasses: 10 });

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({ statut: 'pas_assez_de_donnees', prix: null, nombre_signalements: 0 });
    expect(new Date(prix.derniere_observation).getTime()).toBeCloseTo(
      new Date(ilYaJours(10)).getTime(),
      -4,
    );
  });
});

describe('lecteur anonyme : lecture seule', () => {
  it('ne peut ni créer un signalement ni se donner le statut de relais', async () => {
    const auteur = await scenario.contributeur();

    const signalement = await lecteurAnonyme.from('signalements').insert({
      marche_id: scenario.marcheId,
      produit_id: 1,
      unite_id: 1,
      contributeur_id: auteur,
      prix_total: 1,
    });
    const promotion = await lecteurAnonyme
      .from('profils')
      .update({ est_relais: true })
      .eq('id', auteur)
      .select();

    expect(signalement.error).not.toBeNull();
    expect(promotion.data ?? []).toEqual([]);
    const { data: profil } = await admin.from('profils').select('est_relais').eq('id', auteur).single();
    expect(profil?.est_relais).toBe(false);
  });

  it("ne peut lire ni les signalements bruts ni les profils", async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.signaler(relais, 'igname', 'kg', { prix: 900 });

    const signalements = await lecteurAnonyme.from('signalements').select('id');
    const profils = await lecteurAnonyme.from('profils').select('id');

    expect(signalements.data ?? []).toEqual([]);
    expect(profils.data ?? []).toEqual([]);
  });
});
