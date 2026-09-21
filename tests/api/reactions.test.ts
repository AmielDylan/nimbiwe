import { admin, contributeurConnecte, creerScenario, identifiants, lecteurAnonyme } from './aide';

const REFUSE_PAR_LA_SECURITE = '42501';
const COMPTE_BLOQUE = 'NB001';
const RELEVE_DE_SOI = 'NB005';
const DOUBLON = '23505';
const CONTRAINTE_VIOLEE = '23514';
const CLE_ETRANGERE = '23503';

type Scenario = Awaited<ReturnType<typeof creerScenario>>;
type Contributeur = Awaited<ReturnType<typeof contributeurConnecte>>;

let scenario: Scenario;
const comptes: Contributeur[] = [];

beforeEach(async () => {
  scenario = await creerScenario();
});

afterEach(async () => {
  for (const compte of comptes.splice(0)) await compte.nettoyer();
  await scenario.nettoyer();
});

async function lecteur() {
  const compte = await contributeurConnecte();
  comptes.push(compte);
  return compte;
}

async function lecteurs(nombre: number) {
  return Promise.all(Array.from({ length: nombre }, () => lecteur()));
}

/** Un relevé de maïs d'un contributeur ordinaire ; renvoie son identifiant. */
async function releveDe(auteurId: string, prix: number) {
  await scenario.relever(auteurId, 'maïs', 'kg', { prix });
  const { data } = await admin
    .from('releves')
    .select('id')
    .eq('contributeur_id', auteurId)
    .eq('marche_id', scenario.marcheId)
    .order('cree_le', { ascending: false })
    .limit(1)
    .single();
  return data!.id as string;
}

async function nouveauReleve(prix = 450) {
  return releveDe(await scenario.contributeur(), prix);
}

function reagir(compte: Contributeur, releveId: string, type: 'confirmation' | 'contestation') {
  return compte.client.from('reactions').insert({ releve_id: releveId, type });
}

async function liste(client = lecteurAnonyme) {
  const ids = await identifiants('maïs', 'kg');
  const { data, error } = await client.rpc('releves_recents', {
    p_produit_id: ids.produit_id,
    p_unite_id: ids.unite_id,
    p_marche_id: scenario.marcheId,
  });
  expect(error).toBeNull();
  return (data ?? []) as Array<Record<string, any>>;
}

async function prixCourant() {
  const { data } = await lecteurAnonyme
    .from('prix_courants')
    .select('prix, statut, nombre_releves')
    .eq('marche_id', scenario.marcheId)
    .eq('produit', 'maïs')
    .single();
  return data!;
}

