/**
 * Remplace l'accès aux données à la frontière du client : le vrai client
 * Supabase tourne, mais son `fetch` répond avec ce que renverrait l'API.
 */
import type { PrixCourant, Reference } from '@/screens/prix/use-prix';

export type Marche = Reference;
export type Produit = Reference;
export type { PrixCourant };
export type Donnees = { marches: Marche[]; produits: Produit[]; prix_courants: PrixCourant[] };

const JOUR = 24 * 60 * 60 * 1000;

export function ilYaSecondes(secondes: number): string {
  return new Date(Date.now() - secondes * 1000).toISOString();
}

export function ilYaJours(jours: number): string {
  return new Date(Date.now() - jours * JOUR).toISOString();
}

function json(corps: unknown, status = 200) {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function table(requete: RequestInfo | URL): keyof Donnees {
  const adresse = typeof requete === 'string' ? requete : requete instanceof URL ? requete.href : requete.url;
  return new URL(adresse).pathname.split('/').pop() as keyof Donnees;
}

const fetchFactice = () => globalThis.fetch as jest.Mock;

/** L'API répond avec ces données (fonction : relue à chaque requête, pour simuler un changement). */
export function simulerApi(donnees: Donnees | (() => Donnees)) {
  fetchFactice().mockImplementation(async (requete: RequestInfo | URL) => {
    const courantes = typeof donnees === 'function' ? donnees() : donnees;
    return json(courantes[table(requete)]);
  });
}

/** L'API est en panne. */
export function simulerPanne() {
  fetchFactice().mockImplementation(async () => json({ message: 'Erreur interne' }, 500));
}

/** L'API répond quand le test le décide : permet d'observer l'état de chargement. */
export function simulerApiLente(donnees: Donnees) {
  let repondre: () => void = () => {};
  const attente = new Promise<void>((resolve) => (repondre = resolve));
  fetchFactice().mockImplementation(async (requete: RequestInfo | URL) => {
    await attente;
    return json(donnees[table(requete)]);
  });
  return repondre;
}

export const marches: Marche[] = [
  { id: 1, nom: 'Ganhi' },
  { id: 2, nom: 'Ouando' },
  { id: 3, nom: 'Dantokpa' },
];

export const produits: Produit[] = [
  { id: 1, nom: 'maïs' },
  { id: 2, nom: 'sucre' },
];

export function prixCourant(surcharge: Partial<PrixCourant>): PrixCourant {
  return {
    produit_id: 1,
    unite_id: 1,
    marche_id: 1,
    produit: 'maïs',
    unite: 'kg',
    marche: 'Ganhi',
    statut: 'publie',
    prix: 425,
    nombre_collectes: 3,
    derniere_collecte_le: ilYaJours(2),
    ...surcharge,
  };
}
