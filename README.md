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

La base locale n'envoie aucun SMS réel. Les numéros `22900000101` à `22900000104` (à saisir tels quels dans l'app) répondent tous avec le code fixe **123456** : ils sont réservés à l'usage manuel. Les numéros `22900000201` à `22900000212` sont réservés aux tests automatiques, qui suppriment et recréent ces comptes : ne les utilisez pas à la main.

Après un `npm run db:reset`, la base ne connaît plus vos comptes : l'app referme alors toute session dont le compte a disparu, et il faut se reconnecter. Ils sont déclarés dans `supabase/config.toml` (`[auth.sms.test_otp]`) et ne doivent jamais être recopiés sur le projet distant : **ne lancez pas `supabase config push` avec ce `config.toml`** (il y publierait les numéros de test, le code connu et le fournisseur factice). La configuration distante se fait depuis le tableau de bord.

Le fournisseur SMS est factice en local : copier `supabase/.env.example` vers `supabase/.env` avant `npm run db:start`. Le fournisseur réel se configure sur le projet distant (pilote : Twilio, ouverture publique : BulkGate), ainsi que le délai minimal entre deux codes (`max_frequency`, 1 s en local pour les tests, à mettre à 60 s).

## Garde-fous du relevé

Le serveur décide (voir `supabase/migrations/…_relever_un_prix.sql`) :

- **Bornes plausibles** (`bornes_plausibles`, prix unitaire par produit et unité) : un prix hors bornes est refusé (code `NB003`) tant que le contributeur ne le confirme pas ; la confirmation est enregistrée avec le relevé. Les valeurs actuelles sont des exemples, à fixer avec les relais.
- **Limite de fréquence** : 5 relevés par jour et par contributeur, produit et marché (code `NB002`), réglable dans la table `parametres` (`releves_max_par_jour`).
- **Compte bloqué** : `profils.est_bloque`, à poser depuis le tableau de bord de la base (code `NB001`).
- **Date d'observation** : jamais dans le futur, ni plus ancienne que 7 jours (`releve_anciennete_max_jours`, code `NB004`).

- **Position facultative** : le contributeur peut joindre sa position (interrupteur « Partager ma position », autorisation du téléphone demandée à l'activation, position lue à l'envoi). Elle est stockée côté serveur uniquement : aucune colonne de position (`latitude`, `longitude`, `distance_marche_m`) n'est lisible par l'API, même par son auteur. Le serveur calcule la distance au marché (les coordonnées des marchés de `marches` sont **approximatives**, à corriger sur place). Un refus ou une position introuvable ne bloque jamais le relevé.
- **Poids dans le prix courant** : la médiane du prix courant est pondérée. Un relevé pèse 1 quand sa position est **vérifiée** (à moins de `rayon_position_max_m` de son marché, 3 000 m par défaut). Sinon (sans position, position trop éloignée ou marché sans coordonnées), il pèse `poids_releve_sans_position` (0,5 par défaut, minimum 0,01). Les deux réglages sont dans la table `parametres`. Avec des poids égaux, le résultat est la médiane ordinaire. Comme les coordonnées des marchés sont approximatives, vérifiez-les avant de compter sur le rayon.

- **Relais** : un relais est un contributeur de confiance rattaché à **un marché**. Pour en désigner un, ouvrir la table `profils` dans le tableau de bord de la base (Studio, http://127.0.0.1:54323 en local) et, sur la ligne du compte, cocher `est_relais` **et** choisir `marche_relais_id` (les deux vont ensemble). Le contributeur ne peut pas se donner ce rôle. Sur son marché, un seul relevé d'un relais suffit à publier le prix courant, et ses relevés pèsent en plus `poids_releve_de_relais` fois davantage (3 par défaut, table `parametres`). Ce statut est lu **en direct** : retirer le rôle d'un relais, ou le rattacher à un autre marché, retire aussitôt son poids et son ancrage. Chaque relevé garde en plus une trace historique « fait par un relais à ce moment-là » (`par_relais`, figée à l'envoi, illisible de l'API), pour pouvoir le reconnaître dans les données. Ailleurs, un relais compte comme un contributeur ordinaire. Un relais sans position (poids 3 × 0,5 = 1,5) pèse plus qu'un contributeur avec position (poids 1) : c'est voulu.

- **Relevés aberrants** : un relevé dont le prix unitaire s'écarte de la médiane de référence d'un facteur supérieur à `facteur_ecart_aberrant` (3 par défaut, dans un sens ou dans l'autre) est écarté du prix courant : il ne compte ni pour le prix ni pour la publication. Il n'est **jamais supprimé**. Aucun relevé n'est jugé sous `releves_min_pour_mediane` relevés récents (3 par défaut), et le relevé du relais du marché n'est jamais écarté. Le jugement est calculé en direct sur les données actuelles. Pour relire les relevés écartés : table/vue `releves_a_revoir` dans le tableau de bord de la base (Studio, http://127.0.0.1:54323) ; elle indique la médiane de référence, le rapport à la médiane et la nature de l'écart : « hors bornes, confirmé volontairement » ou « écart à la médiane, sans confirmation (probable faute de frappe) ». Limite : si la majorité des relevés récents sont faux, les bons peuvent être écartés.

Ces règles s'appliquent aux contributeurs connectés, pas au tableau de bord ni aux imports. Les tables `parametres` et `bornes_plausibles` ne sont lisibles ni modifiables par le client.

## Base de données locale

```bash
npm run db:start   # démarre Supabase en local et applique les migrations
npm run db:reset   # recrée la base : migrations puis données de départ
npm run db:stop    # arrête la base
```

Les migrations sont dans `supabase/migrations/` : elles portent le référentiel réel (marchés, produits, unités) et les règles du serveur, dont le calcul du prix courant (vue `prix_courants`, sur 7 jours). Le fichier `supabase/seed.sql` charge des relevés d'exemple **factices** (comptes « Exemple »), uniquement en local : il ne s'applique jamais en production. Les dates d'exemple sont relatives au moment du reset : relancer `npm run db:reset` pour rafraîchir des prix qui ont plus de 7 jours.

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
- `src/screens/` : corps des écrans ; un écran complexe a son dossier (`prix/`, `relever/`, `profil/` : accès aux données, logique et composants ensemble)
- `src/components/` : composants partagés (boutons, champs, puces)
- `src/lib/` : client Supabase (session conservée dans AsyncStorage), formats français, hook de session
- `supabase/` : configuration, migrations et données de départ
