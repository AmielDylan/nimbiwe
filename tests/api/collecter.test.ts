import { admin, contributeurConnecte, creerScenario, identifiants, ilYaJours, lecteurAnonyme } from './aide';

// Codes d'erreur propres à Nimbiwe, levés par la base (voir la migration « collecter_un_prix »).
const COMPTE_BLOQUE = 'NB001';
const LIMITE_QUOTIDIENNE = 'NB002';
const HORS_BORNES = 'NB003';
const DATE_INVALIDE = 'NB004';
const REFUSE_PAR_LA_SECURITE = '42501';
const CLE_ETRANGERE = '23503';
const COLONNE_CALCULEE = '428C9'; // insertion dans une colonne générée
const CONTRAINTE_VIOLEE = '23514'; // check_violation

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

async function contributeur() {
  const compte = await contributeurConnecte();
  comptes.push(compte);
  return compte;
}

async function lireSeuil(): Promise<number> {
  const { data } = await admin.from('parametres').select('valeur').eq('cle', 'collectes_max_par_jour').single();
  return data!.valeur as number;
}

/** Une collecte comme l'app l'envoie : seulement les champs autorisés. */
async function collecte(produit: string, unite: string, champs: Record<string, unknown> = {}) {
  return {
    ...(await identifiants(produit, unite)),
    marche_id: scenario.marcheId,
    quantite: 1,
    prix_total: 450,
    ...champs,
  };
}

describe('collecter un prix', () => {
  it('un contributeur connecté collecte un prix, qui contribue au prix courant', async () => {
    const auteur = await contributeur();
    const a = await scenario.contributeur();
    const b = await scenario.contributeur();
    await scenario.collecter(a, 'maïs', 'kg', { prix: 400 });
    await scenario.collecter(b, 'maïs', 'kg', { prix: 600 });

    const { error } = await auteur.client.from('collectes').insert(await collecte('maïs', 'kg', { prix_total: 500 }));

    expect(error).toBeNull();
    const { data: prix } = await lecteurAnonyme
      .from('prix_courants')
      .select('statut, prix, nombre_collectes')
      .eq('marche_id', scenario.marcheId)
      .single();
    expect(prix).toMatchObject({ statut: 'publie', prix: 500, nombre_collectes: 3 });
  });

  it('le serveur calcule le prix unitaire et attribue la collecte au contributeur connecté', async () => {
    const auteur = await contributeur();

    await auteur.client.from('collectes').insert(await collecte('riz', 'kg', { prix_total: 1000, quantite: 2 }));

    const { data } = await auteur.client.from('collectes').select('prix_unitaire, contributeur_id').single();
    expect(data).toEqual({ prix_unitaire: 500, contributeur_id: auteur.id });
  });

  it("refuse une unité qui n'est pas valide pour le produit", async () => {
    const auteur = await contributeur();

    const { error } = await auteur.client.from('collectes').insert(await collecte('huile végétale', 'kg'));

    expect(error?.code).toBe(CLE_ETRANGERE);
  });

  it("un lecteur non connecté ne peut pas collecter", async () => {
    const { error } = await lecteurAnonyme.from('collectes').insert(await collecte('maïs', 'kg'));

    expect(error?.code).toBe(REFUSE_PAR_LA_SECURITE);
  });
});

