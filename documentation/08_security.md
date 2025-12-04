# Sécurité - Nimbiwe API

## Vue d'ensemble

Ce document décrit les mesures de sécurité implémentées dans l'API Nimbiwe pour protéger les données et prévenir les abus.

## Rate Limiting

### Configuration Globale

**Package**: `@nestjs/throttler`

- **Limite par défaut**: 100 requêtes/heure par IP
- **TTL**: 3600000 ms (1 heure)

### Limites Spécifiques par Endpoint

| Endpoint | Limite | Période | Raison |
|----------|--------|---------|--------|
| `POST /auth/login` | 5 req | 1h | Prévention brute-force OTP |
| `POST /auth/verify` | 5 req | 1h | Prévention tentatives multiples |
| `POST /auth/refresh` | 10 req | 1h | Limitation refresh abuse |

### Réponse HTTP 429

```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

---

## CORS (Cross-Origin Resource Sharing)

### Configuration

```typescript
app.enableCors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
});
```

### Variable d'Environnement

```bash
CORS_ORIGIN="https://app.nimbiwe.com"
```

**Développement**: `http://localhost:3000`  
**Production**: Domaine spécifique de l'application frontend

---

## Validation des Données

### Global Validation Pipe

Toutes les requêtes sont automatiquement validées avec `class-validator`.

**Configuration**:
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,           // Supprime propriétés non déclarées
    forbidNonWhitelisted: true, // Rejette si propriétés inconnues
    transform: true,            // Transforme types automatiquement
  }),
);
```

### Validations par DTO

#### SyncEntryDto
- `priceValue`: >= 1
- `currency`: Code ISO 3 lettres majuscules (ex: XOF, EUR)
- `unit`: Enum (kg, piece, basket)
- `lat`: -90 à 90
- `lon`: -180 à 180
- `productId`, `marketId`: UUID valide

#### CreateMarketDto
- `lat`: -90 à 90
- `lon`: -180 à 180

---

## Gestion des Erreurs Standardisée

### Format d'Erreur

```json
{
  "code": "ERROR_CODE",
  "message": "Description lisible",
  "details": { ... }
}
```

### Codes d'Erreur Communs

| Code | Status | Description |
|------|--------|-------------|
| `DUPLICATE_ENTRY` | 409 | Saisie déjà existante |
| `DAILY_LIMIT_EXCEEDED` | 429 | Limite quotidienne atteinte |
| `INVALID_OTP` | 401 | OTP invalide ou expiré |
| `INVALID_TOKEN` | 401 | Token JWT invalide |
| `FORBIDDEN` | 403 | Rôle insuffisant |

---

## Authentification & Autorisation

### Niveaux de Sécurité

1. **OTP** (5 minutes, single-use)
2. **Access Token** (15 minutes)
3. **Refresh Token** (7 jours, rotation)

### Guards

#### JWT Guard
Protège les endpoints nécessitant une authentification.

```typescript
@UseGuards(AuthGuard('jwt'))
```

#### Roles Guard
Contrôle l'accès basé sur les rôles.

```typescript
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
```

**Rôles disponibles**:
- `AGENT`: Collecte de prix
- `ADMIN`: Validation et administration

---

## Variables d'Environnement

### Fichier `.env`

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5433/nimbiwe?schema=public"

# JWT Secrets
JWT_SECRET="supersecretkey"
JWT_REFRESH_SECRET="supersecretrefreshkey"

# CORS
CORS_ORIGIN="http://localhost:3000"

# Logging
LOG_LEVEL="info"
NODE_ENV="development"

# Server
PORT=3000
```

### Sécurité des Secrets

**Développement**:
- Fichier `.env` local (gitignored)

**Production**:
- Variables d'environnement système
- Secrets manager (AWS Secrets Manager, HashiCorp Vault)
- **JAMAIS** commiter les secrets dans Git

---

## Bonnes Pratiques

### 1. HTTPS Obligatoire en Production
### 2. Validation Stricte
### 3. Principe du Moindre Privilège
### 4. Audit Trail
### 5. Rate Limiting Adaptatif

---

## Checklist Sécurité Production

- [ ] HTTPS activé
- [ ] Secrets en variables d'environnement
- [ ] CORS configuré avec domaine spécifique
- [ ] Rate limiting activé
- [ ] Logging centralisé
- [ ] Monitoring des erreurs
- [ ] Backups base de données automatiques
