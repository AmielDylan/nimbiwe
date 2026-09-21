import { admin, contributeurConnecte, creerScenario, identifiants, lecteurAnonyme } from './aide';

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

    expect(revue.map((r) => r.prix_total).sort()).toEqual([5000, 6000]);
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
      expect(await aRevoir()).toEqual([]);
      expect((await prixCourant()).prix).toBe(600); // plus rien n'est écarté : médiane des cinq
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
    expect(prix).not.toBeNull();
  });
});

describe('pour revue', () => {
  it('un relevé aberrant n’est jamais supprimé : il reste en base, avec son auteur et la médiane de référence', async () => {
    await releverParContributeurs('maïs', [450, 470, 480, 4500]);

    const { data: tous } = await admin.from('releves').select('id').eq('marche_id', scenario.marcheId);
    const [revu] = await aRevoir();

    expect(tous).toHaveLength(4);
    expect(revu).toMatchObject({ produit: 'maïs', unite: 'kg', prix_total: 4500, contributeur: 'Test' });
    expect(revu.mediane_de_reference).toBeCloseTo(475, 3);
    expect(revu.rapport_a_la_mediane).toBeCloseTo(9.47, 2);
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
