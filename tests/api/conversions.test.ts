import { admin, creerScenario, lecteurAnonyme } from './aide';

const CONTRAINTE_VIOLEE = '23514';
const CLE_ETRANGERE = '23503';
const REFUSE_PAR_LA_SECURITE = '42501';

type Scenario = Awaited<ReturnType<typeof creerScenario>>;

// Facteur clairement factice : 1 bol de haricot = 2,5 kg (le vrai facteur sera fourni avec
// les relais). Seul ce fichier écrit dans conversions_unites ; il nettoie après chaque test.
const FACTEUR_FACTICE = 2.5;

let scenario: Scenario;
const produit = 'haricot';
let produitId: number;
let bolId: number;
let kgId: number;

async function idUnite(symbole: string) {
  const { data } = await admin.from('unites').select('id').eq('symbole', symbole).single();
  return data!.id as number;
}

beforeAll(async () => {
  bolId = await idUnite('bol');
  kgId = await idUnite('kg');
  const { data } = await admin.from('produits').select('id').eq('nom', produit).single();
  produitId = data!.id;
});

beforeEach(async () => {
  scenario = await creerScenario();
});

afterEach(async () => {
  await scenario.nettoyer();
  await admin.from('conversions_unites').delete().eq('produit_id', produitId);
});

function convertir(facteur: number = FACTEUR_FACTICE, surcharge: object = {}) {
  return admin.from('conversions_unites').insert({
    produit_id: produitId,
    unite_id: bolId,
    unite_standard_id: kgId,
    facteur,
    ...surcharge,
  });
}

async function lirePrix() {
  const { data, error } = await lecteurAnonyme
    .from('prix_courants')
    .select('unite, statut, prix, prix_converti, unite_convertie')
    .eq('marche_id', scenario.marcheId)
    .eq('produit_id', produitId)
    .order('unite');
  expect(error).toBeNull();
  return data ?? [];
}

/** Un relais suffit à publier un prix. */
async function relaisReleve(unite: string, prix: number, quantite = 1) {
  const relais = await scenario.contributeur({ relais: true });
  await scenario.relever(relais, produit, unite, { prix, quantite });
}

describe('catalogue', () => {
  it('le bol est une mesure locale, proposée pour le maïs, le riz, le gari et le haricot', async () => {
    const { data: unite } = await lecteurAnonyme.from('unites').select('symbole, type').eq('symbole', 'bol').single();
    expect(unite).toEqual({ symbole: 'bol', type: 'locale' });

    const { data } = await lecteurAnonyme
      .from('produits')
      .select('nom, unites!inner(symbole)')
      .eq('unites.symbole', 'bol');
    expect(data?.map((p) => p.nom).sort()).toEqual(['gari', 'haricot', 'maïs', 'riz']);
  });

  it("aucun facteur de conversion réel n'est livré : ils viennent avec les relais", async () => {
    const { count } = await admin.from('conversions_unites').select('*', { count: 'exact', head: true });

    expect(count).toBe(0);
  });
});

describe('prix converti', () => {
  it("avec un facteur, le prix courant s'affiche aussi en unité standard", async () => {
    await convertir();
    await relaisReleve('bol', 1000);

    expect(await lirePrix()).toEqual([
      { unite: 'bol', statut: 'publie', prix: 1000, prix_converti: 1000 / FACTEUR_FACTICE, unite_convertie: 'kg' },
    ]);
  });

  it("sans facteur, le prix reste dans l'unité d'origine et rien n'est converti", async () => {
    await relaisReleve('bol', 1000);

    expect(await lirePrix()).toEqual([
      { unite: 'bol', statut: 'publie', prix: 1000, prix_converti: null, unite_convertie: null },
    ]);
  });

  it('le prix unitaire tient compte de la quantité : 2 bols pour 1 800 FCFA font 900 le bol', async () => {
    await convertir(2);
    await relaisReleve('bol', 1800, 2);

    expect(await lirePrix()).toEqual([
      { unite: 'bol', statut: 'publie', prix: 900, prix_converti: 450, unite_convertie: 'kg' },
    ]);
  });

  it("n'affiche rien quand le prix n'est pas publié", async () => {
    await convertir();
    const contributeur = await scenario.contributeur();
    await scenario.relever(contributeur, produit, 'bol', { prix: 1000 }); // un contributeur ordinaire ne suffit pas

    expect(await lirePrix()).toEqual([
      { unite: 'bol', statut: 'pas_assez_de_donnees', prix: null, prix_converti: null, unite_convertie: null },
    ]);
  });

  it('suit le facteur en direct quand le développeur le corrige', async () => {
    await convertir(2);
    await relaisReleve('bol', 1000);
    expect((await lirePrix())[0].prix_converti).toBe(500);

    await admin.from('conversions_unites').update({ facteur: 4 }).eq('produit_id', produitId);

    expect((await lirePrix())[0].prix_converti).toBe(250);
  });
});

