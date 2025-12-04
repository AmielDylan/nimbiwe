# Guide Git - Commits Recommandés

Le projet n'est pas encore un dépôt Git. Voici les commandes pour initialiser Git et créer des commits organisés :

## 1. Initialiser Git

```bash
cd /Users/amieladjovi/Documents/Projets/Developpement/Projets/nimbiwe
git init
git branch -M main
```

## 2. Créer .gitignore

```bash
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
backend/node_modules/

# Environment
.env
.env.local
.env.*.local

# Build
dist/
build/
backend/dist/

# Logs
*.log
npm-debug.log*

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Prisma
backend/prisma/migrations/.migration_lock.toml

# Coverage
coverage/
*.lcov
EOF
```

## 3. Commits Recommandés

### Commit 1: Schema & Migrations
```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(schema): add database schema with PostGIS support

- Define Product, Market, Agent, PriceEntry, Validation models
- Add OTP and RefreshToken models for auth
- Add client_id for idempotent sync
- Include PostGIS geometry(Point, 4326) for Market locations
- Create all migrations"
```

### Commit 2: DTOs & Validation
```bash
git add backend/src/*/dto/
git commit -m "feat(dto): add DTOs with class-validator and Swagger

- SyncEntryDto with client_id and agent_id
- Comprehensive validation (price >= 1, ISO currency, GPS coords)
- Swagger @ApiProperty decorators
- CreateProductDto, CreateMarketDto, CreateAgentDto, ValidateEntryDto"
```

### Commit 3: Auth Module
```bash
git add backend/src/auth/
git commit -m "feat(auth): implement JWT + OTP with refresh tokens

- OTP storage in database (5min expiration, single-use)
- Refresh token rotation
- Role guards (Agent, Admin)
- Rate limiting (5 req/hour on auth endpoints)
- JWT strategy with Passport"
```

### Commit 4: Core Services
```bash
git add backend/src/products/ backend/src/markets/ backend/src/agents/
git commit -m "feat(core): implement Products, Markets, Agents modules

- ProductsService with CRUD operations
- MarketsService with PostGIS ST_MakePoint
- AgentsService with role management
- Swagger annotations on all controllers"
```

### Commit 5: Entries with Idempotence
```bash
git add backend/src/entries/
git commit -m "feat(entries): implement idempotent sync with status responses

- Check client_id for idempotence
- Return: accepted|rejected|duplicate|limit_exceeded
- Daily limit enforcement (3 entries/day)
- Pino logging for admin actions
- Standardized error handling"
```

### Commit 6: Infrastructure
```bash
git add backend/src/main.ts backend/src/app.module.ts backend/src/common/ backend/src/health/ backend/src/prisma/
git commit -m "feat(infra): add Swagger, health check, request-ID, logging

- Swagger UI on /docs with full API documentation
- Health check endpoint verifying DB and PostGIS
- Request-ID middleware with UUID generation
- Pino logger with JSON formatting
- Global validation pipe
- CORS configuration"
```

### Commit 7: Database Seed
```bash
git add backend/prisma/seed.ts backend/package.json
git commit -m "feat(seed): add database seed script

- 3 products (Tomate, Oignon, Riz)
- 5 markets in Cotonou with PostGIS coordinates
- 2 agents with AGENT role
- npm scripts: seed, generate:openapi"
```

### Commit 8: Tests
```bash
git add backend/test/
git commit -m "test(entries): add E2E tests for /sync/entries

- Test success, invalid payloads, duplicates
- Test daily limit enforcement
- Test authentication requirement
- 8 comprehensive test scenarios"
```

### Commit 9: CI/CD
```bash
git add backend/.github/
git commit -m "ci: add GitHub Actions workflow

- Run lint, test, build on push/PR
- PostgreSQL + PostGIS service
- Node.js 18 with npm cache
- Codecov integration"
```

### Commit 10: Documentation
```bash
git add documentation/
git commit -m "docs: add comprehensive project documentation

- 03_backend_api.md: API endpoints with examples
- 07_data_model.md: database schema details
- 08_security.md: security measures
- 09_deploiement.md: CI/CD and deployment guide
- Complete with diagrams and best practices"
```

### Commit 11: Configuration
```bash
git add backend/docker-compose.yml backend/tsconfig.json backend/nest-cli.json backend/eslint.config.mjs
git commit -m "chore: add project configuration files

- Docker Compose for PostgreSQL + PostGIS
- TypeScript configuration
- NestJS CLI configuration
- ESLint configuration"
```

## 4. Push to Remote (Optional)

```bash
# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/nimbiwe.git

# Push to main
git push -u origin main
```

## 5. Vérifier l'État

```bash
git status
git log --oneline
```

## Notes

- Les commits suivent la convention [Conventional Commits](https://www.conventionalcommits.org/)
- Préfixes: `feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`
- Chaque commit est atomique et logique
- Les messages sont descriptifs avec détails dans le corps
