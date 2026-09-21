import { admin, contributeurConnecte, creerScenario, identifiants, ilYaJours, lecteurAnonyme } from './aide';

const REFUSE_PAR_LA_SECURITE = '42501';

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

/** Un relevé par contributeur ordinaire (poids égaux), envoyé par l'accès administrateur : sans garde-fous. */
async function releverParContributeurs(produit: string, prix: number[]) {
  for (const montant of prix) {
    await scenario.relever(await scenario.contributeur(), produit, 'kg', { prix: montant });
  }
}

async function prixCourant(produit = 'maïs') {
  const { data, error } = await lecteurAnonyme
    .from('prix_courants')
    .select('prix, statut, nombre_releves')
    .eq('marche_id', scenario.marcheId)
    .eq('produit', produit)
    .single();
  expect(error).toBeNull();
  return data!;
}

async function aRevoir() {
  const { data, error } = await admin.from('releves_a_revoir').select('*').eq('marche', await nomDuMarche());
  expect(error).toBeNull();
  return data ?? [];
}

async function nomDuMarche() {
  const { data } = await admin.from('marches').select('nom').eq('id', scenario.marcheId).single();
  return data!.nom as string;
}

async function reglerParametre(cle: string, valeur: number) {
  const { data } = await admin.from('parametres').select('valeur').eq('cle', cle).single();
  await admin.from('parametres').update({ valeur }).eq('cle', cle);
  return () => admin.from('parametres').update({ valeur: data!.valeur }).eq('cle', cle);
}

describe('relevé aberrant', () => {
  it('un relevé très éloigné de la médiane est marqué aberrant, et écarté du prix courant', async () => {
    await releverParContributeurs('maïs', [400, 500, 600, 5000, 6000]); // la médiane de référence est 600

    const revue = await aRevoir();
    const { prix, nombre_releves } = await prixCourant();

    expect(revue.map((r) => r.prix_total).sort((a, b) => a - b)).toEqual([5000, 6000]);
    expect(prix).toBe(500); // médiane des trois relevés restants, non 600
    expect(nombre_releves).toBe(3);
  });

  it("un relevé aberrant n'altère pas le prix courant : le prix est le même sans lui", async () => {
    await releverParContributeurs('maïs', [450, 470, 480]);
    const sansAberrant = (await prixCourant()).prix;

    await releverParContributeurs('maïs', [9000]);

    expect((await prixCourant()).prix).toBe(sansAberrant);
    expect(await aRevoir()).toHaveLength(1);
  });

  it("l'écart se juge dans les deux sens : un prix très bas est écarté aussi", async () => {
    await releverParContributeurs('maïs', [600, 620, 640, 100]);

    expect((await aRevoir()).map((r) => r.prix_total)).toEqual([100]);
    expect((await prixCourant()).prix).toBe(620);
  });

  it('le seuil est paramétrable : un facteur plus large tolère davantage', async () => {
    await releverParContributeurs('maïs', [400, 500, 600, 5000, 6000]);
    const restaurer = await reglerParametre('facteur_ecart_aberrant', 20);
    try {
      // Plus aucun verdict actuel : la médiane des cinq relevés. La décision prise à l'envoi reste relisible.
      expect((await aRevoir()).some((r) => r.aberrant_actuellement)).toBe(false);
      expect((await prixCourant()).prix).toBe(600);
    } finally {
      await restaurer();
    }
  });

  it("le jugement est strict : exactement au facteur n'est pas aberrant, un peu au-delà l'est", async () => {
    await releverParContributeurs('maïs', [600, 600, 600, 1800]); // 1 800 = 3 × la médiane de référence (600)
    expect(await aRevoir()).toEqual([]);

    await releverParContributeurs('maïs', [1801]);

    expect((await aRevoir()).map((r) => r.prix_total)).toEqual([1801]);
  });

  it('le poids du relais relève la médiane de référence : un relevé qui serait écarté sans lui ne l\'est pas', async () => {
    // Contributeurs 400, 450, 480 et 1 500 ; relais à 1 000 (poids 3 fois plus lourd).
    // Sans poids de relais, la médiane serait 480 et 1 500 (> 3 × 480) serait écarté.
    // Avec lui, la référence monte à 740 : 1 500 n'est plus à plus d'un facteur 3.
    await releverParContributeurs('maïs', [400, 450, 480, 1500]);
    await scenario.relever(await scenario.contributeur({ relais: true }), 'maïs', 'kg', { prix: 1000 });
    expect((await aRevoir()).filter((r) => r.aberrant_actuellement)).toEqual([]);

    const restaurer = await reglerParametre('poids_releve_de_relais', 1); // le relais ne pèse plus plus que les autres
    try {
      expect((await aRevoir()).filter((r) => r.aberrant_actuellement).map((r) => r.prix_total)).toEqual([1500]);
    } finally {
      await restaurer();
    }
  });

  it('un écart modéré n’est pas aberrant', async () => {
    await releverParContributeurs('maïs', [400, 450, 500, 700]); // 700 est à moins d'un facteur 3 de la médiane

    expect(await aRevoir()).toEqual([]);
  });

  it('un relevé aberrant ne compte pas pour la publication : deux relevés valables et un aberrant ne suffisent pas', async () => {
    await releverParContributeurs('maïs', [450, 470, 9000]);

    expect(await prixCourant()).toMatchObject({ statut: 'pas_assez_de_donnees', prix: null });
  });
});

