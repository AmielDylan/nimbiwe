import {
  admin,
  contributeurConnecte,
  creerScenario,
  identifiants,
  lecteurAnonyme,
  numeroDeTestNeuf,
  seConnecter,
} from './aide';

const REFUSE_PAR_LA_SECURITE = '42501';
const CONTRAINTE_VIOLEE = '23514';

type Scenario = Awaited<ReturnType<typeof creerScenario>>;
type Contributeur = Awaited<ReturnType<typeof contributeurConnecte>>;

// Les marchés de test ont des coordonnées, et les relevés y sont envoyés depuis le marché
// même : la position est vérifiée (poids 1), ce qui rend les résultats indépendants du
// réglage « poids sans position », que d'autres fichiers de test modifient.
const MARCHE = { latitude: 6.36, longitude: 2.43 };

let scenario: Scenario; // le marché où l'on travaille
let autreMarche: Scenario;
const comptes: Contributeur[] = [];

beforeEach(async () => {
  scenario = await creerScenario(MARCHE);
  autreMarche = await creerScenario(MARCHE);
});

afterEach(async () => {
  for (const compte of comptes.splice(0)) await compte.nettoyer();
  await scenario.nettoyer();
  await autreMarche.nettoyer();
});

async function contributeurConnecteEtEnregistre() {
  const compte = await contributeurConnecte();
  comptes.push(compte);
  return compte;
}

async function designerRelais(compteId: string, marcheId: number) {
  const { error } = await admin.from('profils').update({ est_relais: true, marche_relais_id: marcheId }).eq('id', compteId);
  if (error) throw error;
}

async function envoyerUnReleve(compte: Contributeur, marcheId: number, prix = 450) {
  const { error } = await compte.client.from('releves').insert({
    ...(await identifiants('maïs', 'kg')),
    marche_id: marcheId,
    quantite: 1,
    prix_total: prix,
  });
  expect(error).toBeNull();
}

async function marqueDuDernierReleve(compteId: string) {
  const { data } = await admin
    .from('releves')
    .select('par_relais')
    .eq('contributeur_id', compteId)
    .order('cree_le', { ascending: false })
    .limit(1)
    .single();
  return data!.par_relais as boolean;
}

