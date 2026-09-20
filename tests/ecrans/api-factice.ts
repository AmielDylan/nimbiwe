/**
 * Remplace l'accès aux données à la frontière du client : le vrai client
 * Supabase tourne, mais son `fetch` répond avec ce que renverrait l'API.
 */
import type { PrixCourant, Reference } from '@/screens/prix/use-prix';

export type Marche = Reference;
export type Produit = Reference & { unites?: { id: number; symbole: string }[] };
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
// Clé de stockage de la session : sb-<premier label de l'hôte>-auth-token.
export const CLE_DE_SESSION = `sb-${new URL(process.env.EXPO_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]}-auth-token`;

type OptionsConnexion = {
  /** Nom affiché déjà enregistré pour le compte de test. */
  nomAffiche?: string | null;
  /** L'envoi du code échoue (réseau, limite de fréquence…). */
  envoiEnPanne?: boolean;
  /** La vérification du code échoue à cause du serveur (et non d'un mauvais code). */
  verificationEnPanne?: boolean;
  /** Aucun profil n'existe pour ce compte : la modification ne touche aucune ligne. */
  profilIntrouvable?: boolean;
  /** Le compte de la session enregistrée n'existe plus (base réinitialisée, compte supprimé). */
  compteSupprime?: boolean;
  /** Relevés déjà envoyés par le contributeur connecté (lignes telles que les renvoie l'API). */
  mesReleves?: LigneReleve[];
  /** Le serveur refuse tout relevé avec ce code d'erreur (NB001, NB002…). */
  releveRefuse?: string;
  /** Le serveur juge le prix hors bornes, tant que le relevé n'est pas confirmé. */
  horsBornes?: 'haut' | 'bas';
  /** L'envoi des relevés échoue à cause du réseau ou du serveur. */
  releveEnPanne?: boolean;
  /** La lecture de la liste de mes relevés échoue. */
  mesRelevesEnPanne?: boolean;
};

export type LigneReleve = {
  id: string;
  prix_total: number;
  quantite: number;
  observe_le: string;
  produits: { nom: string };
  unites: { symbole: string };
  marches: { nom: string };
};

/** Ce que l'API simulée a reçu et retient : les tests le lisent pour vérifier les effets. */
export type Simulation = {
  demandesDeCode: string[];
  nomAffiche: string | null;
  deconnexions: number;
  /** Corps des relevés reçus et acceptés par le serveur simulé. */
  releves: Record<string, unknown>[];
  /** Nombre de tentatives d'envoi de relevé, acceptées ou non. */
  envoisDeReleve: number;
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
  const simulation: Simulation = {
    demandesDeCode: [],
    nomAffiche: options.nomAffiche ?? null,
    deconnexions: 0,
    releves: [],
    envoisDeReleve: 0,
  };
  const mesReleves = [...(options.mesReleves ?? [])];

  fetchFactice().mockImplementation(async (requete: RequestInfo | URL, init?: RequestInit) => {
    const adresse = chemin(requete);
    const corps = init?.body ? JSON.parse(String(init.body)) : {};

    if (adresse.endsWith('/auth/v1/otp')) {
      if (options.envoiEnPanne) return json({ msg: 'Erreur interne' }, 500);
      simulation.demandesDeCode.push(corps.phone);
      return json({});
    }
    if (adresse.endsWith('/auth/v1/verify')) {
      if (options.verificationEnPanne) return json({ msg: 'Erreur interne' }, 500);
      if (corps.token !== CODE_VALIDE) {
        return json({ code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }, 403);
      }
      return json(sessionDeTest(corps.phone));
    }
    if (adresse.endsWith('/auth/v1/user')) {
      if (options.compteSupprime) {
        return json(
          { code: 403, error_code: 'user_not_found', msg: 'User from sub claim in JWT does not exist' },
          403,
        );
      }
      return json(sessionDeTest().user);
    }
    if (adresse.endsWith('/auth/v1/logout')) {
      simulation.deconnexions += 1;
      return new Response(null, { status: 204 });
    }
    if (adresse.endsWith('/rest/v1/profils')) {
      if (init?.method === 'PATCH') {
        if (options.profilIntrouvable) return json([]);
        simulation.nomAffiche = corps.nom_affiche;
        return json([{ id: UTILISATEUR_ID }]); // lignes modifiées, comme le fait l'API avec `select`
      }
      return json([{ nom_affiche: simulation.nomAffiche }]);
    }

    if (adresse.endsWith('/rest/v1/releves')) {
      if (init?.method === 'POST') {
        simulation.envoisDeReleve += 1;
        if (options.releveEnPanne) return json({ message: 'Erreur interne' }, 500);
        if (options.releveRefuse) {
          return json({ code: options.releveRefuse, message: 'Refusé par le serveur', details: null, hint: null }, 400);
        }
        if (options.horsBornes && corps.hors_bornes_confirme !== true) {
          return json({ code: 'NB003', message: 'Prix hors bornes', details: null, hint: options.horsBornes }, 400);
        }
        simulation.releves.push(corps);
        const courantes = typeof donnees === 'function' ? donnees() : donnees;
        mesReleves.unshift({
          id: `releve-${simulation.releves.length}`,
          prix_total: corps.prix_total,
          quantite: corps.quantite,
          observe_le: new Date().toISOString(),
          produits: { nom: courantes.produits.find((p) => p.id === corps.produit_id)?.nom ?? '' },
          unites: {
            symbole:
              courantes.produits.flatMap((p) => p.unites ?? []).find((u) => u.id === corps.unite_id)?.symbole ?? '',
          },
          marches: { nom: courantes.marches.find((m) => m.id === corps.marche_id)?.nom ?? '' },
        });
        return new Response(null, { status: 201 });
      }
      if (options.mesRelevesEnPanne) return json({ message: 'Erreur interne' }, 500);
      return json(mesReleves);
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
  { id: 1, nom: 'maïs', unites: [{ id: 10, symbole: 'kg' }] },
  { id: 2, nom: 'sucre', unites: [{ id: 10, symbole: 'kg' }] },
  {
    id: 3,
    nom: 'igname',
    unites: [
      { id: 10, symbole: 'kg' },
      { id: 12, symbole: 'pièce' },
    ],
  },
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
    nombre_releves: 3,
    dernier_releve_le: ilYaJours(2),
    ...surcharge,
  };
}
