import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { type ChargeReleve, envoyerReleve, type ResultatEnvoi, type Sens } from '@/lib/envoi-releve';

const CLE = 'nimbiwe.releves-en-attente';

/** Un relevé saisi sans réseau, gardé sur le téléphone jusqu'à son envoi. */
export type ReleveEnAttente = ChargeReleve & {
  observe_le: string;
  /** Le compte qui l'a saisi : un autre compte connecté ne l'envoie pas. */
  proprietaire: string;
  // Libellés gardés avec le relevé : la liste s'affiche sans avoir besoin du référentiel.
  produit: string;
  unite: string;
  marche: string;
  statut: 'en_attente' | 'refuse';
  /** Pourquoi le serveur l'a refusé : il reste dans la liste, jamais perdu en silence. */
  refus?: { code: string | undefined; hint?: Sens };
};

const ecouteurs = new Set<() => void>();
const enEnvoi = new Set<string>();

function notifier() {
  ecouteurs.forEach((ecouteur) => ecouteur());
}

export function abonner(ecouteur: () => void): () => void {
  ecouteurs.add(ecouteur);
  return () => {
    ecouteurs.delete(ecouteur);
  };
}

export function estEnEnvoi(id: string): boolean {
  return enEnvoi.has(id);
}

/**
 * Lit la file sur le téléphone. Une lecture qui échoue lève l'erreur : écrire à sa place
 * effacerait les relevés en attente. Un contenu illisible est mis de côté, jamais écrasé.
 */
async function lireOuLever(): Promise<ReleveEnAttente[]> {
  const brut = await AsyncStorage.getItem(CLE);
  if (!brut) return [];
  try {
    return JSON.parse(brut) as ReleveEnAttente[];
  } catch {
    await AsyncStorage.setItem(`${CLE}.illisible`, brut);
    return [];
  }
}

/** Pour l'affichage : en cas d'échec de lecture, la liste est vide pour cette fois. */
export async function lireFile(): Promise<ReleveEnAttente[]> {
  try {
    return await lireOuLever();
  } catch {
    return [];
  }
}

// Lire, modifier, écrire : une opération à la fois, pour qu'aucune modification n'en efface une autre.
let derniere: Promise<unknown> = Promise.resolve();

function modifier(transformer: (file: ReleveEnAttente[]) => ReleveEnAttente[]): Promise<void> {
  const operation = derniere.then(async () => {
    await AsyncStorage.setItem(CLE, JSON.stringify(transformer(await lireOuLever())));
    notifier();
  });
  derniere = operation.catch(() => {});
  return operation;
}

export function ajouter(releve: ReleveEnAttente): Promise<void> {
  return modifier((file) => (file.some((r) => r.id === releve.id) ? file : [...file, releve]));
}

export function retirer(id: string): Promise<void> {
  return modifier((file) => file.filter((r) => r.id !== id));
}

export function mettreAJour(id: string, changements: Partial<ReleveEnAttente>): Promise<void> {
  return modifier((file) => file.map((r) => (r.id === id ? { ...r, ...changements } : r)));
}

/** Remet un relevé refusé dans la file, pour qu'il soit renvoyé (éventuellement avec la confirmation du prix). */
export function relancer(id: string, changements: Partial<ReleveEnAttente> = {}): Promise<void> {
  return mettreAJour(id, { ...changements, statut: 'en_attente', refus: undefined });
}

/** Ce qui part au serveur : le relevé sans les informations propres au téléphone. */
function charge(releve: ReleveEnAttente): ChargeReleve {
  const { proprietaire, produit, unite, marche, statut, refus, ...champs } = releve;
  return champs;
}

async function envoyerLaFile(proprietaire: string) {
  const file = (await lireFile())
    .filter((r) => r.proprietaire === proprietaire && r.statut === 'en_attente')
    .sort((a, b) => a.observe_le.localeCompare(b.observe_le));

  for (const releve of file) {
    // Ni sans compte connecté ni sous un autre compte : le serveur attribuerait le relevé à
    // celui qui envoie. Il reste alors en attente, intact.
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id !== proprietaire) return;
    // Supprimé ou déjà traité depuis que la file a été lue : on ne l'envoie pas.
    const encore = (await lireFile()).some((r) => r.id === releve.id && r.statut === 'en_attente');
    if (!encore) continue;
    enEnvoi.add(releve.id);
    notifier();
    let resultat: ResultatEnvoi;
    try {
      resultat = await envoyerReleve(charge(releve));
    } catch {
      resultat = { statut: 'reseau' }; // imprévu : le relevé reste en attente, il sera retenté
    } finally {
      enEnvoi.delete(releve.id);
    }
    if (resultat.statut === 'envoye') {
      await retirer(releve.id);
    } else if (resultat.statut === 'refuse') {
      await mettreAJour(releve.id, { statut: 'refuse', refus: { code: resultat.code, hint: resultat.hint } });
    } else {
      notifier();
      return; // réseau toujours absent : inutile d'insister, on réessaiera plus tard
    }
  }
}

let enCours: Promise<void> | null = null;
let redemandee = false;

/**
 * Envoie les relevés en attente du compte, un à la fois. Un seul envoi de file à la fois ;
 * une demande faite pendant un envoi (un relevé relancé, par exemple) est traitée à la suite.
 */
export function synchroniser(proprietaire: string): Promise<void> {
  if (enCours) {
    redemandee = true;
    return enCours;
  }
  enCours = (async () => {
    do {
      redemandee = false;
      await envoyerLaFile(proprietaire);
    } while (redemandee);
  })().finally(() => {
    enCours = null;
  });
  return enCours;
}
