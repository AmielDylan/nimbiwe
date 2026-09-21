import AsyncStorage from '@react-native-async-storage/async-storage';

import { type ChargeReleve, envoyerReleve } from '@/lib/envoi-releve';

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
  refus?: { code: string | undefined; hint?: 'haut' | 'bas' };
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

export async function lireFile(): Promise<ReleveEnAttente[]> {
  try {
    const brut = await AsyncStorage.getItem(CLE);
    return brut ? (JSON.parse(brut) as ReleveEnAttente[]) : [];
  } catch {
    return [];
  }
}

// Lire, modifier, écrire : une opération à la fois, pour qu'aucune modification n'en efface une autre.
let derniere: Promise<unknown> = Promise.resolve();

function modifier(transformer: (file: ReleveEnAttente[]) => ReleveEnAttente[]): Promise<void> {
  const operation = derniere.then(async () => {
    await AsyncStorage.setItem(CLE, JSON.stringify(transformer(await lireFile())));
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

function charge(releve: ReleveEnAttente): ChargeReleve {
  return {
    id: releve.id,
    produit_id: releve.produit_id,
    unite_id: releve.unite_id,
    marche_id: releve.marche_id,
    quantite: releve.quantite,
    prix_total: releve.prix_total,
    observe_le: releve.observe_le,
    ...(releve.latitude !== undefined && releve.longitude !== undefined
      ? { latitude: releve.latitude, longitude: releve.longitude }
      : {}),
    ...(releve.hors_bornes_confirme ? { hors_bornes_confirme: true as const } : {}),
  };
}

async function envoyerLaFile(proprietaire: string) {
  const file = (await lireFile())
    .filter((r) => r.proprietaire === proprietaire && r.statut === 'en_attente')
    .sort((a, b) => a.observe_le.localeCompare(b.observe_le));

  for (const releve of file) {
    enEnvoi.add(releve.id);
    notifier();
    const resultat = await envoyerReleve(charge(releve));
    enEnvoi.delete(releve.id);
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

/** Envoie les relevés en attente du compte, un à la fois. Un seul envoi de file à la fois. */
export function synchroniser(proprietaire: string): Promise<void> {
  if (!enCours) {
    enCours = envoyerLaFile(proprietaire).finally(() => {
      enCours = null;
    });
  }
  return enCours;
}
