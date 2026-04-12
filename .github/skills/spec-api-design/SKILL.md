---
name: spec-api-design
description: "Produces API/interface design with typed contracts and error catalog artifacts"
argument-hint: "Invoked by Spec Architect Coordinator - do not call directly"
---

# spec-api-design - API / Interface Design Skill

This skill is invoked by the Spec Architect Coordinator as a subagent. It produces Section 8 (API / Interface Design) of the specification and companion artifact files: `api-contracts.<ext>`, `error-catalog.<ext>`, and `interfaces.<ext>`.

## Input Contract

This skill receives the following inputs via the coordinator's subagent prompt:

| # | Input | Description |
|---|-------|-------------|
| 1 | `skill_path` | Path to this SKILL.md file |
| 2 | `accumulator_path` | Path to the spec file being built |
| 3 | `artifacts_dir` | Path to the companion artifacts directory |
| 4 | `brief_path` | Path to the source ideation brief |
| 5 | `research_summary` | Key findings from the research phase |
| 6 | `section_numbers` | `8` |
| 7 | `patterns` | Active spec-domain patterns to avoid |
| 8 | `target_language` | Programming language for artifacts (TypeScript, Python, etc.) |

## Execution Sequence

1. **Read this SKILL.md** to load instructions and guidelines
2. **Read the accumulator** at `accumulator_path` to understand sections 1-7 (including Data Model)
3. **Read the brief** at `brief_path` for context. Read accumulator and brief in parallel.
4. **Write Section 8** to the accumulator by APPENDING after existing content
5. **Produce companion artifacts** in `artifacts_dir`: `api-contracts.<ext>`, `error-catalog.<ext>`, and `interfaces.<ext>`

## Constraints

