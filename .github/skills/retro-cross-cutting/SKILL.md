---
name: retro-cross-cutting
description: "Extracts error handling patterns, security mechanisms, logging, configuration, and non-functional requirements from legacy code"
argument-hint: "Invoked by Retro-Spec Coordinator - do not call directly"
---

# retro-cross-cutting -- Cross-Cutting Concerns Extraction Skill

This skill is invoked by the Retro-Spec Coordinator as the fifth extraction skill. It analyzes cross-cutting concerns in the legacy codebase: error handling, security, logging, configuration management, and non-functional characteristics. It produces Sections 10 (Non-Functional Requirements), 12 (Constraints & Assumptions), and 13 (Out of Scope), plus the error-catalog artifact.

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
2. **Read discovery manifest**
3. **Read accumulator** for architecture, data model, API, and business logic context
4. **Analyze cross-cutting concerns** in the legacy source code. Use `#tool:search/usages` to trace error handlers, auth middleware, and logging symbols across the codebase.
5. **Write Sections 10, 12, 13** to the accumulator
6. **Produce artifacts**: `error-catalog.<ext>` in the artifacts directory

## Constraints

- NEVER execute legacy code or security scanning tools against it
- NEVER modify legacy source files
- Do NOT write sections other than 10, 12, and 13
- Use `[INFERRED: confidence]` for every NFR
- NEVER reproduce secrets, tokens, or credentials found in code -- cite file and line only

---

## Extraction Procedure

### Step 1: Error Handling Analysis

1. **Global error handlers**: Search for centralized error handling:
   ```
   grep: "errorHandler|error.middleware|exception_handler|@ExceptionHandler|recover|catch|rescue"
   ```

2. **Error class definitions**: Search for custom error types:
   ```
   grep: "extends Error|extends Exception|class.*Error|class.*Exception|errors.New|#\[derive.*Error\]"
   ```

3. **Error response patterns**: Analyze how errors are translated to responses:
   - Status code mapping (which errors map to which HTTP status codes)
   - Error body format (consistent structure? varies by endpoint?)
   - Error codes/keys used (machine-readable identifiers)
   - User-facing messages vs. internal messages

4. **Error propagation**: How errors flow through the system:
   - Are errors wrapped/chained?
   - Are stack traces preserved or stripped?
   - Is there structured logging on error?

5. **Build error catalog**:
   | Error Code | HTTP Status | Message Template | Thrown By | Source |
   |-----------|-------------|------------------|----------|--------|
   | VALIDATION_ERROR | 400 | "Invalid input: {details}" | Validators | <file:line> |
   | NOT_FOUND | 404 | "{entity} not found" | Repositories | <file:line> |

### Step 2: Security Analysis

Analyze security mechanisms WITHOUT executing any code:

1. **Authentication**:
   - Auth middleware/filters: JWT verification, session management, API key validation
   - Token generation and validation logic
   - Password hashing algorithms used (`bcrypt`, `argon2`, `scrypt`, `pbkdf2`)
   - Session configuration (expiry, secure flags, httpOnly)
   ```
   grep: "jwt|jsonwebtoken|passport|bcrypt|argon2|session|cookie|bearer|apiKey|auth"
   ```

2. **Authorization**:
   - Role-based access control implementation
   - Permission checking middleware
   - Resource ownership verification
   - Scope/claim-based access

3. **Input sanitization**:
   - XSS protection (HTML escaping, CSP headers)
   - SQL injection prevention (parameterized queries, ORM usage)
   - Path traversal protection
   - File upload validation

4. **Transport security**:
   - HTTPS enforcement (redirect middleware, HSTS headers)
   - CORS configuration
   - Rate limiting implementation
   - Request size limits

5. **Secrets management**:
   - How secrets are loaded (env vars, secret managers, config files)
   - Are any secrets hardcoded? (cite file:line, do NOT reproduce the value)
   - `.gitignore` patterns for sensitive files

6. **Known vulnerabilities**:
   - Outdated dependencies with known CVEs (check version numbers against knowledge)
   - Insecure patterns (eval, exec, innerHTML, raw SQL string concatenation)
   - Missing security headers

### Step 3: Logging and Observability

1. **Logging framework**: Identify which logger is used:
   ```
   grep: "winston|pino|bunyan|log4j|logback|logging|slog|tracing|log\.Info|logger\."
   ```

2. **Log levels used**: Which levels (debug, info, warn, error) are used where
3. **Structured logging**: Are logs structured (JSON) or unstructured (text)?
4. **Request logging**: Is there HTTP request/response logging middleware?
5. **Health checks**: Health check endpoints (`/health`, `/healthz`, `/ready`, `/live`)
6. **Metrics**: Prometheus, StatsD, CloudWatch, or other metrics collection
7. **Tracing**: Distributed tracing (OpenTelemetry, Jaeger, Zipkin)

### Step 4: Configuration Management

1. **Config sources**: Where configuration comes from:
   - Environment variables
   - Config files (YAML, JSON, TOML, .env)
   - Command-line arguments
   - Remote config services

2. **Config schema**: What config values exist and their types:
   - Read `.env.example`, `config.ts`, `settings.py`, etc.
   - Extract all config keys, default values, and required/optional status

