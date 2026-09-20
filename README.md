# Nimbiwe

Suivi collaboratif des prix des denrées de base sur les marchés du Bénin. *Nimbiwe* signifie « c'est combien ? » en fon.

Le vocabulaire du domaine est dans [CONTEXT.md](CONTEXT.md) et les décisions d'architecture dans [docs/adr/](docs/adr/).

## Prérequis

- Node.js 22 ou plus
- Un environnement Docker pour la base locale (OrbStack sur Mac) : il doit tourner avant `npm run db:start`
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Xcode et son simulateur iPhone

## Installation

```bash
npm install
cp .env.example .env
```

Renseigner ensuite `EXPO_PUBLIC_SUPABASE_ANON_KEY` dans `.env` avec la clé « Publishable » affichée par `npm run db:start`. Le fichier `.env` n'est jamais versionné, et aucune clé secrète (`service_role`, « Secret ») ne doit y figurer : ces variables sont embarquées dans l'app.

## Base de données locale

```bash
npm run db:start   # démarre Supabase en local et applique les migrations
npm run db:reset   # recrée la base : migrations puis données de départ
npm run db:stop    # arrête la base
```

Les migrations sont dans `supabase/migrations/` et les données de départ dans `supabase/seed.sql`. Attendre quelques secondes après `db:reset` avant de lancer les tests d'API, le temps que l'API redémarre.

## Lancer l'app

```bash
npm run ios        # ouvre l'app sur le simulateur iPhone
```

L'app suit l'apparence claire ou sombre du téléphone (simulateur : Réglages > Développeur, ou ⌘⇧A dans le simulateur).

## Tests et types

```bash
npm test           # tous les tests : API (base locale) et écrans
npm run typecheck  # vérification des types
```

Une seule commande lance deux familles de tests :

- **API** (`tests/api/`) : le vrai client Supabase contre la base locale. La base doit être démarrée.
- **Écrans** (`tests/ecrans/`) : rendu des écrans dans l'environnement de test Expo, avec l'accès aux données remplacé à la frontière du client de données.

Pour n'en lancer qu'une : `npx jest --selectProjects api` ou `npx jest --selectProjects ecrans`.

## Structure

- `src/app/` : routes uniquement, sans logique métier
- `src/screens/` : corps des écrans
- `src/components/` : composants réutilisables
- `src/lib/` : client Supabase
- `supabase/` : configuration, migrations et données de départ
