# Backend API - Nimbiwe

## Vue d'ensemble

L'API REST **nimbiwe-api** est développée avec **NestJS** et **TypeScript**, utilisant **PostgreSQL** avec l'extension **PostGIS** pour la gestion des données géospatiales.

## Architecture Technique

### Stack Technologique
- **Framework**: NestJS 10.x
- **Langage**: TypeScript
- **Base de données**: PostgreSQL 16 + PostGIS 3.4
- **ORM**: Prisma 7.1
- **Authentification**: JWT + Passport
- **Conteneurisation**: Docker + Docker Compose

### Structure du Projet
```
backend/
├── prisma/
│   ├── schema.prisma          # Schéma de base de données
│   └── migrations/            # Migrations Prisma
├── src/
│   ├── auth/                  # Module d'authentification
│   ├── prisma/                # Service Prisma
│   ├── products/              # Gestion des produits
│   ├── markets/               # Gestion des marchés
│   ├── agents/                # Gestion des agents
│   └── entries/               # Saisies de prix et validation
├── docker-compose.yml         # Configuration Docker
└── .env                       # Variables d'environnement
```

## Modèle de Données

### Entités Principales

#### Product (Produit)
```typescript
{
  id: string (UUID)
  name: string (unique)
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### Market (Marché)
```typescript
{
  id: string (UUID)
  name: string
  city: string
  location: geometry(Point, 4326)  // PostGIS
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### Agent
```typescript
{
  id: string (UUID)
  name: string
  phone: string (unique)
  role: Role (AGENT | ADMIN)
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### PriceEntry (Saisie de Prix)
```typescript
{
  id: string (UUID)
  productId: string
  marketId: string
  agentId: string
  unit: string
  priceValue: Decimal(10,2)
  currency: string (default: "XOF")
  photoUrl: string?
  lat: Float
  lon: Float
  capturedAt: DateTime
  status: EntryStatus (PENDING | VALIDATED | REJECTED)
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### Validation
```typescript
{
  id: string (UUID)
  entryId: string (unique)
  adminId: string
  decision: EntryStatus
  reason: string?
  validatedAt: DateTime
}
```

### Contraintes de Données

1. **Limite quotidienne**: Maximum 3 saisies par jour par combinaison (agent, produit, marché)
2. **Détection de doublons**: Contrainte unique sur `(productId, marketId, unit, capturedAt, priceValue)`
3. **Géolocalisation**: Stockage GPS en format PostGIS POINT avec SRID 4326

## API Endpoints

### Authentification

#### Flux d'Authentification OTP → JWT

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant DB
    participant OTPService

    Client->>API: POST /auth/login {phone}
    API->>OTPService: Générer OTP (6 chiffres)
    API->>DB: Invalider anciens OTP
    API->>DB: Créer OTP (expires_at: +5min)
    API-->>Client: {message: "OTP sent", expiresIn: 300}
    
    Note over Client: Utilisateur reçoit OTP<br/>(SMS en production)
    
    Client->>API: POST /auth/verify {phone, otp}
    API->>DB: Chercher OTP valide
    alt OTP invalide ou expiré
        API-->>Client: 401 Unauthorized
    else OTP valide
        API->>DB: Marquer OTP comme utilisé
        API->>DB: Trouver/Créer Agent
        API->>API: Générer Access Token (15min)
        API->>API: Générer Refresh Token (7j)
        API->>DB: Stocker Refresh Token (hashé)
        API-->>Client: {access_token, refresh_token, expires_in}
    end
```

#### `POST /auth/login`
Génère et stocke un OTP pour un numéro de téléphone.

**Rate Limiting:** 5 requêtes/heure par IP

**Request:**
```json
{
  "phone": "+22997123456"
}
```

**Response:**
```json
{
  "message": "OTP sent",
  "expiresIn": 300
}
```

**Comportement:**
- Génère un code OTP à 6 chiffres
- Invalide tous les OTP non utilisés précédents pour ce numéro
- Stocke l'OTP en base avec expiration de 5 minutes
- En production: envoie l'OTP par SMS

---

#### `POST /auth/verify`
Vérifie l'OTP et retourne les tokens JWT.

**Rate Limiting:** 5 requêtes/heure par IP

**Request:**
```json
{
  "phone": "+22997123456",
  "otp": "123456"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 900
}
```

**Comportement:**
- Vérifie que l'OTP existe, n'est pas utilisé, et n'est pas expiré
- Marque l'OTP comme utilisé (single-use)
- Crée un agent si le numéro n'existe pas
- Génère un access token (15 minutes)
- Génère un refresh token (7 jours)
- Stocke le refresh token hashé en base

**Erreurs:**
- `401`: OTP invalide, expiré, ou déjà utilisé

---

#### `POST /auth/refresh`
Rafraîchit l'access token avec rotation sécurisée du refresh token.

**Rate Limiting:** 10 requêtes/heure par IP

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 900
}
```

**Comportement (Rotation Sécurisée):**
1. Vérifie la signature du refresh token
2. Vérifie que le token existe en base et n'est pas révoqué
3. **Révoque l'ancien refresh token**
4. Génère un nouveau access token
5. Génère un nouveau refresh token
6. Stocke le nouveau refresh token en base

**Erreurs:**
- `401`: Refresh token invalide, expiré, ou révoqué

---

### Synchronisation Mobile

#### `POST /sync/entries`
Reçoit un batch de saisies depuis l'application mobile.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Request:**
```json
[
  {
    "productId": "uuid",
    "marketId": "uuid",
    "unit": "kg",
    "priceValue": 1500,
    "currency": "XOF",
    "photoUrl": "https://...",
    "lat": 6.1319,
    "lon": 1.2228,
    "capturedAt": "2025-12-03T10:00:00Z"
  }
]
```

**Response:**
```json
[
  {
    "status": "CREATED",
    "id": "uuid",
    ...
  },
  {
    "status": "DUPLICATE",
    ...
  },
  {
    "status": "REJECTED",
    "reason": "Daily limit reached",
    ...
  }
]
```

### Administration

#### `GET /admin/entries?status=pending&page=1&limit=10`
Liste paginée des saisies en attente de validation.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
[
  {
    "id": "uuid",
    "product": { "id": "uuid", "name": "Tomate" },
    "market": { "id": "uuid", "name": "Marché Dantokpa", "city": "Cotonou" },
    "agent": { "id": "uuid", "name": "Jean Dupont" },
    "unit": "kg",
    "priceValue": 1500,
    "currency": "XOF",
    "photoUrl": "https://...",
    "capturedAt": "2025-12-03T10:00:00Z",
    "status": "PENDING"
  }
]
```

#### `POST /admin/entries/:id/validate`
Valide ou rejette une saisie.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Request:**
```json
{
  "decision": "VALIDATED",
  "reason": "Prix cohérent avec le marché"
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "VALIDATED",
  ...
}
```

### Ressources CRUD

#### Products
- `GET /products` - Liste tous les produits
- `POST /products` - Crée un produit

#### Markets
- `GET /markets` - Liste tous les marchés
- `POST /markets` - Crée un marché avec coordonnées GPS

**Exemple création marché:**
```json
{
  "name": "Marché Dantokpa",
  "city": "Cotonou",
  "lat": 6.3654,
  "lon": 2.4183
}
```

#### Agents
- `GET /agents` - Liste tous les agents
- `POST /agents` - Crée un agent

## Sécurité

### Authentification Multi-Niveaux

#### 1. OTP (One-Time Password)
- **Génération**: Code aléatoire à 6 chiffres
- **Stockage**: Base de données PostgreSQL (table `otps`)
- **Expiration**: 5 minutes
- **Single-use**: Marqué comme utilisé après vérification
- **Invalidation**: Anciens OTP non utilisés invalidés à chaque nouvelle demande
- **Production**: Intégration SMS (Twilio, AWS SNS, etc.)

#### 2. Access Token (JWT)
- **Secret**: Variable d'environnement `JWT_SECRET`
- **Durée de vie**: 15 minutes (short-lived)
- **Contenu**: `{ sub: userId, role: userRole }`
- **Algorithme**: HS256
- **Transmission**: Bearer token dans header Authorization

#### 3. Refresh Token (JWT)
- **Secret**: Variable d'environnement `JWT_REFRESH_SECRET`
- **Durée de vie**: 7 jours
- **Stockage**: Base de données (hashé avec bcrypt)
- **Rotation**: Ancien token révoqué lors du refresh
- **Révocation**: Support de révocation manuelle (logout)

### Guards et Contrôle d'Accès

#### JWT Guard
Protège les endpoints nécessitant une authentification.

```typescript
@UseGuards(AuthGuard('jwt'))
@Get('protected-route')
async protectedRoute() {
  // Accessible uniquement avec un access token valide
}
```

#### Roles Guard
Contrôle l'accès basé sur les rôles.

**Rôles disponibles:**
- `AGENT`: Agent de terrain collectant les prix
- `ADMIN`: Administrateur validant les saisies

**Utilisation:**
```typescript
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
@Post('admin/entries/:id/validate')
async validateEntry() {
  // Accessible uniquement aux ADMIN
}
```

### Rate Limiting

Protection contre les abus avec `@nestjs/throttler`.

**Configuration globale:**
- Limite: 100 requêtes/heure par IP
- TTL: 3600000 ms (1 heure)

**Limites spécifiques:**
- `POST /auth/login`: 5 requêtes/heure
- `POST /auth/verify`: 5 requêtes/heure
- `POST /auth/refresh`: 10 requêtes/heure

**Réponse en cas de dépassement:**
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

### Sécurité des Tokens

#### Stockage Côté Client
- **Access Token**: Mémoire (variable JavaScript)
- **Refresh Token**: HttpOnly cookie ou localStorage sécurisé

#### Bonnes Pratiques
1. Ne jamais exposer les secrets JWT
2. Utiliser HTTPS en production
3. Implémenter CORS strict
4. Valider tous les inputs
5. Logger les tentatives de connexion suspectes

## Infrastructure

### Docker Compose
```yaml
services:
  db:
    image: postgis/postgis:16-3.4
    ports:
      - '5433:5432'
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: nimbiwe
```

### Variables d'Environnement
```bash
DATABASE_URL="postgresql://postgres:password@localhost:5433/nimbiwe?schema=public"
JWT_SECRET="supersecretkey"
JWT_REFRESH_SECRET="supersecretrefreshkey"
```

## Déploiement

### Prérequis
- Node.js 18+
- Docker & Docker Compose
- npm

### Installation
```bash
cd backend
npm install
docker-compose up -d
npx prisma migrate dev
npx prisma generate
npm run start:dev
```

### Tests
```bash
npm run test
npm run test:e2e
```

## Améliorations Implémentées

✅ **OTP Persistant**: Stockage en base avec expiration et single-use  
✅ **Refresh Tokens**: Rotation sécurisée avec révocation  
✅ **Role Guards**: Contrôle d'accès basé sur les rôles  
✅ **Rate Limiting**: Protection contre les abus  

## Améliorations Futures

1. **SMS Integration**: Service d'envoi OTP (Twilio, AWS SNS)
2. **Redis**: Cache pour rate limiting et sessions
3. **2FA**: Authentification à deux facteurs optionnelle
4. **Logging**: Winston ou Pino pour logs structurés
5. **Monitoring**: Prometheus + Grafana
6. **CI/CD**: GitHub Actions
7. **Documentation**: Swagger/OpenAPI
8. **Validation**: Class-validator pour DTOs
9. **Pagination**: Curseur pour grandes datasets
10. **PostGIS**: Recherche par rayon géographique