describe('désignation d’un relais', () => {
  it('le développeur désigne un relais et le rattache à un marché depuis la base', async () => {
    const compte = await contributeurConnecteEtEnregistre();

    await designerRelais(compte.id, scenario.marcheId);

    const { data } = await admin.from('profils').select('est_relais, marche_relais_id').eq('id', compte.id).single();
    expect(data).toEqual({ est_relais: true, marche_relais_id: scenario.marcheId });
  });

  it("un contributeur ne peut pas s'attribuer le rôle de relais, ni se rattacher à un marché", async () => {
    const compte = await contributeurConnecteEtEnregistre();

    const role = await compte.client.from('profils').update({ est_relais: true }).eq('id', compte.id);
    const marche = await compte.client.from('profils').update({ marche_relais_id: scenario.marcheId }).eq('id', compte.id);
    const les_deux = await compte.client
      .from('profils')
      .update({ est_relais: true, marche_relais_id: scenario.marcheId })
      .eq('id', compte.id);

    expect(role.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    expect(marche.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    expect(les_deux.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    const { data } = await admin.from('profils').select('est_relais, marche_relais_id').eq('id', compte.id).single();
    expect(data).toEqual({ est_relais: false, marche_relais_id: null });
  });

  it('un relais se connecte par SMS comme tout le monde : même compte, même rôle, il relève comme les autres', async () => {
    const telephone = await numeroDeTestNeuf('relais');
    const premiere = await seConnecter(telephone);
    await designerRelais(premiere.utilisateurId, scenario.marcheId);
    await premiere.client.auth.signOut();
    await new Promise((resolve) => setTimeout(resolve, 1500)); // délai minimal entre deux codes (config locale : 1 s)

    const seconde = await seConnecter(telephone);
    const profil = await seconde.client.from('profils').select('est_relais, marche_relais_id').eq('id', seconde.utilisateurId).single();
    const releve = await seconde.client.from('releves').insert({
      ...(await identifiants('maïs', 'kg')),
      marche_id: scenario.marcheId,
      quantite: 1,
      prix_total: 450,
    });

    expect(seconde.utilisateurId).toBe(premiere.utilisateurId);
    expect(profil.data).toEqual({ est_relais: true, marche_relais_id: scenario.marcheId });
    expect(releve.error).toBeNull();
    expect(await marqueDuDernierReleve(seconde.utilisateurId)).toBe(true);
  });

  it('un contributeur ne peut ni créer ni supprimer de profil : aucun chemin de contournement', async () => {
    const compte = await contributeurConnecteEtEnregistre();

    const creation = await compte.client.from('profils').insert({ id: crypto.randomUUID(), est_relais: true, marche_relais_id: scenario.marcheId });
    const suppression = await compte.client.from('profils').delete().eq('id', compte.id);

    expect(creation.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    expect(suppression.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
  });

  it('le statut de relais et le marché vont ensemble', async () => {
    const compte = await contributeurConnecteEtEnregistre();

    const sansMarche = await admin.from('profils').update({ est_relais: true }).eq('id', compte.id);
    const sansStatut = await admin.from('profils').update({ marche_relais_id: scenario.marcheId }).eq('id', compte.id);

    expect(sansMarche.error?.code).toBe(CONTRAINTE_VIOLEE);
    expect(sansStatut.error?.code).toBe(CONTRAINTE_VIOLEE);
  });
});

describe('les relevés d’un relais sont reconnaissables', () => {
  it('un relevé fait par un relais sur son marché est marqué', async () => {
    const relais = await contributeurConnecteEtEnregistre();
    await designerRelais(relais.id, scenario.marcheId);

    await envoyerUnReleve(relais, scenario.marcheId);

    expect(await marqueDuDernierReleve(relais.id)).toBe(true);
  });

  it("un relevé d'un relais sur un autre marché que le sien n'est pas marqué", async () => {
    const relais = await contributeurConnecteEtEnregistre();
    await designerRelais(relais.id, scenario.marcheId);

    await envoyerUnReleve(relais, autreMarche.marcheId);

    expect(await marqueDuDernierReleve(relais.id)).toBe(false);
  });

  it("un relevé d'un contributeur ordinaire n'est pas marqué", async () => {
    const compte = await contributeurConnecteEtEnregistre();

    await envoyerUnReleve(compte, scenario.marcheId);

    expect(await marqueDuDernierReleve(compte.id)).toBe(false);
  });

  it('le marquage est figé à l’envoi : il survit à la perte du statut', async () => {
    const relais = await contributeurConnecteEtEnregistre();
    await designerRelais(relais.id, scenario.marcheId);
    await envoyerUnReleve(relais, scenario.marcheId);

    await admin.from('profils').update({ est_relais: false, marche_relais_id: null }).eq('id', relais.id);

    expect(await marqueDuDernierReleve(relais.id)).toBe(true);
  });

  it('le client ne peut ni lire ni écrire le marquage', async () => {
    const relais = await contributeurConnecteEtEnregistre();
    await designerRelais(relais.id, scenario.marcheId);
    await envoyerUnReleve(relais, scenario.marcheId);

    const lecture = await relais.client.from('releves').select('par_relais');
    const ecriture = await relais.client.from('releves').insert({
      ...(await identifiants('maïs', 'kg')),
      marche_id: scenario.marcheId,
      quantite: 1,
      prix_total: 450,
      par_relais: true,
    });

    expect(lecture.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    expect(ecriture.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
  });
});

describe('poids des relais dans le prix courant', () => {
  async function prix(marcheId = scenario.marcheId) {
    const { data, error } = await lecteurAnonyme
      .from('prix_courants')
      .select('prix, statut')
      .eq('marche_id', marcheId)
      .single();
    expect(error).toBeNull();
    return data!;
  }

  // Positions vérifiées : les poids sont 3 (relais) ; 1 ; 1 — totaux 5, positions 0,3 et 0,7.
  async function relaisEtDeuxContributeurs(scene: Scenario = scenario, relais: boolean | number = true) {
    const sur = { position: MARCHE };
    await scene.relever(await scene.contributeur({ relais }), 'maïs', 'kg', { prix: 400, ...sur });
    await scene.relever(await scene.contributeur(), 'maïs', 'kg', { prix: 800, ...sur });
    await scene.relever(await scene.contributeur(), 'maïs', 'kg', { prix: 1200, ...sur });
  }

  it('à relevés identiques, un relevé de relais tire la médiane vers lui', async () => {
    await relaisEtDeuxContributeurs();

    const { prix: mediane, statut } = await prix();

    expect(statut).toBe('publie');
    expect(mediane).toBeCloseTo(600, 3); // 400 + (0,5 − 0,3) / (0,7 − 0,3) × 400 ; la médiane simple serait 800
  });

  it('le poids des relais est paramétrable : à 1, plus aucune différence', async () => {
    const { data: initial } = await admin.from('parametres').select('valeur').eq('cle', 'poids_releve_de_relais').single();
    await relaisEtDeuxContributeurs();
    await admin.from('parametres').update({ valeur: 1 }).eq('cle', 'poids_releve_de_relais');
    try {
      expect((await prix()).prix).toBe(800);
    } finally {
      await admin.from('parametres').update({ valeur: initial!.valeur }).eq('cle', 'poids_releve_de_relais');
    }
  });

  it("le relais d'un autre marché pèse comme un contributeur ordinaire ici", async () => {
    await relaisEtDeuxContributeurs(scenario, autreMarche.marcheId);

    expect((await prix()).prix).toBe(800); // médiane simple : aucun poids de relais
  });

  it("un relais ancre la publication de son marché, pas celle des autres", async () => {
    const relaisDAilleurs = await scenario.contributeur({ relais: autreMarche.marcheId });
    await scenario.relever(relaisDAilleurs, 'maïs', 'kg', { prix: 500 });

    expect(await prix()).toEqual({ statut: 'pas_assez_de_donnees', prix: null });
  });

  it('un seul relevé du relais du marché suffit à publier', async () => {
    await scenario.relever(await scenario.contributeur({ relais: true }), 'maïs', 'kg', { prix: 500 });

    expect(await prix()).toEqual({ statut: 'publie', prix: 500 });
  });

  it("retirer le statut de relais retire aussitôt son poids et son ancrage, sans toucher au marquage historique", async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.relever(relais, 'maïs', 'kg', { prix: 500 });
    expect((await prix()).statut).toBe('publie');

    await admin.from('profils').update({ est_relais: false, marche_relais_id: null }).eq('id', relais);

    expect((await prix()).statut).toBe('pas_assez_de_donnees');
    const { data } = await admin.from('releves').select('par_relais').eq('contributeur_id', relais).single();
    expect(data!.par_relais).toBe(true); // la trace reste : « fait par un relais à ce moment-là »
  });

  it('un relais déplacé vers un autre marché cesse d’ancrer l’ancien', async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.relever(relais, 'maïs', 'kg', { prix: 500 });

    await admin.from('profils').update({ marche_relais_id: autreMarche.marcheId }).eq('id', relais);

    expect((await prix()).statut).toBe('pas_assez_de_donnees');
  });
});
