# Déploiement - Nimbiwe API

## CI/CD avec GitHub Actions

### Workflow Automatisé

**Fichier**: `.github/workflows/ci.yml`

Le workflow s'exécute automatiquement sur:
- Push vers `main` ou `develop`
- Pull requests vers `main` ou `develop`

### Étapes du Workflow

1. **Setup**: Checkout, Node.js 18, cache npm
2. **Database**: PostgreSQL + PostGIS, migrations
3. **Quality**: lint, test, build
4. **Coverage**: Upload Codecov (optionnel)

### Badge Status

```markdown
![CI](https://github.com/VOTRE_ORG/nimbiwe/actions/workflows/ci.yml/badge.svg)
```

---

## Health Check Endpoint

### GET /health

Vérifie connexion DB et PostGIS.

**Réponse (Healthy):**
```json
{
  "status": "ok",
  "timestamp": "2025-12-04T00:00:00.000Z",
  "database": { "connected": true },
  "postgis": { "available": true, "version": "3.4.3" }
}
```

---

## Checks à Surveiller

1. **Database**: `database.connected`
2. **PostGIS**: `postgis.available`
3. **Build**: GitHub Actions status
4. **Coverage**: > 80%

---

## Déploiement Production

### Variables d'Environnement

```bash
DATABASE_URL="postgresql://..."
JWT_SECRET="..."
JWT_REFRESH_SECRET="..."
CORS_ORIGIN="https://app.nimbiwe.com"
LOG_LEVEL="info"
NODE_ENV="production"
```

### Commandes

```bash
npm run build
npx prisma migrate deploy
npm run start:prod
```

---

## Monitoring Recommandé

- **APM**: New Relic / Datadog
- **Errors**: Sentry
- **Logs**: CloudWatch / Stackdriver
- **Uptime**: Pingdom (check `/health`)

---

## Checklist Pré-Déploiement

- [ ] Tests passent (CI green)
- [ ] Migrations testées
- [ ] Variables d'env configurées
- [ ] Backup base de données
- [ ] Health check fonctionnel
- [ ] Monitoring actif
