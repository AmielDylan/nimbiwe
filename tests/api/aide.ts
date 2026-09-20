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

type Signalement = { prix: number; joursPasses?: number; quantite?: number };

/**
 * Un marché jetable avec ses contributeurs : chaque test travaille sur son
 * propre marché, pour rester indépendant des données d'exemple et des autres
 * tests exécutés en parallèle.
 */
export async function creerScenario() {
  const { data, error } = await admin
    .from('marches')
    .insert({ nom: `Marché de test ${crypto.randomUUID()}` })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('Marché de test non créé');
  const marche = data;

  const contributeurs: string[] = [];

  async function contributeur(options: { relais?: boolean } = {}) {
    const telephone = `229${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
    const { data, error: erreurUtilisateur } = await admin.auth.admin.createUser({
      phone: telephone,
      phone_confirm: true,
    });
    if (erreurUtilisateur) throw erreurUtilisateur;
    const { error: erreurProfil } = await admin
      .from('profils')
      .insert({ id: data.user.id, nom_affiche: 'Test', est_relais: options.relais ?? false });
    if (erreurProfil) throw erreurProfil;
    contributeurs.push(data.user.id);
    return data.user.id;
  }

  async function id(table: 'produits' | 'unites', colonne: string, valeur: string) {
    const { data, error: erreur } = await admin.from(table).select('id').eq(colonne, valeur).single();
    if (erreur) throw erreur;
    return data.id as number;
  }

  async function signaler(
    contributeurId: string,
    produit: string,
    unite: string,
    { prix, joursPasses = 0, quantite = 1 }: Signalement,
  ) {
    const { error: erreur } = await admin.from('signalements').insert({
      marche_id: marche.id,
      produit_id: await id('produits', 'nom', produit),
      unite_id: await id('unites', 'symbole', unite),
      contributeur_id: contributeurId,
      prix_total: prix,
      quantite,
      observe_le: ilYaJours(joursPasses),
    });
    if (erreur) throw erreur;
  }

  async function nettoyer() {
    await admin.from('signalements').delete().eq('marche_id', marche.id);
    await admin.from('marches').delete().eq('id', marche.id);
    for (const utilisateur of contributeurs) await admin.auth.admin.deleteUser(utilisateur);
  }

  return { marcheId: marche.id as number, contributeur, signaler, nettoyer };
}