3. **Environment-specific**: Different configs per environment (dev, staging, prod)

4. **Feature flags**: Any feature toggle mechanism

### Step 5: Performance Characteristics

Analyze code for performance-related patterns:

1. **Caching**: Redis, in-memory caches, memoization
2. **Pagination**: How list endpoints handle large datasets
3. **Database optimization**: Indexes, eager/lazy loading, query optimization
4. **Connection pooling**: Database and HTTP connection pool configuration
5. **Async patterns**: Concurrency model, worker threads, async I/O
6. **Rate limiting**: Implementation and thresholds
7. **Timeouts**: HTTP client timeouts, database query timeouts

### Step 6: Dependency and Constraint Analysis

1. **Runtime constraints**: Minimum language/runtime version
2. **External service dependencies**: Third-party APIs, payment providers, email services
3. **Database constraints**: Required database type and minimum version
4. **OS constraints**: Platform-specific code or dependencies
5. **License constraints**: Dependency licenses that impose restrictions

---

## Section 10 Output Format

```markdown
## 10. Non-Functional Requirements

### 10.1 Performance

- **NFR-P01**: The system SHALL respond to API requests within <X>ms at the 95th percentile.
  [INFERRED: LOW] -- No explicit SLA found in code; inferred from timeout configurations.
  Source: <timeout config file:line>

- **NFR-P02**: The system SHALL support pagination with configurable page size (default: <N>, max: <M>).
  [INFERRED: HIGH] Source: <pagination implementation:line>

### 10.2 Security

- **NFR-S01**: The system SHALL authenticate users via <mechanism>.
  [INFERRED: HIGH] Source: <auth middleware:line>

- **NFR-S02**: The system SHALL hash passwords using <algorithm> with <rounds> rounds.
  [INFERRED: HIGH] Source: <password hashing:line>

- **NFR-S03**: The system SHALL enforce CORS with allowed origins: <origins>.
  [INFERRED: HIGH] Source: <CORS config:line>

#### OWASP Mapping

| OWASP Category | Current Implementation | Gap | Source |
|---------------|----------------------|-----|--------|
| A01 Broken Access Control | Role-based middleware on all endpoints | No ABAC | <file:line> |
| A02 Cryptographic Failures | bcrypt for passwords, HTTPS enforced | No data-at-rest encryption | <file:line> |
| A03 Injection | Parameterized queries via ORM | No input sanitization on <field> | <file:line> |

### 10.3 Scalability

- **NFR-SC01**: The system SHALL <scalability characteristic>.
  [INFERRED: confidence] Source: <evidence>

### 10.4 Observability

- **NFR-O01**: The system SHALL log all requests with <log fields>.
  [INFERRED: HIGH] Source: <logging middleware:line>

- **NFR-O02**: The system SHALL expose a health check endpoint at <path>.
  [INFERRED: HIGH] Source: <health route:line>

### 10.5 Configuration

| Config Key | Type | Required | Default | Purpose | Source |
|-----------|------|----------|---------|---------|--------|
| DATABASE_URL | string | yes | - | Database connection | <env file:line> |
| PORT | integer | no | 3000 | Server port | <config file:line> |
```

## Section 12 Output Format

```markdown
## 12. Constraints & Assumptions

### 12.1 Technical Constraints

| # | Constraint | Evidence | Source |
|---|-----------|----------|--------|
| TC-01 | Requires Node.js >= 18 | engines field in package.json | <file:line> |
| TC-02 | PostgreSQL 14+ required | Migration syntax | <file:line> |

### 12.2 Assumptions

| # | Assumption | Confidence | Basis |
|---|-----------|------------|-------|
| A-01 | Single-tenant deployment | [INFERRED: MEDIUM] | No tenant isolation code found |
| A-02 | UTC timezone for all timestamps | [INFERRED: HIGH] | All dates use UTC methods |
```

## Section 13 Output Format

```markdown
## 13. Out of Scope

Items detected in the codebase that appear incomplete, experimental, or disabled:

| # | Item | Evidence | Recommendation |
|---|------|----------|----------------|
| OOS-01 | <feature behind flag> | Feature flag disabled | Include in future phase |
| OOS-02 | <commented-out code> | Commented since <git blame> | Evaluate relevance |
```

---

## Companion Artifact: error-catalog.<ext>

```typescript
// Generated by: retro-cross-cutting skill (retro-spec)
// Source legacy code: <source_path>
// Target language: TypeScript
// Confidence: HIGH
// DO NOT EDIT MANUALLY -- regenerated on retro-spec re-run

export const ErrorCodes = {
  // --- Client Errors (4xx) ---
  VALIDATION_ERROR: { status: 400, message: "Invalid input" },
  UNAUTHORIZED: { status: 401, message: "Authentication required" },
  FORBIDDEN: { status: 403, message: "Insufficient permissions" },
  NOT_FOUND: { status: 404, message: "Resource not found" },
  CONFLICT: { status: 409, message: "Resource conflict" },

  // --- Server Errors (5xx) ---
  INTERNAL_ERROR: { status: 500, message: "Internal server error" },
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

export interface ErrorResponse {
  error: ErrorCode;
  message: string;
  details?: Record<string, string[]>;
}
```
