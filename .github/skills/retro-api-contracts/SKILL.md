---
name: retro-api-contracts
description: "Extracts API endpoints, function signatures, public interfaces, and type contracts from legacy code"
argument-hint: "Invoked by Retro-Spec Coordinator - do not call directly"
---

# retro-api-contracts -- API & Interface Extraction Skill

This skill is invoked by the Retro-Spec Coordinator as the third extraction skill. It analyzes the legacy codebase to extract all public APIs (HTTP endpoints, GraphQL operations, CLI commands, RPC definitions) and public function/class interfaces, producing Section 8 (API / Interface Design) and companion artifacts.

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
2. **Read discovery manifest** for entry points and framework info
3. **Read accumulator** for architecture (Section 9) and data model (Section 7) context
4. **Analyze APIs and interfaces** in the legacy source code. Use `#tool:search/usages` to trace API handler references and `#tool:search/searchSubagent` for broad endpoint discovery.
5. **Write Section 8** to the accumulator
6. **Produce artifacts**: `api-contracts.<ext>` and `interfaces.<ext>` in the artifacts directory

## Constraints

- NEVER execute or call any API endpoints -- analysis is purely static
- NEVER modify legacy source files
- Do NOT write sections other than Section 8
- Use `[INFERRED: confidence]` for every endpoint and interface
- Reference data model entities from Section 7 in response schemas (do not re-define)

---

## Extraction Procedure

### Step 1: API Framework Detection

Based on the discovery manifest's framework field, use the appropriate extraction strategy:

| Framework | Route Registration Pattern |
|-----------|--------------------------|
| **Express.js** | `app.get\|post\|put\|patch\|delete\(`, `router.get\|post\|...` |
| **Fastify** | `fastify.get\|post\|...`, route schema objects |
| **Koa** | `router.get\|post\|...` |
| **NestJS** | `@Get\|@Post\|@Put\|@Delete\|@Patch`, `@Controller` |
| **Django** | `path\(`, `url\(`, `@api_view`, viewset registration |
| **Django REST** | `@action`, `ViewSet`, `Serializer`, router registration |
| **FastAPI** | `@app.get\|post\|...`, `@router.get\|post\|...`, Pydantic models |
| **Flask** | `@app.route`, `@blueprint.route` |
| **Spring** | `@GetMapping\|@PostMapping\|@RequestMapping` |
| **ASP.NET** | `[HttpGet]\|[HttpPost]\|[Route]`, controller conventions |
| **Gin/Echo/Fiber (Go)** | `r.GET\|POST\|...`, `e.GET\|POST\|...` |
| **Actix/Axum (Rust)** | `web::get\|post\|...`, handler functions |
| **GraphQL** | `type Query`, `type Mutation`, `@Resolver` |
| **gRPC** | `.proto` service definitions |
| **CLI** | `commander`, `argparse`, `cobra`, `clap` command definitions |

### Step 2: HTTP Endpoint Extraction

For each identified route:

1. **Read the route registration** to extract:
   - HTTP method (GET, POST, PUT, PATCH, DELETE)
   - URL path with parameters (`:id`, `{id}`, `<int:id>`)
   - Middleware chain (auth, validation, rate limiting)

2. **Read the handler function** to extract:
   - Request body parsing (what fields are read from the body)
   - Query parameter usage
   - Path parameter usage
   - Header requirements (Authorization, Content-Type, custom headers)

3. **Read response construction** to extract:
   - Success response status code and body shape
   - Error response patterns (try/catch, error middleware)
   - Response headers set

4. **Read middleware** to extract:
   - Authentication requirements (JWT verification, session check, API key)
   - Authorization checks (role-based, permission-based)
   - Input validation (schema validation middleware)
   - Rate limiting configuration

5. **Read error handling** to extract:
   - Error types thrown/returned
   - HTTP status codes used for different error conditions
   - Error response body format

### Step 3: Public Interface Extraction

For each module identified in Section 9:

