// Prépare les tests d'API :
//  1. attend que l'API et l'authentification locales répondent : juste après
//     `npm run db:reset`, elles redémarrent pendant quelques secondes ;
//  2. remet les réglages de la table `parametres` à leurs valeurs par défaut : un
//     test interrompu avant de restaurer un réglage le laisserait modifié et ferait
//     échouer les exécutions suivantes.
// Échoue avec un message clair si la base n'est pas démarrée.
require('./charger-env');

// Mêmes valeurs que les migrations (supabase/migrations) : à tenir à jour avec elles.
const REGLAGES_PAR_DEFAUT = {
  releves_max_par_jour: 5,
  releve_anciennete_max_jours: 7,
  poids_releve_sans_position: 0.5,
  rayon_position_max_m: 3000,
  poids_releve_de_relais: 3,
  facteur_ecart_aberrant: 3,
  releves_min_pour_mediane: 3,
  contestations_min_pour_exclure: 3,
};

async function repond(adresse, cle) {
  try {
    return (await fetch(adresse, { headers: { apikey: cle } })).ok;
  } catch {
    return false;
  }
}

module.exports = async function preparerLesTests() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const cle = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const cleSecrete = process.env.SUPABASE_SECRET_KEY;
  if (!url || !cle) return; // le test échouera en indiquant la configuration manquante

  const limite = Date.now() + 60_000;
  for (;;) {
    const api = await repond(`${url}/rest/v1/marches?select=id&limit=1`, cle);
    const auth = await repond(`${url}/auth/v1/settings`, cle);
    if (api && auth) break;
    if (Date.now() > limite) {
      throw new Error(
        `L'API Supabase locale ne répond pas sur ${url}. La démarrer avec « npm run db:start » (OrbStack doit tourner).`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (!cleSecrete) return;
  for (const [nom, valeur] of Object.entries(REGLAGES_PAR_DEFAUT)) {
    await fetch(`${url}/rest/v1/parametres?cle=eq.${nom}`, {
      method: 'PATCH',
      headers: { apikey: cleSecrete, Authorization: `Bearer ${cleSecrete}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valeur }),
    });
  }
};