describe('sans assez de relevés pour établir une médiane', () => {
  it('aucun relevé n’est écarté sous le minimum de 3 relevés', async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.relever(relais, 'maïs', 'kg', { prix: 500 });
    await scenario.relever(await scenario.contributeur(), 'maïs', 'kg', { prix: 5000 });

    expect(await aRevoir()).toEqual([]);
    expect(await prixCourant()).toMatchObject({ statut: 'publie', nombre_releves: 2 });
  });

  it('dès le troisième relevé, le jugement s’applique', async () => {
    await releverParContributeurs('maïs', [450, 470, 5000]);

    expect((await aRevoir()).map((r) => r.prix_total)).toEqual([5000]);
  });

  it('le minimum est paramétrable', async () => {
    await releverParContributeurs('maïs', [450, 470, 5000]);
    const restaurer = await reglerParametre('releves_min_pour_mediane', 4);
    try {
      expect(await aRevoir()).toEqual([]);
    } finally {
      await restaurer();
    }
  });

  it("le relevé d'un relais sert d'ancre : il n'est jamais écarté, même très éloigné de la médiane", async () => {
    await releverParContributeurs('maïs', [400, 450, 480, 500]);
    const relais = await scenario.contributeur({ relais: true });
    await scenario.relever(relais, 'maïs', 'kg', { prix: 2000 });

    expect(await aRevoir()).toEqual([]);
    const { statut, prix } = await prixCourant();
    expect(statut).toBe('publie');
    // Poids : 4 contributeurs à 0,5 et le relais à 1,5 (3 × 0,5) ; la médiane pondérée tombe sur 500.
    expect(prix).toBeCloseTo(500, 3);
  });

  it("avec deux relevés seulement, le prix publié est tiré vers celui du relais", async () => {
    await scenario.relever(await scenario.contributeur({ relais: true }), 'maïs', 'kg', { prix: 500 });
    await scenario.relever(await scenario.contributeur(), 'maïs', 'kg', { prix: 5000 });

    // Poids 1,5 et 0,5 : la médiane est lue entre 500 et 5 000, plus près de 500 que de la moyenne (2 750).
    const { prix } = await prixCourant();
    expect(prix).toBeCloseTo(1625, 3);
    expect(prix).toBeLessThan(2750);
  });
});