1. **Identify exported symbols**:
   - `export` / `module.exports` (Node.js)
   - `__all__` / public functions without `_` prefix (Python)
   - Exported types/functions (Go -- capitalized names)
   - `pub` visibility (Rust)
   - `public` access modifier (Java, C#)

2. **For each exported function/method**:
   - Extract function name
   - Extract parameter names, types, and default values
   - Extract return type
   - Extract thrown/returned error types
   - Extract JSDoc/docstring/doc comments for documentation
   - Note whether async/sync

3. **For each exported class**:
   - Constructor parameters
   - Public methods (with full signatures)
   - Public properties
   - Implemented interfaces
   - Inheritance chain

4. **For each exported type/interface**:
   - All fields with types
   - Generic type parameters
   - Extended/inherited types

### Step 4: OpenAPI/Swagger Extraction

If OpenAPI or Swagger specs exist:

1. Read `openapi.yaml`, `openapi.json`, `swagger.yaml`, or `swagger.json`
2. Extract endpoints, request/response schemas, and error definitions
3. Cross-reference with code-extracted endpoints to validate accuracy
4. Mark OpenAPI-derived data as `[INFERRED: HIGH]` (it is documentation, not just code)
5. Note any discrepancies between OpenAPI spec and actual code: `[DISCREPANCY: openapi says X, code does Y]`

### Step 5: GraphQL Schema Extraction

If GraphQL is detected:

1. Read `.graphql`/`.gql` schema files
2. Extract Query, Mutation, Subscription types
3. Extract input types and custom scalar types
4. Read resolvers to map operations to implementation
5. Extract field-level authorization directives

### Step 6: CLI Interface Extraction

If CLI commands are detected:

1. Read command definitions (commander, argparse, cobra, clap)
2. Extract command names, subcommands, flags, arguments
3. Extract help text and descriptions
4. Map commands to handler functions

---

## Section 8 Output Format

```markdown
## 8. API / Interface Design

### 8.1 HTTP API Endpoints

#### 8.1.1 GET /api/users

**Purpose**: List all users
[INFERRED: HIGH] Source: <routes file:line>

**Auth**: Bearer token required, role: admin
[INFERRED: MEDIUM] Source: <middleware file:line>

**Request**:
- **Query Parameters**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | page | integer | no | 1 | Page number |
  | limit | integer | no | 20 | Items per page |

**Response** (200):
- **Body**: `User[]` (see Section 7.1)

**Errors**:
| Code | Error Key | Meaning | Source |
|------|-----------|---------|--------|
| 401 | UNAUTHORIZED | Missing auth token | <middleware:line> |
| 403 | FORBIDDEN | Insufficient role | <auth check:line> |
| 500 | INTERNAL_ERROR | Unhandled exception | <error handler:line> |

**Rate limit**: <extracted or "Not detected">
[INFERRED: confidence]

---

### 8.2 Public Module Interfaces

#### 8.2.1 UserService

Source: <file:line>
[INFERRED: HIGH]

| Method | Parameters | Return Type | Throws | Async | Description |
|--------|-----------|-------------|--------|-------|-------------|
| createUser | (data: CreateUserInput) | User | ValidationError, ConflictError | yes | Creates a new user |
| findById | (id: string) | User \| null | - | yes | Finds user by ID |

(Include interfaces for all public-facing modules)
```

---

## Companion Artifacts

### api-contracts.<ext>

```typescript
// Generated by: retro-api-contracts skill (retro-spec)
// Source legacy code: <source_path>
// Target language: TypeScript
// Confidence: HIGH
// DO NOT EDIT MANUALLY -- regenerated on retro-spec re-run

// --- Request/Response Types ---

export interface ListUsersQuery {
  page?: number;    // default: 1
  limit?: number;   // default: 20, max: 100
}

export interface ListUsersResponse {
  items: User[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateUserRequest {
  email: string;    // required, email format, max 255
  name: string;     // required, max 100
  role?: UserRole;  // default: "member"
}

// --- Error Types ---

export interface ApiError {
  error: string;          // machine-readable error key
  message?: string;       // human-readable description
  details?: unknown[];    // field-level validation errors
}

// --- Endpoint Definitions ---

export type Endpoints = {
  "GET /api/users": { query: ListUsersQuery; response: ListUsersResponse };
  "POST /api/users": { body: CreateUserRequest; response: User };
  "GET /api/users/:id": { params: { id: string }; response: User };
  "PUT /api/users/:id": { params: { id: string }; body: UpdateUserRequest; response: User };
  "DELETE /api/users/:id": { params: { id: string }; response: void };
};
```

### interfaces.<ext>

```typescript
// Generated by: retro-api-contracts skill (retro-spec)
// Source legacy code: <source_path>
// Target language: TypeScript
// Confidence: HIGH
// DO NOT EDIT MANUALLY -- regenerated on retro-spec re-run

export interface IUserService {
  createUser(data: CreateUserRequest): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  updateUser(id: string, data: UpdateUserRequest): Promise<User>;
  deleteUser(id: string): Promise<void>;
  listUsers(query: ListUsersQuery): Promise<ListUsersResponse>;
}

export interface IUserRepository {
  create(data: Partial<User>): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(id: string, data: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
  findAll(options: { page: number; limit: number }): Promise<{ items: User[]; total: number }>;
}
```
