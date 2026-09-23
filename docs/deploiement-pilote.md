# Déploiement du projet Supabase distant (pilote)

Ce document couvre la partie du ticket #12 qui s'automatise : mettre le schéma
(migrations) sur un vrai projet Supabase, sans jamais y publier la
configuration locale (numéros de test, fournisseur SMS factice). Tout le reste
du ticket — créer le projet, choisir un fournisseur SMS réel, désigner les
relais, relire le contrat — reste une décision humaine (voir la fin de ce
document).

## Ce qui ne doit jamais arriver sur le projet distant

- `supabase config push` : publierait `[auth.sms.test_otp]` (codes connus),
  le fournisseur SMS factice et le délai de 1 s entre deux codes.
- `supabase/seed.sql` : comptes et prix d'exemple, utiles seulement en local
  (`supabase db reset`). Le script ci-dessous ne l'inclut jamais
  (`--include-seed` n'est pas passé).

Seul `supabase db push` (migrations) est utilisé : la configuration du projet
distant (auth, SMS, secrets) se règle une fois, à la main, dans le tableau de
bord Supabase.

## Étapes

1. **Créer le projet** sur [supabase.com](https://supabase.com) (humain — voir
   plus bas), noter sa référence (`project-ref`, dans l'URL du tableau de
   bord) et sa région (proche du Bénin si possible).
2. **Déployer le schéma** :

   ```bash
   ./scripts/deployer-pilote.sh <project-ref>
   ```

   Le script lie le projet, montre les migrations qui seraient appliquées
   (`--dry-run`), demande une confirmation explicite, puis les applique.
   Rejouable sans risque : `supabase db push` n'applique que les migrations
   pas encore vues par le projet distant.

3. **Vérifier après coup**, depuis le tableau de bord (SQL Editor ou Table
   Editor) :
   - `select * from parametres;` — les valeurs par défaut sont correctes
     (`releves_max_par_jour`, `contestations_min_pour_exclure`, etc.), à
     ajuster si besoin.
   - `select * from bornes_plausibles;` — encore les **valeurs d'exemple** du
     dépôt : à remplacer par les vraies bornes fournies avec les relais avant
     le pilote (critère du ticket #12).
   - `select * from conversions_unites;` — vide : aucun facteur de conversion
     réel n'est livré (ticket #10), à renseigner si le bol est utilisé.
   - `select * from marches;` — Ganhi, Ouando, Bohicon, Dantokpa (provisoire,
     à remplacer par le vrai marché de détail choisi après visite).
   - Aucune ligne de `auth.users` : le seed ne s'applique jamais au projet
     distant.

4. **Configurer l'authentification**, dans le tableau de bord (Authentication
   → Providers → Phone) :
   - Fournisseur SMS réel (voir ticket #13).
   - Délai minimal entre deux codes : **60 s** (`max_frequency`, en local à
     1 s uniquement pour que les tests rejouent une connexion).
   - Aucun numéro de test.

5. **Remplir `.env`** de l'app avec l'URL et la clé publiable (« anon key »)
   **du projet distant** — jamais la clé `service_role` dans l'app.

## Vérifications à faire soi-même (le contenu change avec le temps)

- **Politique de pause d'inactivité du plan choisi** : certains plans mettent
  en pause un projet après une période sans requête. Un pilote de 4 semaines
  avec relais actifs devrait rester actif, mais à vérifier sur la page de
  tarification au moment de l'inscription plutôt que sur une valeur figée ici.
- **Coût réel du fournisseur SMS** pour des numéros béninois (+229) : à
  vérifier directement chez le fournisseur retenu (ticket #13).

## Ce qui reste entièrement humain (ticket #12)

Rien de ce qui suit ne peut être délégué à un agent (comptes, argent, droit,
terrain) :

- Créer le compte et le projet Supabase distant, choisir le plan, régler la
  facturation.
- Choisir et configurer le fournisseur SMS réel pour le Bénin (ticket #13),
  vérifier son coût.
- Produire un build Android installable sans compte de boutique payant
  (ticket #14, EAS Build en profil interne ou APK direct).
- Faire relire les obligations sur les données personnelles et le contrat des
  relais par une personne compétente en droit béninois, **avant** toute
  collecte de vrais numéros de téléphone.
- Désigner les quatre relais, un par marché ; visiter Cotonou pour choisir le
  quatrième marché de détail (Dantokpa a fermé, voir `README.md`) ; vérifier
  sur place l'état d'Ouando et de Bohicon.
- Obtenir les vraies bornes plausibles et les vrais facteurs de conversion
  (bol) auprès des relais, puis les écrire dans la base distante (étape 3
  ci-dessus).
- Définir comment mesurer, semaine après semaine, les critères de succès de
  la V0 (relais actifs par marché, produits avec un prix courant mis à jour
  dans la semaine) — un tableau de bord, une requête régulière ou un export ;
  à préciser une fois ces choix faits, si utile pour un futur ticket.