describe('un seul compte ne peut pas déplacer la médiane', () => {
  it('seul le dernier relevé de chaque contributeur compte : trois relevés extrêmes d’un même compte n’en font qu’un', async () => {
    await releverParContributeurs('maïs', [450, 470, 480]);
    const insistant = await scenario.contributeur();
    for (const prix of [8000, 9000, 9500]) await scenario.relever(insistant, 'maïs', 'kg', { prix });

    const { prix, nombre_releves } = await prixCourant();

    expect(prix).toBe(470); // médiane des trois contributeurs honnêtes
    expect(nombre_releves).toBe(3);
    // Les trois relevés extrêmes ont été marqués à l'envoi (ils se relisent), mais seul le dernier compte.
    const revue = await aRevoir();
    expect(revue.map((r) => r.prix_total).sort((a, b) => a - b)).toEqual([8000, 9000, 9500]);
    expect(revue.filter((r) => r.aberrant_actuellement).map((r) => r.prix_total)).toEqual([9500]);
  });

  it('le minimum de 3 relevés compte des contributeurs distincts : un seul compte ne suffit pas à établir la médiane', async () => {
    const seul = await scenario.contributeur();
    for (const prix of [450, 460, 9000]) await scenario.relever(seul, 'maïs', 'kg', { prix });

    expect(await aRevoir()).toEqual([]); // un seul contributeur : rien n'est jugé
    expect(await prixCourant()).toMatchObject({ statut: 'pas_assez_de_donnees', nombre_releves: 1 });
  });
});

