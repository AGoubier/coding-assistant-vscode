---
name: retro-data-model
description: "Extracts data models, entity schemas, relationships, validation rules, and state machines from legacy code"
argument-hint: "Invoked by Retro-Spec Coordinator - do not call directly"
---

# retro-data-model -- Data Model Extraction Skill

This skill is invoked by the Retro-Spec Coordinator as the second extraction skill. It analyzes the legacy codebase to extract data models, entity definitions, relationships, validation rules, and state machines, producing Section 7 (Data Model) and companion artifacts.

## Input Contract

| # | Input | Description |
|---|-------|-------------|
| 1 | `skill_path` | Path to this SKILL.md file |
| 2 | `accumulator_path` | Path to the spec file being built |
| 3 | `artifacts_dir` | Path to companion artifacts directory |
| 4 | `discovery_manifest_path` | Path to the discovery manifest |
| 5 | `source_path` | Path to the legacy source code |
| 6 | `target_language` | Target language for artifacts |
| 7 | `project_name` | Name of the project |
| 8 | `module_filter` | Modules to analyze |

## Execution Sequence

1. **Read this SKILL.md**
2. **Read discovery manifest** for database and ORM info
3. **Read accumulator** for architecture context (Section 9)
4. **Analyze data models** in the legacy source code. Use `#tool:search/usages` to trace entity relationships and `#tool:search/searchSubagent` to discover model definitions.
5. **Write Section 7** to the accumulator
6. **Produce artifacts**: `data-schemas.<ext>` and `state-machines.<ext>` in the artifacts directory

## Constraints

- NEVER execute database queries, migrations, or ORM commands
- NEVER modify legacy source files
- Do NOT write sections other than Section 7
- Use `[INFERRED: confidence]` for every entity and relationship claim
- Cite source files for every entity discovered

---

## Extraction Procedure

### Step 1: Entity Source Identification

Search for data model definitions in priority order:

1. **ORM Models** (highest confidence):
   - Sequelize: `grep "Model.init|define\(|@Table|@Column"` in `*.ts`, `*.js`
   - Prisma: Read `schema.prisma` file -- each `model` block is an entity
   - TypeORM: `grep "@Entity|@Column|@PrimaryColumn"` in `*.ts`
   - Django: `grep "models.Model|models.CharField|models.ForeignKey"` in `*.py`
   - SQLAlchemy: `grep "Base|Column|relationship|ForeignKey"` in `*.py`
   - GORM: `grep "gorm.Model"` in `*.go`
   - ActiveRecord: `grep "< ApplicationRecord|< ActiveRecord"` in `*.rb`
   - Entity Framework: `grep "DbSet|DbContext|\[Key\]|\[Required\]"` in `*.cs`

2. **Database Migrations** (high confidence):
   - Search for migration directories: `migrations/`, `db/migrate/`, `alembic/`
   - Read migration files to extract CREATE TABLE, ALTER TABLE statements
   - Extract column types, constraints, indexes, foreign keys

3. **Schema Files** (high confidence):
   - SQL schema files: `*.sql` in `schema/`, `db/`, `sql/`
   - GraphQL schemas: `*.graphql`, `*.gql`
   - Protobuf definitions: `*.proto`
   - JSON Schema files: `*.schema.json`
   - OpenAPI/Swagger: `openapi.yaml`, `swagger.json`

4. **TypeScript/Language Interfaces** (medium confidence):
   - Type definitions in `types/`, `interfaces/`, `models/`
   - Class definitions with typed properties
   - Zod/Joi/Yup validation schemas

5. **API Response Shapes** (lower confidence):
   - Response construction in controllers/handlers
   - Serializer/transformer definitions

### Step 2: Entity Property Extraction

For each identified entity:

1. **Read the source file** containing the entity definition
2. **Extract fields**: name, type, nullability, default value, constraints
3. **Map types to portable types**:
   | Source Type | Portable Type |
   |------------|---------------|
   | `VARCHAR(N)`, `string`, `String`, `str` | `string` (max: N) |
   | `INT`, `INTEGER`, `number`, `int`, `i32` | `integer` |
   | `FLOAT`, `DOUBLE`, `DECIMAL`, `f64` | `float` |
   | `BOOLEAN`, `bool`, `Boolean` | `boolean` |
   | `TIMESTAMP`, `DATETIME`, `DateTime` | `datetime` |
   | `DATE` | `date` |
   | `UUID`, `Uuid` | `UUID` |
   | `JSON`, `JSONB`, `dict`, `object` | `JSON` |
   | `TEXT`, `LONGTEXT` | `text` |
   | `ENUM(...)` | `enum` (list values) |
   | `BLOB`, `BYTEA`, `bytes` | `binary` |

