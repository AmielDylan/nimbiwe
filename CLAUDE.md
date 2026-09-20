# Nimbiwe

## Workflow Git

Aucune exception, même pour un fix d'une ligne.

### Avant toute modification de code

1. Vérifier la branche active : `git branch --show-current`
2. Si c'est `develop` ou `main`, créer immédiatement une branche dédiée depuis `develop` :
   - `git checkout -b feat/<nom> develop` pour une fonctionnalité
   - `git checkout -b fix/<nom> develop` pour un correctif
   - `git checkout -b chore/<nom> develop` pour une tâche technique
3. Ne commiter que sur la branche dédiée.

### Après les modifications

4. Merger dans `develop` : `git merge --no-ff <branche>`
5. Supprimer la branche locale (`git branch -d <branche>`) et la distante si elle a été poussée.
6. Revenir sur `develop`.

### Pour pousser vers main

7. Pousser `develop`, puis ouvrir une PR : `gh pr create --base main --head develop`
8. Auto-merge : `gh pr merge <numéro> --merge --auto` (la CI décide).

### Interdit

- `git commit` ou `git push` directement sur `develop` ou `main`
- `git merge` sans `--no-ff`
- Laisser une branche de travail après merge
- Commiter sans que l'utilisateur l'ait demandé

## Conventions

- Branches : `feat/`, `fix/`, `chore/` + nom en kebab-case.
- Commits : Conventional Commits, scope facultatif, message en français (`feat(prix): afficher la médiane par marché`).

## Agent skills

### Issue tracker

Les tickets vivent dans les GitHub Issues de `AmielDylan/nimbiwe` (CLI `gh`). Voir `docs/agents/issue-tracker.md`.

### Domain docs

Single-context : un `CONTEXT.md` et `docs/adr/` à la racine. Voir `docs/agents/domain.md`.