describe('pour revue', () => {
  it("le marquage est fait à l'envoi et se garde : il survit au vieillissement du relevé", async () => {
    await releverParContributeurs('maïs', [450, 470, 480]);
    const extreme = await scenario.contributeur();
    await scenario.relever(extreme, 'maïs', 'kg', { prix: 4500 });

    const { data: marque } = await admin.from('releves').select('id, aberrant_a_l_envoi, mediane_a_l_envoi').eq('contributeur_id', extreme).single();
    expect(marque!.aberrant_a_l_envoi).toBe(true);
    expect(marque!.mediane_a_l_envoi).toBeCloseTo(470, 3);

    // Le relevé vieillit : plus de verdict en direct, mais la décision prise à l'envoi reste relisible.
    await admin.from('releves').update({ observe_le: ilYaJours(10) }).eq('id', marque!.id);

    expect((await prixCourant()).prix).toBe(470);
    const revue = await aRevoir();
    expect(revue).toHaveLength(1);
    expect(revue[0]).toMatchObject({ prix_total: 4500, marque_a_l_envoi: true, aberrant_actuellement: false });
  });

  it("un relevé envoyé avant d'avoir 3 relevés n'est pas marqué, ni un relevé de plus de 7 jours", async () => {
    await releverParContributeurs('maïs', [450, 5000]); // sous le minimum
    await releverParContributeurs('maïs', [470, 480]);
    await scenario.relever(await scenario.contributeur(), 'maïs', 'kg', { prix: 9000, joursPasses: 10 });

    const { data } = await admin.from('releves').select('prix_total, aberrant_a_l_envoi').eq('marche_id', scenario.marcheId);
    const marques = Object.fromEntries(data!.map((r) => [r.prix_total, r.aberrant_a_l_envoi]));

    expect(marques[5000]).toBe(false); // envoyé quand il n'y avait qu'un relevé de référence
    expect(marques[9000]).toBe(false); // trop ancien pour être jugé
  });

  it("le client ne lit ni n'écrit le marquage", async () => {
    const compte = await contributeurConnecte();
    comptes.push(compte);
    const lecture = await compte.client.from('releves').select('aberrant_a_l_envoi, mediane_a_l_envoi');
    const ecriture = await compte.client.from('releves').insert({
      ...(await identifiants('maïs', 'kg')),
      marche_id: scenario.marcheId,
      quantite: 1,
      prix_total: 450,
      aberrant_a_l_envoi: true,
    });

    expect(lecture.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    expect(ecriture.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
  });

  it('un relevé aberrant n’est jamais supprimé : il reste en base, avec son auteur et la médiane de référence', async () => {
    await releverParContributeurs('maïs', [450, 470, 480, 4500]);

    const { data: tous } = await admin.from('releves').select('id').eq('marche_id', scenario.marcheId);
    const [revu] = await aRevoir();

    expect(tous).toHaveLength(4);
    expect(revu).toMatchObject({ produit: 'maïs', unite: 'kg', prix_total: 4500, contributeur: 'Test' });
    expect(revu.mediane_a_l_envoi).toBeCloseTo(470, 3);
    expect(revu.rapport_a_la_mediane).toBeCloseTo(9.57, 2);
  });

  it("l'auteur continue de voir son relevé écarté dans la liste de ses relevés", async () => {
    await releverParContributeurs('maïs', [450, 470, 480]);
    const auteur = await contributeurConnecte();
    comptes.push(auteur);
    const envoi = await auteur.client.from('releves').insert({
      ...(await identifiants('maïs', 'kg')),
      marche_id: scenario.marcheId,
      quantite: 1,
      prix_total: 5000,
      hors_bornes_confirme: true,
    });
    expect(envoi.error).toBeNull();

    const { data } = await auteur.client.from('releves').select('prix_total');

    expect(data).toEqual([{ prix_total: 5000 }]);
    expect(await aRevoir()).toHaveLength(1);
  });

  it('un prix hors bornes confirmé volontairement se distingue d’une simple faute de frappe', async () => {
    // maïs : 5 000 est hors bornes, le contributeur l'a confirmé.
    await releverParContributeurs('maïs', [450, 470, 480]);
    const volontaire = await contributeurConnecte();
    comptes.push(volontaire);
    await volontaire.client.from('releves').insert({
      ...(await identifiants('maïs', 'kg')),
      marche_id: scenario.marcheId,
      quantite: 1,
      prix_total: 5000,
      hors_bornes_confirme: true,
    });
    // piment : 5 500 est dans les bornes (500 à 6 000) mais très loin de la médiane, sans confirmation.
    await releverParContributeurs('piment', [900, 1000, 1100]);
    const distrait = await contributeurConnecte();
    comptes.push(distrait);
    await distrait.client.from('releves').insert({
      ...(await identifiants('piment', 'kg')),
      marche_id: scenario.marcheId,
      quantite: 1,
      prix_total: 5500,
    });

    const revue = await aRevoir();
    const parProduit = Object.fromEntries(revue.map((r) => [r.produit, r]));

    expect(parProduit['maïs']).toMatchObject({ hors_bornes: true, hors_bornes_confirme: true });
    expect(parProduit['maïs'].nature).toMatch(/confirmé volontairement/);
    expect(parProduit['piment']).toMatchObject({ hors_bornes: false, hors_bornes_confirme: false });
    expect(parProduit['piment'].nature).toMatch(/probable faute de frappe/);
  });

  it("la revue est réservée au développeur : ni un lecteur anonyme ni un contributeur n'y accèdent", async () => {
    await releverParContributeurs('maïs', [450, 470, 480, 4500]);
    const compte = await contributeurConnecte();
    comptes.push(compte);

    const anonyme = await lecteurAnonyme.from('releves_a_revoir').select('*');
    const connecte = await compte.client.from('releves_a_revoir').select('*');
    const evalues = await compte.client.from('releves_evalues').select('*');

    expect(anonyme.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    expect(connecte.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    expect(evalues.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
  });

  it('les valeurs par défaut sont un facteur 3 et un minimum de 3 relevés', async () => {
    const { data } = await admin.from('parametres').select('cle, valeur').in('cle', ['facteur_ecart_aberrant', 'releves_min_pour_mediane']);

    expect(Object.fromEntries(data!.map((p) => [p.cle, Number(p.valeur)]))).toEqual({
      facteur_ecart_aberrant: 3,
      releves_min_pour_mediane: 3,
    });
  });
});
