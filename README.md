# Nimbiwe

Suivi collaboratif des prix des denrées de base sur les marchés du Bénin. *Nimbiwe* signifie « c'est combien ? » en fon.

Projet personnel, en développement. Vocabulaire du domaine : [CONTEXT.md](CONTEXT.md). Décisions d'architecture : [docs/adr/](docs/adr/).

## Installation

```bash
npm install
cp .env.example .env   # renseigner EXPO_PUBLIC_SUPABASE_ANON_KEY (voir `npm run db:start`)
npm run db:start       # base locale (Docker requis)
npm start               # Expo
```

Les numéros `22900000101` à `22900000104` se connectent en local avec le code **123456**, sans SMS réel.

## Commandes

```bash
npm run db:start | db:reset | db:stop   # base locale
npm run typecheck
npm test
```

## Déploiement

Voir [docs/deploiement-pilote.md](docs/deploiement-pilote.md) et `scripts/deployer-pilote.sh`. Ne jamais lancer `supabase config push` avec le `config.toml` local (numéros de test, fournisseur SMS factice).