- Do NOT modify sections 1 through 7 (earlier skills' sections)
- If you discover an inconsistency with a prior section, add: `[CROSS-REF ISSUE: <description>]`
- Use `[NEEDS CLARIFICATION: <reason>]` for any unresolved decisions
- Use plain ASCII only - no em dashes, smart quotes, or curly apostrophes
- Artifacts contain TYPE DEFINITIONS ONLY - no I/O, network, or filesystem operations
- Response schemas MUST reference data model entities from Section 7, not re-define fields

---

## Section 8 - API / Interface Design (FR-039)

Write Section 8 defining every public endpoint or interface. Derive endpoints from:
- FRs in Section 4 (each feature area typically maps to a resource/endpoint group)
- User stories in Section 5 (each user action implies an API operation)
- Data model entities in Section 7 (CRUD operations on entities)

### Endpoint Format

For each endpoint, provide ALL of the following:

```markdown
### 8.X <HTTP Method> <Path>

**Purpose**: <one-line description>

**Auth**: <auth requirements, e.g., "Bearer token, role: admin" or "Public">

**Request**:
- **Parameters**: <path/query parameters with types>
- **Body**: `<InputTypeName>`
  | Field | Type | Required | Constraints | Description |
  |-------|------|----------|-------------|-------------|
  | email | string | yes | max 255, email format | User email |

**Response** (200/201):
- **Body**: `<Entity>` (see Section 7.X)

**Errors**:
| Code | Error Key | Meaning | Response Body |
|------|-----------|---------|---------------|
| 400 | VALIDATION_ERROR | Invalid input fields | `{ error: "VALIDATION_ERROR", details: [...] }` |
| 401 | UNAUTHORIZED | Missing or invalid auth token | `{ error: "UNAUTHORIZED" }` |
| 403 | FORBIDDEN | Insufficient permissions | `{ error: "FORBIDDEN" }` |
| 404 | NOT_FOUND | Resource does not exist | `{ error: "NOT_FOUND" }` |
| 409 | CONFLICT | Duplicate or state conflict | `{ error: "CONFLICT", reason: "..." }` |
| 422 | UNPROCESSABLE | Business rule violation | `{ error: "UNPROCESSABLE", reason: "..." }` |
| 500 | INTERNAL_ERROR | Unexpected server error | `{ error: "INTERNAL_ERROR" }` |

**Rate limit**: <requests per window, or "None">
```

### Endpoint Rules

1. **All error codes** - Every endpoint SHALL list ALL applicable HTTP error codes. Include 400, 401, 403, 500 for every authenticated endpoint at minimum.
2. **Request schemas** - Every request with a body SHALL have a typed input schema with field-level validation rules.
3. **Response schemas reference Section 7** - Response bodies SHALL reference data model entities from Section 7. Do NOT re-define entity fields in the API section.
4. **Error keys** - Every error response SHALL have a machine-readable error key (e.g., "VALIDATION_ERROR") in addition to the HTTP status code.
5. **Auth requirements** - Every endpoint SHALL declare its auth requirements explicitly.
6. **Pagination** - List endpoints returning collections SHALL specify pagination parameters (limit, offset/cursor) and response structure (items, total, next_cursor).

### Organization

Group endpoints by resource/feature area:

```markdown
## 8. API / Interface Design

### 8.1 User Endpoints

#### POST /users
...

#### GET /users/:id
...

### 8.2 Order Endpoints

#### POST /orders
...
```

---

## Companion Artifacts (FR-040, FR-041, FR-028)

After writing Section 8 prose, produce companion artifact files in the `artifacts_dir`.

### api-contracts.<ext>

Produce `api-contracts.<ext>` containing typed request/response definitions for ALL endpoints.

**Critical rule**: Field names and types SHALL match Section 8 prose EXACTLY (FR-041).

**TypeScript example**:
```typescript
// Generated by: spec-api-design skill
// Source spec: .sdd/specs/<NNN>-<idea-name>.spec.md, Section 8
// Target language: TypeScript
// DO NOT EDIT MANUALLY -- regenerated on spec revision

import type { User, UserRole } from "./data-schemas";

// POST /users
export interface CreateUserInput {
  email: string;       // required, max 255, email format
  name: string;        // required, max 100
  role?: UserRole;     // optional, default "user"
}

export type CreateUserResponse = User;

// GET /users
export interface ListUsersQuery {
  limit?: number;      // default 20, max 100
  offset?: number;     // default 0
}

export interface ListUsersResponse {
  items: User[];
  total: number;
  limit: number;
  offset: number;
}
```

**Python example**:
```python
# Generated by: spec-api-design skill
# Source spec: .sdd/specs/<NNN>-<name>.spec.md, Section 8
# Target language: Python
# DO NOT EDIT MANUALLY -- regenerated on spec revision

from dataclasses import dataclass
from typing import Optional, List
from .data_schemas import User, UserRole

@dataclass
class CreateUserInput:
    email: str         # required, max 255, email format
    name: str          # required, max 100
    role: Optional[UserRole] = None  # default "user"

CreateUserResponse = User

@dataclass
class ListUsersQuery:
    limit: int = 20    # max 100
    offset: int = 0

@dataclass
class ListUsersResponse:
    items: List[User]
    total: int
    limit: int
    offset: int
```

### error-catalog.<ext>

Produce `error-catalog.<ext>` containing error code constants with HTTP status codes and message templates.

**TypeScript example**:
```typescript
// Generated by: spec-api-design skill
// Source spec: .sdd/specs/<NNN>-<idea-name>.spec.md, Section 8
// Target language: TypeScript
// DO NOT EDIT MANUALLY -- regenerated on spec revision

export const ErrorCodes = {
  VALIDATION_ERROR: { status: 400, message: "Invalid input" },
  UNAUTHORIZED: { status: 401, message: "Missing or invalid authentication" },
  FORBIDDEN: { status: 403, message: "Insufficient permissions" },
  NOT_FOUND: { status: 404, message: "Resource not found" },
  CONFLICT: { status: 409, message: "Resource conflict" },
  UNPROCESSABLE: { status: 422, message: "Business rule violation" },
  INTERNAL_ERROR: { status: 500, message: "Internal server error" },
} as const;

export type ErrorCode = keyof typeof ErrorCodes;
```

**Critical rule**: Error codes in the catalog SHALL match the error behaviors defined in Section 4 FRs (FR-041).

### interfaces.<ext>

Produce `interfaces.<ext>` containing public interface/service contracts that define the boundaries between components. These are the function signatures, service interfaces, and abstract classes that implementation modules must conform to.

**TypeScript example**:
```typescript
// Generated by: spec-api-design skill
// Source spec: .sdd/specs/<NNN>-<idea-name>.spec.md, Section 8
// Target language: TypeScript
// DO NOT EDIT MANUALLY -- regenerated on spec revision

import type { CreateUserInput, CreateUserResponse, ListUsersQuery, ListUsersResponse } from "./api-contracts";

export interface IUserService {
  createUser(input: CreateUserInput): Promise<CreateUserResponse>;
  listUsers(query: ListUsersQuery): Promise<ListUsersResponse>;
  getUserById(id: string): Promise<CreateUserResponse>;
  deleteUser(id: string): Promise<void>;
}
```

**Python example**:
```python
# Generated by: spec-api-design skill
# Source spec: .sdd/specs/<NNN>-<name>.spec.md, Section 8
# Target language: Python
# DO NOT EDIT MANUALLY -- regenerated on spec revision

from abc import ABC, abstractmethod
from .api_contracts import CreateUserInput, CreateUserResponse, ListUsersQuery, ListUsersResponse

class IUserService(ABC):
    @abstractmethod
    async def create_user(self, input: CreateUserInput) -> CreateUserResponse: ...
    @abstractmethod
    async def list_users(self, query: ListUsersQuery) -> ListUsersResponse: ...
    @abstractmethod
    async def get_user_by_id(self, id: str) -> CreateUserResponse: ...
    @abstractmethod
    async def delete_user(self, id: str) -> None: ...
```

**What goes in `interfaces.<ext>` vs `api-contracts.<ext>`**:
- `api-contracts.<ext>`: Data shapes -- request/response types, query parameter types, DTOs
- `interfaces.<ext>`: Behavioral contracts -- service interfaces, repository interfaces, handler signatures that modules implement

Derive interfaces from Section 8 endpoints: group endpoints by resource/domain, create one interface per group with a method for each endpoint.

### Manifest Comment

Every artifact file SHALL begin with a manifest comment:
```
// Generated by: spec-api-design skill
// Source spec: .sdd/specs/<NNN>-<idea-name>.spec.md, Section 8
// Target language: <language>
// DO NOT EDIT MANUALLY -- regenerated on spec revision
```

Comment syntax: `//` for TypeScript/JavaScript, `#` for Python, `--` for SQL.

---

## Cross-Reference Validation (FR-042)

After completing Section 8 and generating artifacts, perform a cross-reference check against the Data Model (Section 7):

### Field Consistency Check

For each endpoint response schema:
1. Identify the data model entity it references (from Section 7)
2. Verify every field in the response exists in the entity definition
3. Verify field types match exactly (string, number, boolean, enum values)
4. Verify nullability/optionality aligns between API and data model
5. Verify enum values are consistent

### Error Code Consistency Check

For each error code used in Section 8:
1. Verify it has a matching error behavior in Section 4 FRs
2. Verify the HTTP status code is used correctly per RFC 7231

### Handling Mismatches

If any mismatch is found:
```markdown
[CROSS-REF ISSUE: Field "expires_at" in GET /tokens response is not defined in Token entity (Section 7.3)]
[CROSS-REF ISSUE: Field "name" is string(100) in Section 7 but string(255) in POST /users request]
```

Do NOT fix prior sections. The coordinator resolves cross-reference issues after all skills complete.

---

## Quality Checklist

Before finishing, verify your output against these checks:

1. [ ] Every endpoint has method, path, purpose, auth, request, response, errors
2. [ ] Every authenticated endpoint lists at minimum: 400, 401, 403, 500
3. [ ] Every error has a machine-readable error key
4. [ ] Response schemas reference Section 7 entities (not re-defined)
5. [ ] List endpoints include pagination parameters
6. [ ] `api-contracts.<ext>` exists with all request/response types
7. [ ] `error-catalog.<ext>` exists with all error codes
8. [ ] Field names in artifacts match Section 8 prose exactly
9. [ ] All artifact files have manifest comments
10. [ ] Cross-reference validation against Section 7 completed
11. [ ] Cross-reference validation against Section 4 error behaviors completed
12. [ ] No I/O, network, or filesystem code in artifacts
13. [ ] Active patterns from the coordinator prompt have been followed