describe('aucune comparaison sans conversion connue', () => {
  it('le bol et le kilo du même produit restent deux prix séparés, sans mélange', async () => {
    await relaisReleve('kg', 500);
    await relaisReleve('bol', 1000);

    expect(await lirePrix()).toEqual([
      { unite: 'bol', statut: 'publie', prix: 1000, prix_converti: null, unite_convertie: null },
      { unite: 'kg', statut: 'publie', prix: 500, prix_converti: null, unite_convertie: null },
    ]);
  });

  it("même avec un facteur, le prix converti n'entre pas dans le prix en kilo", async () => {
    await convertir(); // 1 000 FCFA le bol = 400 FCFA le kilo, alors que le kilo relevé vaut 500
    await relaisReleve('kg', 500);
    await relaisReleve('bol', 1000);

    expect(await lirePrix()).toEqual([
      { unite: 'bol', statut: 'publie', prix: 1000, prix_converti: 400, unite_convertie: 'kg' },
      { unite: 'kg', statut: 'publie', prix: 500, prix_converti: null, unite_convertie: null },
    ]);
  });

  it("un facteur n'existe que pour le produit auquel il est rattaché", async () => {
    await convertir();
    const maisId = (await admin.from('produits').select('id').eq('nom', 'maïs').single()).data!.id;
    const relais = await scenario.contributeur({ relais: true });
    await scenario.relever(relais, 'maïs', 'bol', { prix: 1000 });

    // Le maïs au bol n'a pas de facteur : on ne déduit rien de celui du haricot.
    const { data } = await lecteurAnonyme
      .from('prix_courants')
      .select('unite, prix_converti, unite_convertie')
      .eq('marche_id', scenario.marcheId)
      .eq('produit_id', maisId);

    expect(data).toEqual([{ unite: 'bol', prix_converti: null, unite_convertie: null }]);
  });
});

describe('facteur de conversion', () => {
  it('refuse un facteur nul ou négatif', async () => {
    expect((await convertir(0)).error?.code).toBe(CONTRAINTE_VIOLEE);
    expect((await convertir(-1)).error?.code).toBe(CONTRAINTE_VIOLEE);
  });

  it('ne convertit que d’une mesure locale vers une unité standard', async () => {
    const standardVersStandard = await convertir(1, { unite_id: kgId, unite_standard_id: kgId });
    const localeVersLocale = await convertir(1, { unite_standard_id: bolId });

    expect(standardVersStandard.error?.message).toBe('Seule une mesure locale se convertit');
    expect(localeVersLocale.error?.message).toBe('On ne convertit que vers une unité standard');
  });

  it('refuse une unité dans laquelle le produit ne se vend pas', async () => {
    const { data: litre } = await admin.from('unites').select('id').eq('symbole', 'L').single();

    const { error } = await convertir(1, { unite_standard_id: litre!.id });

    expect(error?.code).toBe(CLE_ETRANGERE);
  });

  it('un seul facteur par produit et mesure locale', async () => {
    await convertir();

    const { error } = await convertir(3);

    expect(error?.code).toBe('23505');
  });

  it("n'est ni lisible ni modifiable par l'API : seul le tableau de bord le renseigne", async () => {
    await convertir();

    const lecture = await lecteurAnonyme.from('conversions_unites').select('*');
    const ecriture = await lecteurAnonyme
      .from('conversions_unites')
      .insert({ produit_id: produitId, unite_id: bolId, unite_standard_id: kgId, facteur: 1 });

    expect(lecture.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    expect(ecriture.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
  });
});