describe('confirmer et contester', () => {
  it("un contributeur confirme ou conteste le relevé d'un autre : les compteurs suivent", async () => {
    const releveId = await nouveauReleve();
    const [a, b, c] = await lecteurs(3);

    expect((await reagir(a, releveId, 'confirmation')).error).toBeNull();
    expect((await reagir(b, releveId, 'confirmation')).error).toBeNull();
    expect((await reagir(c, releveId, 'contestation')).error).toBeNull();

    const [releve] = await liste();
    expect(releve).toMatchObject({ id: releveId, confirmations: 2, contestations: 1 });
  });

  it('on change sa réaction, puis on la retire', async () => {
    const releveId = await nouveauReleve();
    const [a] = await lecteurs(1);
    await reagir(a, releveId, 'confirmation');

    const changement = await a.client.from('reactions').update({ type: 'contestation' }).eq('releve_id', releveId).select();
    expect(changement.error).toBeNull();
    expect(changement.data).toHaveLength(1);
    expect((await liste())[0]).toMatchObject({ confirmations: 0, contestations: 1 });

    const retrait = await a.client.from('reactions').delete().eq('releve_id', releveId).select();
    expect(retrait.error).toBeNull();
    expect(retrait.data).toHaveLength(1);
    expect((await liste())[0]).toMatchObject({ confirmations: 0, contestations: 0 });
  });

  it('une seule réaction par personne et par relevé', async () => {
    const releveId = await nouveauReleve();
    const [a] = await lecteurs(1);
    await reagir(a, releveId, 'confirmation');

    const seconde = await reagir(a, releveId, 'contestation');

    expect(seconde.error?.code).toBe(DOUBLON);
  });

  it('un contributeur ne peut pas réagir à son propre relevé', async () => {
    const [moi] = await lecteurs(1);
    const releveId = await releveDe(moi.id, 450);

    const { error } = await reagir(moi, releveId, 'confirmation');

    expect(error?.code).toBe(RELEVE_DE_SOI);
    expect(await liste()).toEqual([expect.objectContaining({ confirmations: 0, contestations: 0 })]);
  });

  it('un lecteur non connecté ne peut pas réagir', async () => {
    const releveId = await nouveauReleve();

    const { error } = await lecteurAnonyme.from('reactions').insert({ releve_id: releveId, type: 'confirmation' });

    expect(error?.code).toBe(REFUSE_PAR_LA_SECURITE);
  });

  it('un compte bloqué ne peut plus réagir', async () => {
    const releveId = await nouveauReleve();
    const [a] = await lecteurs(1);
    await admin.from('profils').update({ est_bloque: true }).eq('id', a.id);

    const { error } = await reagir(a, releveId, 'confirmation');

    expect(error?.code).toBe(COMPTE_BLOQUE);
  });

  it("le client n'écrit que les champs autorisés", async () => {
    const releveId = await nouveauReleve();
    const autreReleveId = await nouveauReleve(460);
    const [a, b] = await lecteurs(2);

    const auNomDunAutre = await a.client.from('reactions').insert({ releve_id: releveId, type: 'confirmation', contributeur_id: b.id });
    await reagir(a, releveId, 'confirmation');
    const deplacer = await a.client.from('reactions').update({ releve_id: autreReleveId }).eq('releve_id', releveId);
    const typeInvalide = await b.client.from('reactions').insert({ releve_id: releveId, type: 'super-confirmation' });
    const inexistant = await b.client.from('reactions').insert({ releve_id: crypto.randomUUID(), type: 'confirmation' });

    expect(auNomDunAutre.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    expect(deplacer.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    expect(typeInvalide.error?.code).toBe(CONTRAINTE_VIOLEE);
    expect(inexistant.error?.code).toBe(CLE_ETRANGERE);
  });

  it('les réactions des autres restent privées : on ne les lit, ni ne les modifie, ni ne les supprime', async () => {
    const releveId = await nouveauReleve();
    const [a, b] = await lecteurs(2);
    await reagir(a, releveId, 'confirmation');

    const lecture = await b.client.from('reactions').select('*');
    const modification = await b.client.from('reactions').update({ type: 'contestation' }).eq('releve_id', releveId).select();
    const suppression = await b.client.from('reactions').delete().eq('releve_id', releveId).select();

    expect(lecture.data).toEqual([]);
    expect(modification.data).toEqual([]);
    expect(suppression.data).toEqual([]);
    const { data } = await admin.from('reactions').select('type').eq('releve_id', releveId);
    expect(data).toEqual([{ type: 'confirmation' }]);
  });
});

describe('liste des relevés récents', () => {
  it("montre le nom affiché de l'auteur et les compteurs, sans aucune donnée personnelle", async () => {
    const auteurId = await scenario.contributeur();
    await admin.from('profils').update({ nom_affiche: 'Adjovi' }).eq('id', auteurId);
    await releveDe(auteurId, 450);

    const [releve] = await liste();

    expect(releve).toMatchObject({ auteur: 'Adjovi', prix_total: 450, confirmations: 0, contestations: 0, conteste: false });
    expect(Object.keys(releve).sort()).toEqual([
      'auteur', 'conteste', 'confirmations', 'contestations', 'est_le_mien', 'id', 'ma_reaction',
      'observe_le', 'prix_total', 'prix_unitaire', 'quantite',
    ].sort());
  });

  it('un auteur sans nom affiché apparaît comme « Contributeur »', async () => {
    const auteurId = await scenario.contributeur();
    await admin.from('profils').update({ nom_affiche: null }).eq('id', auteurId);
    await releveDe(auteurId, 450);

    expect((await liste())[0].auteur).toBe('Contributeur');
  });

  it('ne liste que les relevés des 7 derniers jours, de ce produit, ce marché et cette unité', async () => {
    await nouveauReleve(450);
    await scenario.relever(await scenario.contributeur(), 'maïs', 'kg', { prix: 470, joursPasses: 10 }); // trop ancien
    await scenario.relever(await scenario.contributeur(), 'riz', 'kg', { prix: 700 }); // autre produit

    expect((await liste()).map((r) => r.prix_total)).toEqual([450]);
  });

  it('dit au connecté quelle est sa réaction et quel relevé est le sien', async () => {
    const [moi] = await lecteurs(1);
    const monReleve = await releveDe(moi.id, 460);
    const autreReleve = await nouveauReleve(450);
    await reagir(moi, autreReleve, 'contestation');

    const vue = Object.fromEntries((await liste(moi.client)).map((r) => [r.id, r]));

    expect(vue[monReleve]).toMatchObject({ est_le_mien: true, ma_reaction: null });
    expect(vue[autreReleve]).toMatchObject({ est_le_mien: false, ma_reaction: 'contestation' });
    expect((await liste())[0]).toMatchObject({ est_le_mien: false, ma_reaction: null }); // anonyme
  });
});

describe('seuil de contestation', () => {
  /** Trois relevés cohérents, puis un relevé plausible mais discuté (700 : pas aberrant, à moins d'un facteur 3). */
  async function relevesEtUnRelevediscute() {
    for (const prix of [450, 470, 480]) await nouveauReleve(prix);
    return nouveauReleve(700);
  }

  async function reactions(releveId: string, contestations: number, confirmations = 0) {
    const gens = await lecteurs(contestations + confirmations);
    for (const [i, personne] of gens.entries()) {
      await reagir(personne, releveId, i < contestations ? 'contestation' : 'confirmation');
    }
    return gens;
  }

  it('un relevé contesté par 3 personnes, plus qu’il n’est confirmé, sort du prix courant sans être supprimé', async () => {
    const discute = await relevesEtUnRelevediscute();
    expect((await prixCourant()).prix).toBe(475); // avec le relevé à 700

    await reactions(discute, 3);

    expect((await prixCourant()).prix).toBe(470); // sans lui
    const { data } = await admin.from('releves').select('prix_total').eq('marche_id', scenario.marcheId);
    expect(data).toHaveLength(4); // jamais supprimé
    expect((await liste()).find((r) => r.id === discute)).toMatchObject({ contestations: 3, conteste: true });
  });

  it('sous 3 contestations, le relevé reste dans le prix', async () => {
    const discute = await relevesEtUnRelevediscute();

    await reactions(discute, 2);

    expect((await prixCourant()).prix).toBe(475);
    expect((await liste()).find((r) => r.id === discute)).toMatchObject({ contestations: 2, conteste: false });
  });

  it('à égalité de confirmations, le relevé reste dans le prix', async () => {
    const discute = await relevesEtUnRelevediscute();

    await reactions(discute, 3, 3);

    expect((await prixCourant()).prix).toBe(475);
  });

  it('quand les confirmations dépassent les contestations, le relevé reste', async () => {
    const discute = await relevesEtUnRelevediscute();

    await reactions(discute, 3, 4);

    expect((await prixCourant()).prix).toBe(475);
  });

  it('retirer une contestation ramène le relevé dans le prix', async () => {
    const discute = await relevesEtUnRelevediscute();
    const contestants = await reactions(discute, 3);
    expect((await prixCourant()).prix).toBe(470);

    await contestants[0].client.from('reactions').delete().eq('releve_id', discute);

    expect((await prixCourant()).prix).toBe(475);
  });

  it('un relevé contesté ne compte plus pour la publication', async () => {
    await nouveauReleve(450);
    await nouveauReleve(470);
    const discute = await nouveauReleve(700); // trois contributeurs : le prix est publié
    expect((await prixCourant()).statut).toBe('publie');

    await reactions(discute, 3);

    expect((await prixCourant()).statut).toBe('pas_assez_de_donnees');
  });

  it('le seuil par défaut est de 3 contestations', async () => {
    const { data } = await admin.from('parametres').select('valeur').eq('cle', 'contestations_min_pour_exclure').single();

    expect(Number(data!.valeur)).toBe(3);
  });
});
