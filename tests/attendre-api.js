// Attend que l'API locale réponde : juste après `npm run db:reset`, elle
// redémarre pendant quelques secondes. Échoue avec un message clair si la
// base n'est pas démarrée.
require('./charger-env');

module.exports = async function attendreApi() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const cle = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !cle) return; // le test signalera la configuration manquante

  const limite = Date.now() + 30_000;
  for (;;) {
    try {
      const reponse = await fetch(`${url}/rest/v1/marches?select=id&limit=1`, {
        headers: { apikey: cle },
      });
      if (reponse.ok) return;
    } catch {
      // API injoignable : on réessaie jusqu'à la limite.
    }
    if (Date.now() > limite) {
      throw new Error(
        `L'API Supabase locale ne répond pas sur ${url}. La démarrer avec « npm run db:start » (OrbStack doit tourner).`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};
