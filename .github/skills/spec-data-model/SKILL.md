---
name: spec-data-model
description: "Produces data model with typed entities and companion artifact files"
argument-hint: "Invoked by Spec Architect Coordinator - do not call directly"
---

# spec-data-model - Data Model Skill

This skill is invoked by the Spec Architect Coordinator as a subagent. It produces Section 7 (Data Model) of the specification and companion artifact files: `data-models.<ext>` and `state-machines.<ext>`.

## Input Contract

This skill receives the following inputs via the coordinator's subagent prompt:

| # | Input | Description |
|---|-------|-------------|
| 1 | `skill_path` | Path to this SKILL.md file |
| 2 | `accumulator_path` | Path to the spec file being built |
| 3 | `artifacts_dir` | Path to the companion artifacts directory |
| 4 | `brief_path` | Path to the source ideation brief |
| 5 | `research_summary` | Key findings from the research phase |
| 6 | `section_numbers` | `7` |
| 7 | `patterns` | Active spec-domain patterns to avoid |
| 8 | `target_language` | Programming language for artifacts (TypeScript, Python, etc.) |

## Execution Sequence

1. **Read this SKILL.md** to load instructions and guidelines
2. **Read the accumulator** at `accumulator_path` to understand sections 1-6 (Overview, Goals, Users, FRs, User Stories, Flows)
3. **Read the brief** at `brief_path` for domain context
4. **Write Section 7** to the accumulator by APPENDING after existing content
5. **Produce companion artifacts** in `artifacts_dir`: `data-models.<ext>` and `state-machines.<ext>` (if applicable)

## Constraints

