# Nimbiwe

Suivi collaboratif des prix des denrées de base sur les marchés du Bénin. *Nimbiwe* signifie « c'est combien ? » en fon.

Le vocabulaire du domaine est dans [CONTEXT.md](CONTEXT.md) et les décisions d'architecture dans [docs/adr/](docs/adr/).

## Prérequis

- Node.js 22.13 ou plus (ou 24.3+, ou 20.19.4+) : versions acceptées par Expo 57
- Un environnement Docker pour la base locale (OrbStack sur Mac) : il doit tourner avant `npm run db:start`
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Xcode et son simulateur iPhone

## Installation

```bash
npm install
cp .env.example .env
```

Renseigner ensuite `EXPO_PUBLIC_SUPABASE_ANON_KEY` dans `.env` avec la clé « Publishable » affichée par `npm run db:start`. Le fichier `.env` n'est jamais versionné. Les variables `EXPO_PUBLIC_*` sont embarquées dans l'app : aucune clé secrète ne doit y figurer.

Les tests d'API préparent leurs données avec la clé « Secret » de la base **locale**, à mettre dans `SUPABASE_SECRET_KEY` (sans préfixe `EXPO_PUBLIC_`, donc jamais embarquée). Ne jamais y mettre une clé de production.

## Base de données locale

```bash
npm run db:start   # démarre Supabase en local et applique les migrations
npm run db:reset   # recrée la base : migrations puis données de départ
npm run db:stop    # arrête la base
```

Les migrations sont dans `supabase/migrations/` : elles portent le référentiel réel (marchés, produits, unités) et les règles du serveur, dont le calcul du prix courant (vue `prix_courants`, sur 7 jours). Le fichier `supabase/seed.sql` charge des collectes d'exemple **factices** (comptes « Exemple »), uniquement en local : il ne s'applique jamais en production. Les dates d'exemple sont relatives au moment du reset : relancer `npm run db:reset` pour rafraîchir des prix qui ont plus de 7 jours.

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

- **API** (`tests/api/`) : le vrai client Supabase contre la base locale. La base doit être démarrée ; les tests attendent jusqu'à 30 secondes que l'API réponde (elle redémarre après `db:reset`).
- **Écrans** (`tests/ecrans/`) : rendu des écrans dans l'environnement de test Expo. Quand les écrans liront des données, l'accès sera remplacé à la frontière du client de données.

Pour n'en lancer qu'une : `npx jest --selectProjects api` ou `npx jest --selectProjects ecrans`.

## Structure

- `src/app/` : routes uniquement, sans logique métier
- `src/screens/` : corps des écrans ; un écran complexe a son dossier (`prix/` : accès aux données, logique et composants ensemble)
- `src/lib/` : client Supabase
- `src/components/` : composants réutilisables
- `supabase/` : configuration, migrations et données de départ
