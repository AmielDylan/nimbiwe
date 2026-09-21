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
  it('est la médiane des relevés des 7 derniers jours, sans compte pour le lire', async () => {
    // Trois contributeurs ordinaires : poids égaux, donc médiane simple (les relais pèsent plus, voir relais.test.ts).
    const premier = await scenario.contributeur();
    const a = await scenario.contributeur();
    const b = await scenario.contributeur();
    await scenario.relever(premier, 'maïs', 'kg', { prix: 400 });
    await scenario.relever(a, 'maïs', 'kg', { prix: 500, joursPasses: 3 });
    await scenario.relever(b, 'maïs', 'kg', { prix: 900, joursPasses: 6 });
    await scenario.relever(b, 'maïs', 'kg', { prix: 5000, joursPasses: 10 }); // trop ancien

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({
      produit: 'maïs',
      unite: 'kg',
      statut: 'publie',
      prix: 500,
      nombre_releves: 3,
    });
  });

  it('est calculé par prix unitaire : 1 000 FCFA pour 2 kg font 500 FCFA le kilo', async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.relever(relais, 'riz', 'kg', { prix: 1000, quantite: 2 });

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({ produit: 'riz', prix: 500 });
  });

  it('ne mélange jamais deux unités du même produit', async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.relever(relais, 'igname', 'kg', { prix: 400 });
    await scenario.relever(relais, 'igname', 'pièce', { prix: 250 });

    const prix = await lirePrix();

    expect(prix.map((p) => [p.unite, p.prix]).sort()).toEqual([
      ['kg', 400],
      ['pièce', 250],
    ]);
  });
});

describe('publication', () => {
  it("un seul relevé d'un relais suffit", async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.relever(relais, 'gari', 'kg', { prix: 600 });

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({ statut: 'publie', prix: 600 });
  });

  it('trois contributeurs sans relais suffisent', async () => {
    for (const montant of [300, 400, 500]) {
      await scenario.relever(await scenario.contributeur(), 'tomate', 'kg', { prix: montant });
    }

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({ statut: 'publie', prix: 400 });
  });

  it('deux contributeurs sans relais : pas assez de données, avec la date du dernier relevé', async () => {
    const a = await scenario.contributeur();
    const b = await scenario.contributeur();
    await scenario.relever(a, 'oignon', 'kg', { prix: 700, joursPasses: 4 });
    await scenario.relever(b, 'oignon', 'kg', { prix: 800, joursPasses: 1 });

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({ statut: 'pas_assez_de_donnees', prix: null, nombre_releves: 2 });
    expect(new Date(prix.dernier_releve_le).getTime()).toBeCloseTo(
      new Date(ilYaJours(1)).getTime(),
      -4, // à quelques secondes près
    );
  });

  it("un même contributeur qui relève trois fois ne compte que pour un", async () => {
    const a = await scenario.contributeur();
    const b = await scenario.contributeur();
    await scenario.relever(a, 'piment', 'kg', { prix: 1000 });
    await scenario.relever(a, 'piment', 'kg', { prix: 1100, joursPasses: 1 });
    await scenario.relever(b, 'piment', 'kg', { prix: 1200 });

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({ statut: 'pas_assez_de_donnees', prix: null });
  });

  it('un relais dont le dernier relevé date de plus de 7 jours ne publie plus rien, mais la date reste indiquée', async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.relever(relais, 'sucre', 'kg', { prix: 750, joursPasses: 10 });

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({ statut: 'pas_assez_de_donnees', prix: null, nombre_releves: 0 });
    expect(new Date(prix.dernier_releve_le).getTime()).toBeCloseTo(
      new Date(ilYaJours(10)).getTime(),
      -4,
    );
  });

  it("un ancien relevé de relais ne suffit pas à publier deux relevés récents de contributeurs", async () => {
    const relais = await scenario.contributeur({ relais: true });
    const a = await scenario.contributeur();
    const b = await scenario.contributeur();
    await scenario.relever(relais, 'haricot', 'kg', { prix: 900, joursPasses: 9 });
    await scenario.relever(a, 'haricot', 'kg', { prix: 950 });
    await scenario.relever(b, 'haricot', 'kg', { prix: 1000 });

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({ statut: 'pas_assez_de_donnees', prix: null, nombre_releves: 2 });
  });
});

describe('unités', () => {
  it("un relevé dans une unité non valide pour le produit est rejeté", async () => {
    const relais = await scenario.contributeur({ relais: true });

    await expect(scenario.relever(relais, 'huile végétale', 'kg', { prix: 1500 })).rejects.toMatchObject({
      code: '23503', // clé étrangère : (huile végétale, kg) n'est pas une paire valide
    });
  });
});

describe('lecteur anonyme : lecture seule', () => {
  // Code Postgres « insufficient_privilege » : refus par la sécurité par ligne.
  const REFUSE_PAR_LA_SECURITE = '42501';

  it('ne peut ni créer un relevé ni en modifier ou supprimer un, ni se donner le statut de relais', async () => {
    const auteur = await scenario.contributeur();
    await scenario.relever(auteur, 'maïs', 'kg', { prix: 400 });
    const { data: maisKg } = await admin
      .from('prix_courants')
      .select('produit_id, unite_id')
      .eq('marche_id', scenario.marcheId)
      .single();

    // Un relevé valide : seul un refus de la sécurité peut le faire échouer.
    const creation = await lecteurAnonyme.from('releves').insert({
      marche_id: scenario.marcheId,
      produit_id: maisKg!.produit_id,
      unite_id: maisKg!.unite_id,
      contributeur_id: auteur,
      prix_total: 1,
    });
    const modification = await lecteurAnonyme
      .from('releves')
      .update({ prix_total: 1 })
      .eq('contributeur_id', auteur)
      .select();
    const suppression = await lecteurAnonyme
      .from('releves')
      .delete()
      .eq('contributeur_id', auteur)
      .select();
    const profil = await lecteurAnonyme.from('profils').insert({ id: crypto.randomUUID() });
    const promotion = await lecteurAnonyme
      .from('profils')
      .update({ est_relais: true })
      .eq('id', auteur)
      .select();

    expect(creation.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    expect(profil.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    expect(modification.data ?? []).toEqual([]);
    expect(suppression.data ?? []).toEqual([]);
    expect(promotion.data ?? []).toEqual([]);

    // Rien n'a bougé côté base.
    const { data: releves } = await admin
      .from('releves')
      .select('prix_total')
      .eq('marche_id', scenario.marcheId);
    expect(releves).toEqual([{ prix_total: 400 }]);
    const { data: profilAuteur } = await admin.from('profils').select('est_relais').eq('id', auteur).single();
    expect(profilAuteur?.est_relais).toBe(false);
  });

  it("ne peut lire ni les relevés bruts ni les profils", async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.relever(relais, 'igname', 'kg', { prix: 900 });

    const releves = await lecteurAnonyme.from('releves').select('id');
    const profils = await lecteurAnonyme.from('profils').select('id');

    expect(releves.data ?? []).toEqual([]);
    expect(profils.data ?? []).toEqual([]);
  });
});