describe("le client n'écrit que les champs autorisés", () => {
  it.each([
    ['le prix unitaire', { prix_unitaire: 1 }, COLONNE_CALCULEE],
    ['le signal hors bornes', { hors_bornes: false }, REFUSE_PAR_LA_SECURITE],
    ['la date de création', { cree_le: '2020-01-01T00:00:00Z' }, REFUSE_PAR_LA_SECURITE],
    ['l’identifiant', { id: '00000000-0000-4000-8000-0000000000aa' }, REFUSE_PAR_LA_SECURITE],
  ])('refuse de forger %s', async (_nom, champ, codeAttendu) => {
    const auteur = await contributeur();

    const { error } = await auteur.client.from('collectes').insert(await collecte('maïs', 'kg', champ));

    expect(error?.code).toBe(codeAttendu);
    const { data } = await admin.from('collectes').select('id').eq('marche_id', scenario.marcheId);
    expect(data).toEqual([]);
  });

  it('ne permet pas de désigner un autre auteur pour la collecte', async () => {
    const auteur = await contributeur();
    const autre = await contributeur();

    const { error } = await auteur.client
      .from('collectes')
      .insert(await collecte('maïs', 'kg', { contributeur_id: autre.id }));

    expect(error?.code).toBe(REFUSE_PAR_LA_SECURITE);
  });

  it('ne permet ni de modifier ni de supprimer une collecte envoyée', async () => {
    const auteur = await contributeur();
    await auteur.client.from('collectes').insert(await collecte('maïs', 'kg'));

    const modification = await auteur.client.from('collectes').update({ prix_total: 1 }).eq('contributeur_id', auteur.id);
    const suppression = await auteur.client.from('collectes').delete().eq('contributeur_id', auteur.id);

    expect(modification.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    expect(suppression.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
  });
});

describe('valeurs aberrantes', () => {
  it.each([
    ['un prix NaN', { prix_total: 'NaN' }],
    ['un prix infini', { prix_total: 'Infinity' }],
    ['un prix démesuré', { prix_total: 1e9 }],
    ['une quantité nulle', { quantite: 0 }],
    ['une quantité NaN', { quantite: 'NaN' }],
    ['une quantité démesurée', { quantite: 1e6 }],
    ['un prix négatif', { prix_total: -5 }],
  ])('refuse %s, même confirmé', async (_nom, champs) => {
    const auteur = await contributeur();

    const { error } = await auteur.client
      .from('collectes')
      .insert(await collecte('maïs', 'kg', { ...champs, hors_bornes_confirme: true }));

    expect(error?.code).toBe(CONTRAINTE_VIOLEE);
    const { data } = await admin.from('collectes').select('id').eq('marche_id', scenario.marcheId);
    expect(data).toEqual([]);
  });

  it('une confirmation nulle envoyée explicitement ne contourne rien', async () => {
    const auteur = await contributeur();

    const { error } = await auteur.client
      .from('collectes')
      .insert(await collecte('maïs', 'kg', { prix_total: 5000, hors_bornes_confirme: null }));

    expect(error?.code).toBe(HORS_BORNES);
  });
});

describe('bornes plausibles', () => {
  it("un produit sans bornes connues n'est jamais hors bornes", async () => {
    const auteur = await contributeur();
    const { data: produit } = await admin.from('produits').insert({ nom: `produit-test-${crypto.randomUUID()}` }).select('id').single();
    const { data: unite } = await admin.from('unites').select('id').eq('symbole', 'kg').single();
    await admin.from('produits_unites').insert({ produit_id: produit!.id, unite_id: unite!.id });
    try {
      const { error } = await auteur.client.from('collectes').insert({
        produit_id: produit!.id,
        unite_id: unite!.id,
        marche_id: scenario.marcheId,
        quantite: 1,
        prix_total: 9_000_000,
      });

      expect(error).toBeNull();
      const { data } = await auteur.client.from('collectes').select('hors_bornes').eq('produit_id', produit!.id).single();
      expect(data?.hors_bornes).toBe(false);
    } finally {
      await admin.from('collectes').delete().eq('produit_id', produit!.id);
      await admin.from('produits_unites').delete().eq('produit_id', produit!.id);
      await admin.from('produits').delete().eq('id', produit!.id);
    }
  });

  it("un prix hors bornes est refusé tant que le contributeur ne le confirme pas, dans le sens indiqué", async () => {
    const auteur = await contributeur();

    const trop = await auteur.client.from('collectes').insert(await collecte('maïs', 'kg', { prix_total: 5000 }));
    const peu = await auteur.client.from('collectes').insert(await collecte('maïs', 'kg', { prix_total: 10 }));

    expect(trop.error).toMatchObject({ code: HORS_BORNES, hint: 'haut' });
    expect(peu.error).toMatchObject({ code: HORS_BORNES, hint: 'bas' });
    const { data } = await admin.from('collectes').select('id').eq('marche_id', scenario.marcheId);
    expect(data).toEqual([]);
  });

  it('un prix hors bornes confirmé est enregistré, avec sa confirmation', async () => {
    const auteur = await contributeur();

    const { error } = await auteur.client
      .from('collectes')
      .insert(await collecte('maïs', 'kg', { prix_total: 5000, hors_bornes_confirme: true }));

    expect(error).toBeNull();
    const { data } = await auteur.client.from('collectes').select('hors_bornes, hors_bornes_confirme').single();
    expect(data).toEqual({ hors_bornes: true, hors_bornes_confirme: true });
  });

  it("une confirmation inutile n'est pas enregistrée : un prix dans les bornes n'est jamais « confirmé »", async () => {
    const auteur = await contributeur();

    await auteur.client
      .from('collectes')
      .insert(await collecte('maïs', 'kg', { prix_total: 450, hors_bornes_confirme: true }));

    const { data } = await auteur.client.from('collectes').select('hors_bornes, hors_bornes_confirme').single();
    expect(data).toEqual({ hors_bornes: false, hors_bornes_confirme: false });
  });

  it("juge le prix unitaire : 900 FCFA pour 2 kg de maïs est dans les bornes", async () => {
    const auteur = await contributeur();

    const { error } = await auteur.client.from('collectes').insert(await collecte('maïs', 'kg', { prix_total: 900, quantite: 2 }));

    expect(error).toBeNull();
  });
});

describe('limite de fréquence', () => {
  it('refuse la collecte excédentaire du jour pour un même produit et marché, avec le seuil par défaut de 5', async () => {
    const auteur = await contributeur();
    for (let i = 0; i < 5; i++) {
      const { error } = await auteur.client.from('collectes').insert(await collecte('gari', 'kg', { prix_total: 500 + i }));
      expect(error).toBeNull();
    }

    const sixieme = await auteur.client.from('collectes').insert(await collecte('gari', 'kg'));

    expect(sixieme.error?.code).toBe(LIMITE_QUOTIDIENNE);
  });

  it('tient la limite même quand les envois arrivent en même temps', async () => {
    const auteur = await contributeur();
    const ligne = await collecte('gari', 'kg');

    const reponses = await Promise.all(
      Array.from({ length: 10 }, () => auteur.client.from('collectes').insert(ligne)),
    );

    expect(reponses.filter((r) => r.error === null)).toHaveLength(5);
    expect(reponses.filter((r) => r.error?.code === LIMITE_QUOTIDIENNE)).toHaveLength(5);
  });

  it("ne limite ni un autre produit, ni un autre contributeur", async () => {
    const auteur = await contributeur();
    const autre = await contributeur();
    const seuilInitial = await lireSeuil();
    await admin.from('parametres').update({ valeur: 1 }).eq('cle', 'collectes_max_par_jour');
    try {
      await auteur.client.from('collectes').insert(await collecte('gari', 'kg'));

      const autreProduit = await auteur.client.from('collectes').insert(await collecte('riz', 'kg', { prix_total: 700 }));
      const autreContributeur = await autre.client.from('collectes').insert(await collecte('gari', 'kg'));

      expect(autreProduit.error).toBeNull();
      expect(autreContributeur.error).toBeNull();
    } finally {
      await admin.from('parametres').update({ valeur: seuilInitial }).eq('cle', 'collectes_max_par_jour');
    }
  });

  it('le seuil est paramétrable', async () => {
    const auteur = await contributeur();
    const seuilInitial = await lireSeuil();
    await admin.from('parametres').update({ valeur: 2 }).eq('cle', 'collectes_max_par_jour');
    try {
      await auteur.client.from('collectes').insert(await collecte('gari', 'kg'));
      await auteur.client.from('collectes').insert(await collecte('gari', 'kg'));

      const troisieme = await auteur.client.from('collectes').insert(await collecte('gari', 'kg'));

      expect(troisieme.error?.code).toBe(LIMITE_QUOTIDIENNE);
    } finally {
      await admin.from('parametres').update({ valeur: seuilInitial }).eq('cle', 'collectes_max_par_jour');
    }
  });

  it('un client ne lit ni ne modifie les paramètres', async () => {
    const auteur = await contributeur();

    const lecture = await auteur.client.from('parametres').select('*');
    const modification = await auteur.client.from('parametres').update({ valeur: 1000 }).eq('cle', 'collectes_max_par_jour');

    expect(lecture.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    expect(modification.error?.code).toBe(REFUSE_PAR_LA_SECURITE);
  });
});

describe('numéro bloqué', () => {
  it('un compte marqué bloqué ne peut plus collecter, et peut de nouveau une fois débloqué', async () => {
    const auteur = await contributeur();
    await admin.from('profils').update({ est_bloque: true }).eq('id', auteur.id);

    const bloque = await auteur.client.from('collectes').insert(await collecte('maïs', 'kg'));
    await admin.from('profils').update({ est_bloque: false }).eq('id', auteur.id);
    const debloque = await auteur.client.from('collectes').insert(await collecte('maïs', 'kg'));

    expect(bloque.error?.code).toBe(COMPTE_BLOQUE);
    expect(debloque.error).toBeNull();
  });

  it('un contributeur ne peut pas se débloquer lui-même', async () => {
    const auteur = await contributeur();
    await admin.from('profils').update({ est_bloque: true }).eq('id', auteur.id);

    const { error } = await auteur.client.from('profils').update({ est_bloque: false }).eq('id', auteur.id);

    expect(error?.code).toBe(REFUSE_PAR_LA_SECURITE);
    const { data } = await admin.from('profils').select('est_bloque').eq('id', auteur.id).single();
    expect(data?.est_bloque).toBe(true);
  });
});

describe("date d'observation", () => {
  it('refuse une date dans le futur ou de plus de 7 jours, accepte une date récente', async () => {
    const auteur = await contributeur();

    const futur = await auteur.client
      .from('collectes')
      .insert(await collecte('maïs', 'kg', { observe_le: new Date(Date.now() + 3_600_000).toISOString() }));
    const ancienne = await auteur.client
      .from('collectes')
      .insert(await collecte('maïs', 'kg', { observe_le: ilYaJours(8) }));
    const recente = await auteur.client
      .from('collectes')
      .insert(await collecte('maïs', 'kg', { observe_le: ilYaJours(3) }));

    expect(futur.error?.code).toBe(DATE_INVALIDE);
    expect(ancienne.error?.code).toBe(DATE_INVALIDE);
    expect(recente.error).toBeNull();
  });
});

describe('mes collectes', () => {
  it('un contributeur voit ses dernières collectes, avec les noms du produit, du marché et de l’unité, et pas celles des autres', async () => {
    const auteur = await contributeur();
    const autre = await contributeur();
    await auteur.client.from('collectes').insert(await collecte('maïs', 'kg', { prix_total: 400 }));
    await auteur.client.from('collectes').insert(await collecte('riz', 'kg', { prix_total: 700 }));
    await autre.client.from('collectes').insert(await collecte('gari', 'kg', { prix_total: 500 }));

    const { data, error } = await auteur.client
      .from('collectes')
      .select('prix_total, quantite, observe_le, produits(nom), unites(symbole), marches(nom)')
      .order('observe_le', { ascending: false });

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data?.map((c) => [(c.produits as unknown as { nom: string }).nom, c.prix_total]).sort()).toEqual([
      ['maïs', 400],
      ['riz', 700],
    ]);
  });
});
