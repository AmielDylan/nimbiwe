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

## Connexion par SMS en développement

La base locale n'envoie aucun SMS réel. Les numéros `22900000101` à `22900000112` (à saisir tels quels dans l'app) répondent tous avec le code fixe **123456**. Ils sont déclarés dans `supabase/config.toml` (`[auth.sms.test_otp]`) et ne doivent jamais être recopiés sur le projet distant : **ne lancez pas `supabase config push` avec ce `config.toml`** (il y publierait les numéros de test, le code connu et le fournisseur factice). La configuration distante se fait depuis le tableau de bord.

Le fournisseur SMS est factice en local : copier `supabase/.env.example` vers `supabase/.env` avant `npm run db:start`. Le fournisseur réel se configure sur le projet distant (pilote : Twilio, ouverture publique : BulkGate), ainsi que le délai minimal entre deux codes (`max_frequency`, 1 s en local pour les tests, à mettre à 60 s).

## Garde-fous de la collecte

Le serveur décide (voir `supabase/migrations/…_collecter_un_prix.sql`) :

- **Bornes plausibles** (`bornes_plausibles`, prix unitaire par produit et unité) : un prix hors bornes est refusé (code `NB003`) tant que le contributeur ne le confirme pas ; la confirmation est enregistrée avec la collecte. Les valeurs actuelles sont des exemples, à fixer avec les relais.
- **Limite de fréquence** : 5 collectes par jour et par contributeur, produit et marché (code `NB002`), réglable dans la table `parametres` (`collectes_max_par_jour`).
- **Compte bloqué** : `profils.est_bloque`, à poser depuis le tableau de bord de la base (code `NB001`).
- **Date d'observation** : jamais dans le futur, ni plus ancienne que 7 jours (`collecte_anciennete_max_jours`, code `NB004`).

Ces règles s'appliquent aux contributeurs connectés, pas au tableau de bord ni aux imports. Les tables `parametres` et `bornes_plausibles` ne sont lisibles ni modifiables par le client.

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
- `src/lib/` : client Supabase (session conservée dans AsyncStorage)
- `src/components/` : composants réutilisables
- `supabase/` : configuration, migrations et données de départ
