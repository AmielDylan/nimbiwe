import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const cleAnonyme = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const cleSecrete = process.env.SUPABASE_SECRET_KEY;

if (!url || !cleAnonyme || !cleSecrete) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY et SUPABASE_SECRET_KEY sont requis : copier .env.example vers .env (voir le README).',
  );
}

const sansSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Ce que voit un lecteur sans compte. */
export const lecteurAnonyme = createClient(url, cleAnonyme, sansSession);

/** Préparation des données de test : contourne la sécurité par ligne. */
export const admin = createClient(url, cleSecrete, sansSession);

const JOUR = 24 * 60 * 60 * 1000;

export function ilYaJours(jours: number): string {
  return new Date(Date.now() - jours * JOUR).toISOString();
}

type Position = { latitude: number; longitude: number };
type Releve = { prix: number; joursPasses?: number; quantite?: number; position?: Position };

/**
 * Un marché jetable avec ses contributeurs : chaque test travaille sur son
 * propre marché, pour rester indépendant des données d'exemple et des autres
 * tests exécutés en parallèle.
 */
export async function creerScenario(coordonnees?: Position) {
  const { data, error } = await admin
    .from('marches')
    .insert({ nom: `Marché de test ${crypto.randomUUID()}`, ...coordonnees })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('Marché de test non créé');
  const marche = data;

  const contributeurs: string[] = [];

  /** `relais` : relais du marché de ce scénario ; `relaisDu` : relais d'un autre marché (identifiant). */
  async function contributeur(options: { relais?: boolean; relaisDu?: number } = {}) {
    const telephone = `229${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
    const { data, error: erreurUtilisateur } = await admin.auth.admin.createUser({
      phone: telephone,
      phone_confirm: true,
    });
    if (erreurUtilisateur) throw erreurUtilisateur;
    // Le profil est créé par la base à la création du compte.
    const { error: erreurProfil } = await admin
      .from('profils')
      .update({
        nom_affiche: 'Test',
        est_relais: Boolean(options.relais || options.relaisDu),
        marche_relais_id: options.relaisDu ?? (options.relais ? marche.id : null),
      })
      .eq('id', data.user.id);
    if (erreurProfil) throw erreurProfil;
    contributeurs.push(data.user.id);
    return data.user.id;
  }

  async function id(table: 'produits' | 'unites', colonne: string, valeur: string) {
    const { data, error: erreur } = await admin.from(table).select('id').eq(colonne, valeur).single();
    if (erreur) throw erreur;
    return data.id as number;
  }

  async function relever(
    contributeurId: string,
    produit: string,
    unite: string,
    { prix, joursPasses = 0, quantite = 1, position }: Releve,
  ) {
    const { error: erreur } = await admin.from('releves').insert({
      marche_id: marche.id,
      produit_id: await id('produits', 'nom', produit),
      unite_id: await id('unites', 'symbole', unite),
      contributeur_id: contributeurId,
      prix_total: prix,
      quantite,
      observe_le: ilYaJours(joursPasses),
      ...position,
    });
    if (erreur) throw erreur;
  }

  async function nettoyer() {
    await admin.from('releves').delete().eq('marche_id', marche.id);
    await admin.from('marches').delete().eq('id', marche.id);
    for (const utilisateur of contributeurs) await admin.auth.admin.deleteUser(utilisateur);
  }

  return { marcheId: marche.id as number, contributeur, relever, nettoyer };
}

/** Numéros de test de la base locale (supabase/config.toml, [auth.sms.test_otp]) : aucun SMS réel. */
export const CODE_DE_TEST = '123456';
// Réservés aux tests (supabase/config.toml) : ils sont supprimés et recréés à chaque test,
// contrairement aux numéros 22900000101 à 22900000104 gardés pour l'usage manuel.
const NUMEROS_DE_TEST = Array.from({ length: 12 }, (_, i) => `229000002${String(i + 1).padStart(2, '0')}`);
let prochainNumero = Math.floor(Math.random() * NUMEROS_DE_TEST.length);

/**
 * Un numéro de test que personne n'a encore utilisé : le compte éventuellement
 * créé par un test précédent est supprimé, pour rejouer une « première connexion ».
 */
export async function numeroDeTestNeuf(): Promise<string> {
  const telephone = NUMEROS_DE_TEST[prochainNumero++ % NUMEROS_DE_TEST.length];
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const existant = data.users.find((utilisateur) => utilisateur.phone === telephone);
  if (existant) await admin.auth.admin.deleteUser(existant.id);
  return telephone;
}

/** Un client connecté avec un numéro de test, comme le ferait l'app. */
export async function seConnecter(telephone: string) {
  const client = createClient(url!, cleAnonyme!, sansSession);
  const envoi = await client.auth.signInWithOtp({ phone: telephone });
  if (envoi.error) throw envoi.error;
  const { data, error } = await client.auth.verifyOtp({ phone: telephone, token: CODE_DE_TEST, type: 'sms' });
  if (error || !data.user) throw error ?? new Error('Connexion impossible');
  return { client, utilisateurId: data.user.id };
}

/**
 * Un contributeur connecté, comme le ferait l'app, sur un compte jetable : il
 * n'utilise pas les numéros de test, donc plusieurs fichiers de test peuvent
 * tourner en parallèle sans se gêner.
 */
export async function contributeurConnecte() {
  const telephone = `229${Math.floor(90_000_000 + Math.random() * 9_999_999)}`;
  const motDePasse = crypto.randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    phone: telephone,
    password: motDePasse,
    phone_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('Compte de test non créé');

  const client = createClient(url!, cleAnonyme!, sansSession);
  const connexion = await client.auth.signInWithPassword({ phone: telephone, password: motDePasse });
  if (connexion.error) throw connexion.error;

  const id = data.user.id;
  return {
    client,
    id,
    /** Supprime le compte et ses relevés (à appeler en fin de test). */
    async nettoyer() {
      await admin.from('releves').delete().eq('contributeur_id', id);
      await admin.auth.admin.deleteUser(id);
    },
  };
}

/** Identifiants d'un produit et d'une unité du référentiel, par leur nom. */
export async function identifiants(produit: string, unite: string) {
  const [p, u] = await Promise.all([
    admin.from('produits').select('id').eq('nom', produit).single(),
    admin.from('unites').select('id').eq('symbole', unite).single(),
  ]);
  if (p.error) throw p.error;
  if (u.error) throw u.error;
  return { produit_id: p.data.id as number, unite_id: u.data.id as number };
}
