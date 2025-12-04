#!/bin/bash

# Script pour créer tous les commits Git du projet Nimbiwe
# Usage: chmod +x create_commits.sh && ./create_commits.sh

set -e

echo "🚀 Création des commits Git pour le projet Nimbiwe..."

# Commit 1: Schema & Migrations
echo "📦 Commit 1/11: Schema & Migrations"
git add backend/prisma/schema.prisma backend/prisma/migrations/ backend/prisma.config.ts
git commit -m "feat(schema): add database schema with PostGIS support

- Define Product, Market, Agent, PriceEntry, Validation models
- Add OTP and RefreshToken models for auth
- Add client_id for idempotent sync
- Include PostGIS geometry(Point, 4326) for Market locations
- Create all migrations"

# Commit 2: DTOs & Validation
echo "📦 Commit 2/11: DTOs & Validation"
git add backend/src/products/dto/ backend/src/markets/dto/ backend/src/agents/dto/ backend/src/entries/dto/
git commit -m "feat(dto): add DTOs with class-validator and Swagger

- SyncEntryDto with client_id and agent_id
- Comprehensive validation (price >= 1, ISO currency, GPS coords)
- Swagger @ApiProperty decorators
- CreateProductDto, CreateMarketDto, CreateAgentDto, ValidateEntryDto"

# Commit 3: Auth Module
echo "📦 Commit 3/11: Auth Module"
git add backend/src/auth/
git commit -m "feat(auth): implement JWT + OTP with refresh tokens

- OTP storage in database (5min expiration, single-use)
- Refresh token rotation
- Role guards (Agent, Admin)
- Rate limiting (5 req/hour on auth endpoints)
- JWT strategy with Passport"

# Commit 4: Core Services
echo "📦 Commit 4/11: Core Services"
git add backend/src/products/ backend/src/markets/ backend/src/agents/ backend/src/prisma/
git commit -m "feat(core): implement Products, Markets, Agents modules

- ProductsService with CRUD operations
- MarketsService with PostGIS ST_MakePoint
- AgentsService with role management
- PrismaService and PrismaModule
- Swagger annotations on all controllers"

# Commit 5: Entries with Idempotence
echo "📦 Commit 5/11: Entries with Idempotence"
git add backend/src/entries/
git commit -m "feat(entries): implement idempotent sync with status responses

- Check client_id for idempotence
- Return: accepted|rejected|duplicate|limit_exceeded
- Daily limit enforcement (3 entries/day)
- Pino logging for admin actions
- Standardized error handling"

# Commit 6: Infrastructure
echo "📦 Commit 6/11: Infrastructure"
git add backend/src/main.ts backend/src/app.module.ts backend/src/app.controller.ts backend/src/app.service.ts backend/src/common/ backend/src/health/
git commit -m "feat(infra): add Swagger, health check, request-ID, logging

- Swagger UI on /docs with full API documentation
- Health check endpoint verifying DB and PostGIS
- Request-ID middleware with UUID generation
- Pino logger with JSON formatting
- Global validation pipe
- CORS configuration"

# Commit 7: Database Seed
echo "📦 Commit 7/11: Database Seed"
git add backend/prisma/seed.ts backend/package.json backend/package-lock.json
git commit -m "feat(seed): add database seed script

- 3 products (Tomate, Oignon, Riz)
- 5 markets in Cotonou with PostGIS coordinates
- 2 agents with AGENT role
- npm scripts: seed, generate:openapi
- Install all dependencies"

# Commit 8: Tests
echo "📦 Commit 8/11: Tests"
git add backend/test/
git commit -m "test(entries): add E2E tests for /sync/entries

- Test success, invalid payloads, duplicates
- Test daily limit enforcement
- Test authentication requirement
- 8 comprehensive test scenarios"

# Commit 9: CI/CD
echo "📦 Commit 9/11: CI/CD"
git add backend/.github/
git commit -m "ci: add GitHub Actions workflow

- Run lint, test, build on push/PR
- PostgreSQL + PostGIS service
- Node.js 18 with npm cache
- Codecov integration"

# Commit 10: Configuration
echo "📦 Commit 10/11: Configuration"
git add backend/docker-compose.yml backend/tsconfig.json backend/nest-cli.json backend/eslint.config.mjs backend/tsconfig.build.json backend/jest.config.js
git commit -m "chore: add project configuration files

- Docker Compose for PostgreSQL + PostGIS
- TypeScript configuration
- NestJS CLI configuration
- ESLint configuration
- Jest configuration"

# Commit 11: Documentation
echo "📦 Commit 11/11: Documentation"
git add documentation/ .gitignore GIT_COMMITS_GUIDE.md
git commit -m "docs: add comprehensive project documentation

- 03_backend_api.md: API endpoints with examples
- 07_data_model.md: database schema details
- 08_security.md: security measures
- 09_deploiement.md: CI/CD and deployment guide
- .gitignore and commit guide"

echo "✅ Tous les commits ont été créés avec succès!"
echo ""
echo "📊 Historique des commits:"
git log --oneline --graph
echo ""
echo "🎉 Projet prêt! Vous pouvez maintenant:"
echo "   git remote add origin <URL_DU_REPO>"
echo "   git push -u origin main"
