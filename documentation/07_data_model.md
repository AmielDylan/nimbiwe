# Modèle de Données - Nimbiwe

## Vue d'ensemble

Le modèle de données de Nimbiwe est conçu pour gérer la collecte et la validation des prix de produits sur différents marchés. Il utilise PostgreSQL avec l'extension PostGIS pour la gestion des données géospatiales.

## Entités

### Product (Produit)

Représente un produit dont le prix est suivi sur les marchés.

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Identifiant unique du produit |
| `name` | String | UNIQUE, NOT NULL | Nom du produit |
| `category` | String | NULLABLE | Catégorie du produit (optionnel) |
| `units_allowed` | String[] | NOT NULL | Liste des unités autorisées pour ce produit |
| `created_at` | Timestamp | NOT NULL, DEFAULT now() | Date de création |
| `updated_at` | Timestamp | NOT NULL, AUTO UPDATE | Date de dernière modification |

**Relations:**
- `entries`: One-to-Many avec PriceEntry

**Exemples:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Tomate",
  "category": "Légumes",
  "units_allowed": ["kg", "basket"],
  "created_at": "2025-12-03T10:00:00Z",
  "updated_at": "2025-12-03T10:00:00Z"
}
```

---

### Market (Marché)

Représente un marché physique où les prix sont collectés.

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Identifiant unique du marché |
| `name` | String | NOT NULL | Nom du marché |
| `city` | String | NOT NULL | Ville où se trouve le marché |
| `location` | geometry(Point, 4326) | NULLABLE, GIST INDEX | Coordonnées GPS du marché (PostGIS) |
| `created_at` | Timestamp | NOT NULL, DEFAULT now() | Date de création |
| `updated_at` | Timestamp | NOT NULL, AUTO UPDATE | Date de dernière modification |

**Index:**
- `market_location_idx`: Index spatial GIST sur `location`

**Relations:**
- `entries`: One-to-Many avec PriceEntry

**Format de localisation:**
- SRID: 4326 (WGS 84)
- Format: POINT(longitude latitude)

**Exemples:**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "name": "Marché Dantokpa",
  "city": "Cotonou",
  "location": "POINT(2.4183 6.3654)",
  "created_at": "2025-12-03T10:00:00Z",
  "updated_at": "2025-12-03T10:00:00Z"
}
```

---

### Agent

Représente un utilisateur du système (agent de terrain ou administrateur).

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Identifiant unique de l'agent |
| `name` | String | NOT NULL | Nom complet de l'agent |
| `phone` | String | UNIQUE, NOT NULL | Numéro de téléphone (utilisé pour l'authentification) |
| `role` | Enum | NOT NULL, DEFAULT 'AGENT' | Rôle: AGENT ou ADMIN |
| `created_at` | Timestamp | NOT NULL, DEFAULT now() | Date de création |
| `updated_at` | Timestamp | NOT NULL, AUTO UPDATE | Date de dernière modification |

**Enum `Role`:**
- `AGENT`: Agent de terrain collectant les prix
- `ADMIN`: Administrateur validant les saisies

**Relations:**
- `entries`: One-to-Many avec PriceEntry
- `validations`: One-to-Many avec Validation

**Exemples:**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "name": "Jean Dupont",
  "phone": "+22997123456",
  "role": "AGENT",
  "created_at": "2025-12-03T10:00:00Z",
  "updated_at": "2025-12-03T10:00:00Z"
}
```

---

### PriceEntry (Saisie de Prix)

Représente une observation de prix effectuée par un agent sur un marché.

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Identifiant unique de la saisie |
| `product_id` | UUID | FOREIGN KEY, NOT NULL | Référence au produit |
| `market_id` | UUID | FOREIGN KEY, NOT NULL | Référence au marché |
| `unit` | Enum | NOT NULL | Unité de mesure |
| `price_value` | Numeric(12,2) | NOT NULL | Valeur du prix |
| `currency` | Char(3) | NOT NULL, DEFAULT 'XOF' | Code devise ISO 4217 |
| `photo_url` | Text | NULLABLE | URL de la photo du prix |
| `lat` | Double Precision | NOT NULL | Latitude du point de capture |
| `lon` | Double Precision | NOT NULL | Longitude du point de capture |
| `captured_at` | Timestamptz | NOT NULL | Date et heure de capture |
| `agent_id` | UUID | FOREIGN KEY, NOT NULL | Référence à l'agent |
| `status` | Enum | NOT NULL, DEFAULT 'pending' | Statut de validation |
| `version` | Integer | NOT NULL, DEFAULT 1 | Version de la saisie |
| `created_at` | Timestamp | NOT NULL, DEFAULT now() | Date de création |
| `updated_at` | Timestamp | NOT NULL, AUTO UPDATE | Date de dernière modification |

**Enum `Unit`:**
- `kg`: Kilogramme
- `piece`: Pièce/Unité
- `basket`: Panier/Tas

**Enum `EntryStatus`:**
- `pending`: En attente de validation
- `validated`: Validé par un administrateur
- `rejected`: Rejeté par un administrateur

**Index:**
- `price_entry_lookup_idx`: Index composite sur `(product_id, market_id, captured_at)`

**Contrainte unique:**
- `unique_price_entry`: Empêche les doublons exacts sur `(product_id, market_id, unit, captured_at, price_value, currency)`

**Relations:**
- `product`: Many-to-One avec Product
- `market`: Many-to-One avec Market
- `agent`: Many-to-One avec Agent
- `validation`: One-to-One avec Validation (optionnel)

**Exemples:**
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "product_id": "550e8400-e29b-41d4-a716-446655440000",
  "market_id": "660e8400-e29b-41d4-a716-446655440001",
  "unit": "kg",
  "price_value": 1500.00,
  "currency": "XOF",
  "photo_url": "https://storage.example.com/photos/abc123.jpg",
  "lat": 6.3654,
  "lon": 2.4183,
  "captured_at": "2025-12-03T14:30:00Z",
  "agent_id": "770e8400-e29b-41d4-a716-446655440002",
  "status": "pending",
  "version": 1,
  "created_at": "2025-12-03T14:31:00Z",
  "updated_at": "2025-12-03T14:31:00Z"
}
```

