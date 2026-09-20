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

export const CODE_VALIDE = '123456';
export const UTILISATEUR_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
export const CLE_DE_SESSION = 'sb-api-auth-token'; // sb-<premier label de l'hôte api.test>-auth-token

type OptionsConnexion = {
  /** Nom affiché déjà enregistré pour le compte de test. */
  nomAffiche?: string | null;
  /** L'envoi du code échoue (réseau, limite de fréquence…). */
  envoiEnPanne?: boolean;
};

/** Ce que l'API simulée a reçu et retient : les tests le lisent pour vérifier les effets. */
export type Simulation = {
  demandesDeCode: string[];
  nomAffiche: string | null;
  deconnexions: number;
};

function jwt(charge: object): string {
  const encoder = (objet: object) =>
    btoa(JSON.stringify(objet)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encoder({ alg: 'HS256', typ: 'JWT' })}.${encoder(charge)}.signature`;
}

/** Une session telle que la renvoie l'API d'authentification. */
export function sessionDeTest(telephone = '22997000000') {
  const expiration = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: jwt({ sub: UTILISATEUR_ID, role: 'authenticated', exp: expiration }),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiration,
    refresh_token: 'jeton-de-rafraichissement',
    user: {
      id: UTILISATEUR_ID,
      aud: 'authenticated',
      role: 'authenticated',
      phone: telephone,
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

function chemin(requete: RequestInfo | URL): string {
  const adresse = typeof requete === 'string' ? requete : requete instanceof URL ? requete.href : requete.url;
  return new URL(adresse).pathname;
}

/**
 * L'API répond avec ces données (fonction : relue à chaque requête, pour simuler
 * un changement). Elle simule aussi la connexion par code et le profil : le code
 * valide est CODE_VALIDE.
 */
export function simulerApi(donnees: Donnees | (() => Donnees), options: OptionsConnexion = {}): Simulation {
  const simulation: Simulation = { demandesDeCode: [], nomAffiche: options.nomAffiche ?? null, deconnexions: 0 };

  fetchFactice().mockImplementation(async (requete: RequestInfo | URL, init?: RequestInit) => {
    const adresse = chemin(requete);
    const corps = init?.body ? JSON.parse(String(init.body)) : {};

    if (adresse.endsWith('/auth/v1/otp')) {
      if (options.envoiEnPanne) return json({ msg: 'Erreur interne' }, 500);
      simulation.demandesDeCode.push(corps.phone);
      return json({});
    }
    if (adresse.endsWith('/auth/v1/verify')) {
      if (corps.token !== CODE_VALIDE) {
        return json({ code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }, 403);
      }
      return json(sessionDeTest(corps.phone));
    }
    if (adresse.endsWith('/auth/v1/logout')) {
      simulation.deconnexions += 1;
      return new Response(null, { status: 204 });
    }
    if (adresse.endsWith('/rest/v1/profils')) {
      if (init?.method === 'PATCH') {
        simulation.nomAffiche = corps.nom_affiche;
        return new Response(null, { status: 204 });
      }
      return json([{ nom_affiche: simulation.nomAffiche }]);
    }

    const courantes = typeof donnees === 'function' ? donnees() : donnees;
    return json(courantes[table(requete)]);
  });

  return simulation;
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
