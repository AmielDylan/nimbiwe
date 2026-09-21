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

- **Relevés aberrants** : un relevé dont le prix unitaire s'écarte de la médiane de référence d'un facteur supérieur à `facteur_ecart_aberrant` (3 par défaut, dans un sens ou dans l'autre) est écarté du prix courant : il ne compte ni pour le prix ni pour la publication. Il n'est **jamais supprimé**. Seul le **dernier relevé récent de chaque contributeur** compte (un seul compte ne peut pas déplacer la médiane en multipliant ses relevés), et aucun relevé n'est jugé sous `releves_min_pour_mediane` contributeurs (3 par défaut). Le relevé du relais du marché sert d'ancre : il n'est jamais écarté. Le verdict qui décide du prix est calculé en direct ; en plus, chaque relevé est marqué à l'envoi (médiane du moment, verdict) pour que la décision reste relisible. Pour relire les relevés écartés : vue `releves_a_revoir` dans le tableau de bord de la base (Studio, http://127.0.0.1:54323) ; elle indique la médiane, le rapport à la médiane et la nature de l'écart : « hors bornes, confirmé volontairement » ou « écart à la médiane, sans confirmation (probable faute de frappe) ». Limites : la faute d'un relais pèse lourd et n'est jamais écartée ; si la majorité des contributeurs récents sont faux, ou si les relevés se répartissent en deux camps, tout peut être écarté et le prix n'est plus publié (« pas assez de données ») ; la vue publique relit tous les relevés à chaque lecture, ce qui suffit aux volumes du pilote.

- **Confirmer et contester** : depuis la carte d'un prix, le détail liste les relevés récents (7 jours) de ce produit, unité et marché, avec le **nom affiché** de l'auteur (« Contributeur » s'il n'en a pas), jamais son numéro, et les compteurs de confirmations et de contestations. Un contributeur connecté confirme ou conteste le relevé **d'un autre** (code `NB005` sur le sien), change ou retire sa réaction ; une réaction par personne et par relevé. Un lecteur non connecté voit les compteurs et est invité à se connecter. **Seuil de contestation** : un relevé est écarté du prix courant quand il a **au moins 3 contestations (`contestations_min_pour_exclure`, table `parametres`) ET plus de contestations que de confirmations**. Il n'est jamais supprimé, et il se remet dans le calcul si des réactions sont retirées ou si des confirmations arrivent. Un relevé contesté ne compte pas non plus pour la publication. Seul le dernier relevé de chaque contributeur compte : si celui-ci est contesté, le contributeur sort du calcul (son relevé précédent ne revient pas). Un compte bloqué ne peut plus réagir ni changer une réaction, mais ses réactions déjà posées continuent de compter. Limites : des comptes créés en nombre peuvent contester en masse (le blocage d'un compte et les relais sont les garde-fous du pilote) ; un relevé de relais n'est pas protégé de la contestation.

- **Mesures locales (bol)** : le bol est une unité « locale » (quantité variable d'un vendeur à l'autre), proposée pour le maïs, le riz, le gari et le haricot (hypothèse de départ, à valider avec les relais : c'est une ligne de `produits_unites` à ajouter ou retirer). Son prix courant est calculé dans le bol et n'est **jamais mélangé** à celui du kilo. Pour afficher aussi un équivalent en kilogramme, renseigner un facteur dans la table `conversions_unites` du tableau de bord de la base (Studio) : une ligne `produit_id`, `unite_id` (le bol), `unite_standard_id` (le kg) et `facteur` (nombre de kg dans un bol : « 1 bol de maïs = 2,5 kg » s'écrit 2.5). Le prix courant expose alors `prix_converti` et `unite_convertie` (le prix d'un bol divisé par le facteur), seulement quand le prix est publié ; sans facteur, ces colonnes sont vides et rien n'est converti. L'équivalent est un affichage : il n'entre jamais dans la médiane en kilo. La table est fermée à l'API. **Aucun facteur réel n'est livré** : ils seront fournis avec les relais (les tests utilisent un facteur factice). Pas de bornes de plausibilité pour le bol : seul le contrôle des valeurs aberrantes s'y applique.

- **Saisie hors ligne** : sans réseau (ou si le serveur est en panne), un relevé est gardé sur le téléphone avec sa position éventuelle et sa **date de saisie**, qui devient la date d'observation ; l'écran Relever liste les relevés en attente avec leur statut (« En attente d'envoi », « Envoi en cours… », « Refusé : … »). Ils sont envoyés automatiquement à l'ouverture de l'app, à son retour au premier plan et **toutes les 15 secondes** tant qu'elle est ouverte (pas de détection du réseau : on réessaie), ou tout de suite avec « Envoyer maintenant ». **Jamais de doublon** : le téléphone fixe l'identifiant du relevé (UUID) à la saisie et le renvoie tel quel ; le serveur reconnaît un relevé déjà reçu (`23505`) avant tout garde-fou, même si la limite du jour est atteinte par ce relevé ou si le compte a été bloqué depuis, et le téléphone le compte alors comme envoyé. Une réponse perdue ou une coupure en cours d'envoi est donc sans effet. La date de la saisie reste soumise à la fenêtre de 7 jours (`releve_anciennete_max_jours`, `NB004`) : un relevé plus ancien est refusé avec un message clair. Un relevé **refusé** (limite du jour, compte bloqué, date trop ancienne, prix hors bornes…) reste dans la liste avec son message, jamais perdu en silence ; on peut le réessayer, confirmer son prix s'il est hors bornes, ou le supprimer. Les relevés en attente sont propres à un compte : un autre compte connecté sur le même téléphone ne les envoie pas. Le formulaire garde une copie des produits et marchés, et reste utilisable sans réseau (elle est rafraîchie à chaque ouverture en ligne). Limites : le formulaire n'a pas de copie tant qu'il n'a jamais été ouvert en ligne ; les prix courants (onglet Prix) ne se lisent pas hors ligne ; une horloge de téléphone très fausse fausse la date de saisie (refus `NB004` si elle est dans le futur de plus de 5 minutes).

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