- Do NOT modify sections 1 through 6 (earlier skills' sections)
- If you discover an inconsistency with a prior section, add: `[CROSS-REF ISSUE: <description>]`
- Use `[NEEDS CLARIFICATION: <reason>]` for any unresolved decisions
- Use plain ASCII only - no em dashes, smart quotes, or curly apostrophes
- Artifacts contain TYPE DEFINITIONS ONLY - no I/O, network, or filesystem operations

---

## Section 7 - Data Model (FR-036)

Write Section 7 defining every entity the system manages. Derive entities from:
- FRs in Section 4 (look for nouns that represent persistent data)
- User stories in Section 5 (look for objects users create, read, update, delete)
- User flows in Section 6 (look for data passed between steps)

### Entity Format

For each entity, provide ALL of the following:

#### 1. Entity Name and Description

```markdown
### 7.X <Entity Name>

<One-line description of the entity's purpose in the system.>
```

#### 2. Fields Table

Every entity SHALL have a fields table with ALL columns filled:

```markdown
| Field | Type | Required | Constraints | Default | Description |
|-------|------|----------|-------------|---------|-------------|
| id | UUID | yes | primary key | generated | Unique identifier |
| email | string | yes | unique, max 255, email format | - | User email address |
| status | OrderStatus (enum) | yes | see state machine | "draft" | Current order state |
| created_at | datetime | yes | immutable | now() | Creation timestamp |
```

**Type precision rules**:
- Use specific types: `UUID`, `string`, `integer`, `float`, `boolean`, `datetime`, `date`, `enum`, `JSON`
- For strings: include max length in constraints
- For numbers: include min/max range in constraints if bounded
- For enums: list all valid values in constraints or reference the enum definition
- Mark nullability explicitly: `string | null` if nullable

#### 3. Relationships

```markdown
#### Relationships

| Related Entity | Cardinality | Description |
|---------------|-------------|-------------|
| Order | 1:N | A user can have many orders |
| Role | N:M | Users can have multiple roles |
```

#### 4. Validation Rules

List cross-field validations and business rules that go beyond individual field constraints:

```markdown
#### Validation Rules

- If `role` is "admin", `email` must end with "@company.com"
- `end_date` must be after `start_date`
- Cannot have more than 5 active orders simultaneously
```

#### 5. State Machine (if applicable)

If the entity has a status/state field, define the complete state machine:

```markdown
#### State Machine: <Entity> <Field>

**States**: draft, submitted, approved, rejected, archived

| From | To | Guard | Side Effects |
|------|-----|-------|-------------|
| draft | submitted | all required fields filled | Send notification to reviewers |
| submitted | approved | reviewer has "approve" permission | Update approved_at timestamp |
| submitted | rejected | reviewer has "reject" permission | Send rejection notification |
| approved | archived | 30 days since approval | none |

**Invalid transitions**: Any transition not listed above SHALL be rejected with error "INVALID_STATE_TRANSITION".
```

### Entity Checklist

For each entity, verify:
- [ ] All fields have type, required, constraints, default, description
- [ ] All relationships listed with cardinality
- [ ] Validation rules documented (or "None" if truly none)
- [ ] State machine defined if entity has a status/state field
- [ ] Field precision is sufficient to generate code without interpretation

---

## Companion Artifacts (FR-037, FR-038, FR-028)

After writing Section 7 prose, produce companion artifact files in the `artifacts_dir`.

### data-models.<ext>

Produce `data-models.<ext>` (extension matches target language) containing typed definitions for ALL entities from Section 7.

**Critical rule**: Field names, types, constraints, and defaults in the artifact SHALL match Section 7 prose EXACTLY. No renaming, no type coercion, no missing fields.

**TypeScript example**:
```typescript
// Generated by: spec-data-model skill
// Source spec: .sdd/specs/<NNN>-<idea-name>.spec.md, Section 7
// Target language: TypeScript
// DO NOT EDIT MANUALLY -- regenerated on spec revision

export interface User {
  id: string;            // UUID, primary key
  email: string;         // unique, max 255, email format
  name: string;          // max 100
  role: UserRole;        // enum
  created_at: Date;      // immutable
}

export enum UserRole {
  ADMIN = "admin",
  USER = "user",
}
```

**Python example**:
```python
# Generated by: spec-data-model skill
# Source spec: .sdd/specs/<NNN>-<name>.spec.md, Section 7
# Target language: Python
# DO NOT EDIT MANUALLY -- regenerated on spec revision

from dataclasses import dataclass
from enum import Enum
from datetime import datetime
from typing import Optional

class UserRole(Enum):
    ADMIN = "admin"
    USER = "user"

@dataclass
class User:
    id: str              # UUID, primary key
    email: str           # unique, max 255, email format
    name: str            # max 100
    role: UserRole       # enum
    created_at: datetime # immutable
```

### state-machines.<ext>

If ANY entity in Section 7 has a state machine, produce `state-machines.<ext>` containing:
1. State enums for each state machine
2. A transition validation function per entity

**TypeScript example**:
```typescript
// Generated by: spec-data-model skill
// Source spec: .sdd/specs/<NNN>-<idea-name>.spec.md, Section 7
// Target language: TypeScript
// DO NOT EDIT MANUALLY -- regenerated on spec revision

export enum OrderStatus {
  DRAFT = "draft",
  SUBMITTED = "submitted",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.DRAFT]: [OrderStatus.SUBMITTED],
  [OrderStatus.SUBMITTED]: [OrderStatus.APPROVED, OrderStatus.REJECTED],
  [OrderStatus.APPROVED]: [],
  [OrderStatus.REJECTED]: [],
};
```

If no entity has state fields, do NOT create `state-machines.<ext>`.

### Manifest Comment

Every artifact file SHALL begin with a manifest comment:
```
// Generated by: spec-data-model skill
// Source spec: .sdd/specs/<NNN>-<idea-name>.spec.md, Section 7
// Target language: <language>
// DO NOT EDIT MANUALLY -- regenerated on spec revision
```

Comment syntax: `//` for TypeScript/JavaScript, `#` for Python, `--` for SQL.

---

## Quality Checklist

Before finishing, verify your output against these checks:

1. [ ] Every entity has a complete fields table (all columns filled)
2. [ ] Every field has a precise type (no "any" or "object" without specification)
3. [ ] Every entity has relationships documented (or "None")
4. [ ] Every entity with a status field has a state machine
5. [ ] State machines list all valid transitions AND declare invalid transitions rejected
6. [ ] `data-models.<ext>` exists in artifacts directory with all entities
7. [ ] Field names in artifact match Section 7 prose exactly
8. [ ] Field types in artifact match Section 7 prose exactly
9. [ ] `state-machines.<ext>` exists if any entity has state fields
10. [ ] All artifact files have manifest comments
11. [ ] No I/O, network, or filesystem code in artifacts
12. [ ] Active patterns from the coordinator prompt have been followed
