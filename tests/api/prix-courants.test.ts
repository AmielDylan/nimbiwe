import { admin, creerScenario, ilYaJours, lecteurAnonyme } from './aide';

type Scenario = Awaited<ReturnType<typeof creerScenario>>;

type LignePrix = {
  produit_id: number;
  unite_id: number;
  produit: string;
  unite: string;
  statut: 'publie' | 'pas_assez_de_donnees';
  prix: number | null;
  nombre_collectes: number;
  derniere_collecte_le: string;
};

let scenario: Scenario;

beforeEach(async () => {
  scenario = await creerScenario();
});

afterEach(async () => {
  await scenario.nettoyer();
});

async function lirePrix(jours?: number): Promise<LignePrix[]> {
  const { data, error } = await lecteurAnonyme
    .rpc('prix_courants', jours === undefined ? {} : { jours })
    .eq('marche_id', scenario.marcheId);
  expect(error).toBeNull();
  return (data ?? []) as LignePrix[];
}

describe('prix courant', () => {
  it('est la médiane des collectes des 7 derniers jours, sans compte pour le lire', async () => {
    const relais = await scenario.contributeur({ relais: true });
    const a = await scenario.contributeur();
    const b = await scenario.contributeur();
    await scenario.collecter(relais, 'maïs', 'kg', { prix: 400 });
    await scenario.collecter(a, 'maïs', 'kg', { prix: 500, joursPasses: 3 });
    await scenario.collecter(b, 'maïs', 'kg', { prix: 900, joursPasses: 6 });
    await scenario.collecter(b, 'maïs', 'kg', { prix: 5000, joursPasses: 10 }); // trop ancien

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({
      produit: 'maïs',
      unite: 'kg',
      statut: 'publie',
      prix: 500,
      nombre_collectes: 3,
    });
  });

  it('est calculé par prix unitaire : 1 000 FCFA pour 2 kg font 500 FCFA le kilo', async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.collecter(relais, 'riz', 'kg', { prix: 1000, quantite: 2 });

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({ produit: 'riz', prix: 500 });
  });

  it('ne mélange jamais deux unités du même produit', async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.collecter(relais, 'igname', 'kg', { prix: 400 });
    await scenario.collecter(relais, 'igname', 'pièce', { prix: 250 });

    const prix = await lirePrix();

    expect(prix.map((p) => [p.unite, p.prix]).sort()).toEqual([
      ['kg', 400],
      ['pièce', 250],
    ]);
  });
});

describe('publication', () => {
  it("une seule collecte d'un relais suffit", async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.collecter(relais, 'gari', 'kg', { prix: 600 });

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({ statut: 'publie', prix: 600 });
  });

  it('trois contributeurs sans relais suffisent', async () => {
    for (const montant of [300, 400, 500]) {
      await scenario.collecter(await scenario.contributeur(), 'tomate', 'kg', { prix: montant });
    }

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({ statut: 'publie', prix: 400 });
  });

  it('deux contributeurs sans relais : pas assez de données, avec la date de la dernière collecte', async () => {
    const a = await scenario.contributeur();
    const b = await scenario.contributeur();
    await scenario.collecter(a, 'oignon', 'kg', { prix: 700, joursPasses: 4 });
    await scenario.collecter(b, 'oignon', 'kg', { prix: 800, joursPasses: 1 });

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({ statut: 'pas_assez_de_donnees', prix: null, nombre_collectes: 2 });
    expect(new Date(prix.derniere_collecte_le).getTime()).toBeCloseTo(
      new Date(ilYaJours(1)).getTime(),
      -4, // à quelques secondes près
    );
  });

  it("un même contributeur qui collecte trois fois ne compte que pour un", async () => {
    const a = await scenario.contributeur();
    const b = await scenario.contributeur();
    await scenario.collecter(a, 'piment', 'kg', { prix: 1000 });
    await scenario.collecter(a, 'piment', 'kg', { prix: 1100, joursPasses: 1 });
    await scenario.collecter(b, 'piment', 'kg', { prix: 1200 });

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({ statut: 'pas_assez_de_donnees', prix: null });
  });

  it('un relais dont la dernière collecte date de plus de 7 jours ne publie plus rien, mais la date reste indiquée', async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.collecter(relais, 'sucre', 'kg', { prix: 750, joursPasses: 10 });

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({ statut: 'pas_assez_de_donnees', prix: null, nombre_collectes: 0 });
    expect(new Date(prix.derniere_collecte_le).getTime()).toBeCloseTo(
      new Date(ilYaJours(10)).getTime(),
      -4,
    );
  });

  it("une ancienne collecte de relais ne suffit pas à publier deux collectes récentes de contributeurs", async () => {
    const relais = await scenario.contributeur({ relais: true });
    const a = await scenario.contributeur();
    const b = await scenario.contributeur();
    await scenario.collecter(relais, 'haricot', 'kg', { prix: 900, joursPasses: 9 });
    await scenario.collecter(a, 'haricot', 'kg', { prix: 950 });
    await scenario.collecter(b, 'haricot', 'kg', { prix: 1000 });

    const [prix] = await lirePrix();

    expect(prix).toMatchObject({ statut: 'pas_assez_de_donnees', prix: null, nombre_collectes: 2 });
  });
});