---

### Validation

Représente une décision de validation ou de rejet d'une saisie de prix par un administrateur.

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Identifiant unique de la validation |
| `price_entry_id` | UUID | FOREIGN KEY, UNIQUE, NOT NULL | Référence à la saisie validée |
| `admin_id` | UUID | FOREIGN KEY, NOT NULL | Référence à l'administrateur |
| `decision` | Enum | NOT NULL | Décision de validation |
| `reason` | Text | NULLABLE | Raison de la décision (optionnel) |
| `validated_at` | Timestamptz | NOT NULL, DEFAULT now() | Date et heure de validation |

**Enum `ValidationDecision`:**
- `validated`: Saisie approuvée
- `rejected`: Saisie rejetée

**Relations:**
- `price_entry`: One-to-One avec PriceEntry
- `admin`: Many-to-One avec Agent (où role = 'ADMIN')

**Exemples:**
```json
{
  "id": "990e8400-e29b-41d4-a716-446655440004",
  "price_entry_id": "880e8400-e29b-41d4-a716-446655440003",
  "admin_id": "770e8400-e29b-41d4-a716-446655440005",
  "decision": "validated",
  "reason": "Prix cohérent avec les observations du marché",
  "validated_at": "2025-12-03T15:00:00Z"
}
```

---

## Contraintes et Règles Métier

### 1. Unicité des Saisies

La contrainte `unique_price_entry` empêche les doublons exacts basés sur:
- Produit
- Marché
- Unité
- Date/heure de capture
- Prix
- Devise

**Objectif:** Éviter les saisies en double accidentelles.

### 2. Limite Quotidienne

**Règle métier** (implémentée au niveau application):
- Maximum **3 saisies par jour** par combinaison (agent, produit, marché)
- La limite est calculée sur la journée calendaire (00:00 - 23:59)

**Implémentation:** Vérification dans `EntriesService.syncEntries()`

### 3. Géolocalisation

**Coordonnées de capture:**
- `lat` et `lon` dans PriceEntry: Position exacte où le prix a été observé
- `location` dans Market: Position du marché (peut différer légèrement)

**Format PostGIS:**
- SRID 4326 (WGS 84)
- Type: `geometry(Point, 4326)`
- Index spatial GIST pour recherches géographiques

### 4. Workflow de Validation

1. **Création:** Saisie créée avec `status = 'pending'`
2. **Validation:** Admin crée un enregistrement Validation
3. **Mise à jour:** Status de PriceEntry mis à jour (`validated` ou `rejected`)

### 5. Versioning

Le champ `version` dans PriceEntry permet:
- Suivi des modifications
- Gestion de la concurrence optimiste
- Historique des changements (future implémentation)

---

## Diagramme de Relations

```
┌─────────────┐
│   Product   │
│  (Produit)  │
└──────┬──────┘
       │ 1
       │
       │ N
┌──────▼──────────┐         ┌─────────────┐
│   PriceEntry    │ N     1 │   Market    │
│ (Saisie Prix)   ├─────────┤  (Marché)   │
└──────┬──────────┘         └─────────────┘
       │ N
       │
       │ 1
┌──────▼──────┐
│    Agent    │
│             │◄──────┐
└──────┬──────┘       │
       │ 1            │ 1
       │              │
       │ N            │ N
┌──────▼──────────┐  │
│   Validation    │  │
│                 ├──┘
└─────────────────┘
```

---

## Extensions PostgreSQL

### PostGIS

**Version:** 3.4
**Utilisation:**
- Stockage des coordonnées GPS des marchés
- Index spatial pour recherches géographiques
- Fonctions spatiales (ST_MakePoint, ST_Distance, etc.)

**Activation:**
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

**Vérification:**
```sql
SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis';
```

---

## Migrations

### Migration Initiale: `20251203231436_initial_schema`

Crée toutes les tables, enums, index et contraintes du schéma.

**Fichier:** `prisma/migrations/20251203231436_initial_schema/migration.sql`

**Commandes Prisma:**
```bash
# Appliquer les migrations
npx prisma migrate dev

# Réinitialiser la base
npx prisma migrate reset --force

# Générer le client Prisma
npx prisma generate
```

---

## Considérations de Performance

### Index Recommandés

1. **Recherche de saisies:**
   - `(product_id, market_id, captured_at)` ✅ Implémenté

2. **Filtrage par statut:**
   - `(status, captured_at)` - À considérer si beaucoup de saisies

3. **Recherche géographique:**
   - GIST sur `location` dans Market ✅ Implémenté

### Optimisations Futures

1. **Partitionnement:** Partitionner PriceEntry par mois si volume élevé
2. **Archivage:** Déplacer les anciennes validations vers table d'archive
3. **Matérialized Views:** Pour statistiques et rapports
4. **Cache:** Redis pour données fréquemment consultées

---

## Sécurité des Données

### Données Sensibles

- **Numéros de téléphone:** Stockés en clair (à chiffrer en production)
- **Coordonnées GPS:** Précision à considérer pour la vie privée

### Recommandations

1. Chiffrer les numéros de téléphone au repos
2. Implémenter RBAC (Role-Based Access Control)
3. Auditer les accès aux données sensibles
4. Anonymiser les données pour analytics
