import { admin, contributeurConnecte, creerScenario, identifiants, ilYaJours, lecteurAnonyme } from './aide';

const COMPTE_BLOQUE = 'NB001';
const DATE_INVALIDE = 'NB004';
const DOUBLON = '23505';

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

/** Un relevé tel que le téléphone le garde en attente : avec son identifiant et sa date de saisie. */
async function saisie(champs: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    ...(await identifiants('maïs', 'kg')),
    marche_id: scenario.marcheId,
    quantite: 1,
    prix_total: 450,
    observe_le: new Date().toISOString(),
    ...champs,
  };
}

async function nombreDeReleves(id?: string) {
  let requete = admin.from('releves').select('id', { count: 'exact', head: true }).eq('marche_id', scenario.marcheId);
  if (id) requete = requete.eq('id', id);
  const { count } = await requete;
  return count;
}

describe('renvoi sans doublon', () => {
  it("le relevé garde l'identifiant fixé par le téléphone", async () => {
    const auteur = await contributeur();
    const releve = await saisie();

    const { error } = await auteur.client.from('releves').insert(releve);

    expect(error).toBeNull();
    expect(await nombreDeReleves(releve.id)).toBe(1);
  });

  it('un renvoi du même relevé est reconnu comme un doublon et ne crée rien', async () => {
    const auteur = await contributeur();
    const releve = await saisie();
    await auteur.client.from('releves').insert(releve);

    const renvoi = await auteur.client.from('releves').insert(releve);

    expect(renvoi.error?.code).toBe(DOUBLON);
    expect(await nombreDeReleves()).toBe(1);
  });

  it('un renvoi reste un doublon quand la limite du jour est atteinte par ce relevé lui-même', async () => {
    const auteur = await contributeur();
    const releves = await Promise.all(Array.from({ length: 5 }, () => saisie()));
    for (const releve of releves) expect((await auteur.client.from('releves').insert(releve)).error).toBeNull();

    const renvoi = await auteur.client.from('releves').insert(releves[4]);

    expect(renvoi.error?.code).toBe(DOUBLON); // et non NB002
    expect(await nombreDeReleves()).toBe(5);
  });

  it('un renvoi reste un doublon même si le compte a été bloqué entre-temps', async () => {
    const auteur = await contributeur();
    const releve = await saisie();
    await auteur.client.from('releves').insert(releve);
    await admin.from('profils').update({ est_bloque: true }).eq('id', auteur.id);

    const renvoi = await auteur.client.from('releves').insert(releve);

    expect(renvoi.error?.code).toBe(DOUBLON); // et non NB001
    expect(await nombreDeReleves()).toBe(1);
  });

  it('deux envois simultanés du même relevé n’en créent qu’un', async () => {
    const auteur = await contributeur();
    const releve = await saisie();

    const [a, b] = await Promise.all([
      auteur.client.from('releves').insert(releve),
      auteur.client.from('releves').insert(releve),
    ]);

    expect([a.error?.code ?? null, b.error?.code ?? null].sort()).toEqual([DOUBLON, null]);
    expect(await nombreDeReleves()).toBe(1);
  });

  it("deux renvois simultanés au plafond de la limite du jour restent un envoi et un doublon, sans refus à tort", async () => {
    const auteur = await contributeur();
    for (let i = 0; i < 4; i++) await auteur.client.from('releves').insert(await saisie());
    const cinquieme = await saisie();

    const [a, b] = await Promise.all([
      auteur.client.from('releves').insert(cinquieme),
      auteur.client.from('releves').insert(cinquieme),
    ]);

    expect([a.error?.code ?? null, b.error?.code ?? null].sort()).toEqual([DOUBLON, null]); // et non NB002
    expect(await nombreDeReleves()).toBe(5);
  });

  it("l'identifiant d'un autre contributeur ne permet ni d'écraser ni de lire son relevé", async () => {
    const premier = await contributeur();
    const second = await contributeur();
    const releve = await saisie({ prix_total: 450 });
    await premier.client.from('releves').insert(releve);

    const usurpation = await second.client.from('releves').insert({ ...releve, prix_total: 9999 });

    expect(usurpation.error).not.toBeNull(); // doublon, ou refus d'un garde-fou : jamais accepté
    const { data } = await admin.from('releves').select('contributeur_id, prix_total').eq('id', releve.id);
    expect(data).toEqual([{ contributeur_id: premier.id, prix_total: 450 }]);
  });

  it("un lecteur non connecté ne peut toujours rien envoyer, identifiant fourni ou non", async () => {
    const { error } = await lecteurAnonyme.from('releves').insert(await saisie());

    expect(error?.code).toBe('42501');
    expect(await nombreDeReleves()).toBe(0);
  });
});

describe('date de la saisie', () => {
  it("la date d'observation est celle de la saisie, pas celle de l'envoi", async () => {
    const auteur = await contributeur();
    const saisieIlYaTroisJours = ilYaJours(3);
    const releve = await saisie({ observe_le: saisieIlYaTroisJours });

    expect((await auteur.client.from('releves').insert(releve)).error).toBeNull();

    const { data } = await admin.from('releves').select('observe_le, cree_le').eq('id', releve.id).single();
    expect(new Date(data!.observe_le).getTime()).toBe(new Date(saisieIlYaTroisJours).getTime());
    expect(new Date(data!.cree_le).getTime()).toBeGreaterThan(new Date(saisieIlYaTroisJours).getTime());
  });

  it('un relevé saisi il y a moins de 7 jours compte dans le prix courant à sa date de saisie', async () => {
    const relais = await scenario.contributeur({ relais: true });
    await scenario.relever(relais, 'maïs', 'kg', { prix: 400, joursPasses: 1 });
    const auteur = await contributeur();

    const { error } = await auteur.client.from('releves').insert(await saisie({ observe_le: ilYaJours(6) }));

    expect(error).toBeNull();
    const { data } = await lecteurAnonyme
      .from('prix_courants')
      .select('nombre_releves')
      .eq('marche_id', scenario.marcheId)
      .single();
    expect(data?.nombre_releves).toBe(2);
  });

  it('un relevé saisi il y a plus de 7 jours est refusé (NB004) : rien ne se perd en silence côté app', async () => {
    const auteur = await contributeur();

    const { error } = await auteur.client.from('releves').insert(await saisie({ observe_le: ilYaJours(8) }));

    expect(error?.code).toBe(DATE_INVALIDE);
    expect(await nombreDeReleves()).toBe(0);
  });

  it('un compte bloqué voit son relevé en attente refusé (NB001) à la synchronisation', async () => {
    const auteur = await contributeur();
    await admin.from('profils').update({ est_bloque: true }).eq('id', auteur.id);

    const { error } = await auteur.client.from('releves').insert(await saisie());

    expect(error?.code).toBe(COMPTE_BLOQUE);
  });
});