describe('période', () => {
  it('se resserre sur un jour : seules les dernières 24 heures comptent', async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.collecter(relais, 'sucre', 'kg', { prix: 400 });
    await scenario.collecter(relais, 'sucre', 'kg', { prix: 900, joursPasses: 3 });

    const [sur1Jour] = await lirePrix(1);
    const [sur7Jours] = await lirePrix(7);

    expect(sur1Jour).toMatchObject({ prix: 400, nombre_collectes: 1 });
    expect(sur7Jours).toMatchObject({ prix: 650, nombre_collectes: 2 });
  });

  it('sur 3 jours, une collecte de 5 jours est écartée', async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.collecter(relais, 'riz', 'kg', { prix: 600, joursPasses: 2 });
    await scenario.collecter(relais, 'riz', 'kg', { prix: 1000, joursPasses: 5 });

    const [prix] = await lirePrix(3);

    expect(prix).toMatchObject({ prix: 600, nombre_collectes: 1 });
  });

  it('la règle de publication s’applique à la période choisie', async () => {
    const [a, b, c] = [
      await scenario.contributeur(),
      await scenario.contributeur(),
      await scenario.contributeur(),
    ];
    await scenario.collecter(a, 'gari', 'kg', { prix: 500 });
    await scenario.collecter(b, 'gari', 'kg', { prix: 520 });
    await scenario.collecter(c, 'gari', 'kg', { prix: 540, joursPasses: 3 });

    const [surUnJour] = await lirePrix(1);
    const [surSeptJours] = await lirePrix(7);

    expect(surUnJour).toMatchObject({ statut: 'pas_assez_de_donnees', prix: null });
    expect(surSeptJours).toMatchObject({ statut: 'publie', prix: 520 });
  });

  it('refuse une période hors de 1 à 90 jours', async () => {
    for (const jours of [0, -3, 91]) {
      const { error } = await lecteurAnonyme.rpc('prix_courants', { jours });
      expect(error).not.toBeNull();
    }
  });
});

describe('unités', () => {
  it("une collecte dans une unité non valide pour le produit est rejetée", async () => {
    const relais = await scenario.contributeur({ relais: true });

    await expect(scenario.collecter(relais, 'huile végétale', 'kg', { prix: 1500 })).rejects.toMatchObject({
      code: '23503', // clé étrangère : (huile végétale, kg) n'est pas une paire valide
    });
  });
});

describe('lecteur anonyme : lecture seule', () => {
  // Code Postgres « insufficient_privilege » : refus par la sécurité par ligne.
  const REFUSE_PAR_LA_SECURITE = '42501';

  it('ne peut ni créer une collecte ni en modifier ou supprimer une, ni se donner le statut de relais', async () => {
    const auteur = await scenario.contributeur();
    await scenario.collecter(auteur, 'maïs', 'kg', { prix: 400 });
    const { data: maisKg } = await admin
      .rpc('prix_courants')
      .eq('marche_id', scenario.marcheId)
      .single<LignePrix>();

    // Une collecte valide : seul un refus de la sécurité peut la faire échouer.
    const creation = await lecteurAnonyme.from('collectes').insert({
      marche_id: scenario.marcheId,
      produit_id: maisKg!.produit_id,
      unite_id: maisKg!.unite_id,
      contributeur_id: auteur,
      prix_total: 1,
    });
    const modification = await lecteurAnonyme
      .from('collectes')
      .update({ prix_total: 1 })
      .eq('contributeur_id', auteur)
      .select();
    const suppression = await lecteurAnonyme
      .from('collectes')
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
    const { data: collectes } = await admin
      .from('collectes')
      .select('prix_total')
      .eq('marche_id', scenario.marcheId);
    expect(collectes).toEqual([{ prix_total: 400 }]);
    const { data: profilAuteur } = await admin.from('profils').select('est_relais').eq('id', auteur).single();
    expect(profilAuteur?.est_relais).toBe(false);
  });

  it("ne peut lire ni les collectes brutes ni les profils", async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.collecter(relais, 'igname', 'kg', { prix: 900 });

    const collectes = await lecteurAnonyme.from('collectes').select('id');
    const profils = await lecteurAnonyme.from('profils').select('id');

    expect(collectes.data ?? []).toEqual([]);
    expect(profils.data ?? []).toEqual([]);
  });
});