4. **Extract constraints**:
   - Unique constraints (unique indexes, `@Unique`, `unique=True`)
   - Not-null constraints (`NOT NULL`, `required`, `!`)
   - Check constraints (min/max, regex patterns, custom validators)
   - Default values
   - Auto-generation (auto-increment, UUID generation, timestamps)

5. **Extract indexes**:
   - Primary keys
   - Unique indexes
   - Composite indexes
   - Full-text indexes

### Step 3: Relationship Extraction

1. **Foreign keys**: Look for FK definitions in ORM decorators, migration files, SQL schemas
2. **Cardinality detection**:
   - `belongsTo` / `ManyToOne` / `ForeignKey` -> N:1
   - `hasMany` / `OneToMany` -> 1:N
   - `hasOne` / `OneToOne` -> 1:1
   - `belongsToMany` / `ManyToMany` / junction tables -> N:M
3. **Junction tables**: Identify join tables for M:N relationships
4. **Cascade rules**: Extract ON DELETE / ON UPDATE behavior
5. **Self-referential**: Detect entities that reference themselves (tree structures, hierarchies)

### Step 4: Validation Rule Extraction

Search for validation logic associated with each entity:

1. **Schema validators**: Zod schemas, Joi schemas, class-validator decorators, Django validators
2. **Custom validation methods**: Methods named `validate*`, `check*`, `is_valid`
3. **API-level validation**: Express middleware validators, FastAPI Pydantic models
4. **Cross-field validation**: Rules that involve multiple fields together
5. **Business rules**: Conditional validations based on entity state

### Step 5: State Machine Detection

Identify entities with state/status fields and their transitions:

1. **Enum fields named `status`/`state`/`phase`**: Extract all enum values
2. **Transition functions**: Methods that change status fields
3. **Guards**: Conditions checked before state transitions
4. **State-specific behavior**: Switch/match statements on status fields

For each state machine, document:
- All states (enum values)
- Valid transitions (which states can transition to which)
- Transition triggers (what action causes the transition)
- Guards (what conditions must be true)

---

## Section 7 Output Format

```markdown
## 7. Data Model

### 7.1 <Entity Name>

<One-line description of the entity's purpose>
[INFERRED: confidence] Source: <file:lines>

| Field | Type | Required | Constraints | Default | Description |
|-------|------|----------|-------------|---------|-------------|
| id | UUID | yes | primary key | generated | Unique identifier |
| name | string | yes | max 255 | - | <description> |
| status | <EnumName> (enum) | yes | see state machine | "draft" | Current state |

#### Relationships

| Related Entity | Cardinality | FK Location | Cascade | Source |
|---------------|-------------|-------------|---------|--------|
| <Entity B> | 1:N | <Entity B>.entity_a_id | CASCADE | <file:line> |

#### Validation Rules

- <Rule description> [INFERRED: confidence] Source: <file:line>

#### Indexes

| Name | Columns | Type | Source |
|------|---------|------|--------|
| idx_entity_email | email | unique | <migration file:line> |

(If state machine detected:)

#### State Machine: <EnumName>

**States**: `draft`, `active`, `archived`

| From | To | Trigger | Guard | Source |
|------|-----|---------|-------|--------|
| draft | active | publish() | all fields valid | <file:line> |
| active | archived | archive() | no pending refs | <file:line> |
```

---

## Companion Artifacts

### data-schemas.<ext>

Produce typed entity definitions in the TARGET language:

```typescript
// Generated by: retro-data-model skill (retro-spec)
// Source legacy code: <source_path>
// Target language: TypeScript
// Confidence: HIGH
// DO NOT EDIT MANUALLY -- regenerated on retro-spec re-run

export interface User {
  id: string;           // UUID, primary key
  email: string;        // max 255, unique, email format
  name: string;         // max 100
  status: UserStatus;   // enum, default "active"
  createdAt: Date;      // immutable
  updatedAt: Date;
}

export enum UserStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended",
}
```

### state-machines.<ext>

Produce state machine definitions in the TARGET language (only if state machines were detected):

```typescript
// Generated by: retro-data-model skill (retro-spec)
// Source legacy code: <source_path>
// Target language: TypeScript
// Confidence: MEDIUM
// DO NOT EDIT MANUALLY -- regenerated on retro-spec re-run

export const UserStatusTransitions: Record<UserStatus, UserStatus[]> = {
  [UserStatus.ACTIVE]: [UserStatus.INACTIVE, UserStatus.SUSPENDED],
  [UserStatus.INACTIVE]: [UserStatus.ACTIVE],
  [UserStatus.SUSPENDED]: [UserStatus.ACTIVE],
};
```
