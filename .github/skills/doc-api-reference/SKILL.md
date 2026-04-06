---
name: doc-api-reference
description: "API reference documentation skill. Produces and updates API endpoint documentation from contract files in .sdd/docs/api-reference.md."
argument-hint: "Invoked by Docs Agent Coordinator - do not call directly"
---

# doc-api-reference - API Reference Documentation Skill

This skill is invoked by the Docs Agent Coordinator as a subagent. It produces and updates `.sdd/docs/api-reference.md` with endpoint documentation generated from contract files. API docs are generated from contract files (`api-contracts.<ext>`, `error-catalog.<ext>`), NOT from prose interpretation. Contract files are the source of truth.

## Input Contract (FR-005)

This skill receives the following 6 inputs via the coordinator's subagent prompt, as defined in `DOC-SKILL-CONTRACT.md`:

| # | Input | Type | Description |
|---|-------|------|-------------|
| 1 | `skill_path` | Path | Path to this SKILL.md file |
| 2 | `wp_path` | Path | Path to the approved WP file and its task list |
| 3 | `spec_path` | Path | Path to the spec file; includes contract files directory (`.sdd/plans/contracts/<WP-slug>/`) |
| 4 | `source_files` | List(Path) | Implementation source files modified by the WP |
| 5 | `docs_dir` | Path | Path to existing documentation directory (`.sdd/docs/`) for incremental updates |
| 6 | `patterns` | Text | Active doc-domain patterns to avoid (from `.sdd/reviews/doc-patterns.md`) |

## Output Contract

| Field | Value |
|-------|-------|
| **Target file** | `.sdd/docs/api-reference.md` |
| **Action** | Create if missing; update incrementally if existing |
| **Content** | One section per API endpoint with method, path, description, request/response schemas, error codes, auth requirements, and examples |

## Execution Sequence (FR-006)

1. **Read SKILL.md** -- Load this file for documentation generation instructions
2. **Read existing docs** -- Read `.sdd/docs/api-reference.md` if it exists to understand current content
3. **Read source material** -- Read contract files (`api-contracts.<ext>`, `error-catalog.<ext>`), WP file, and spec for context
4. **Write documentation** -- Update or create `.sdd/docs/api-reference.md` incrementally (do NOT recreate from scratch)

## Constraints

- Do NOT modify spec files, plan files, contract files, or implementation source files
- Do NOT recreate api-reference.md from scratch on incremental updates -- preserve existing content
- Do NOT generate API docs from spec prose -- contract files are the source of truth (FR-013)
- Use plain ASCII only -- no em dashes, smart quotes, or curly apostrophes
- Follow the canonical section order defined below

---

## Contract File Discovery (FR-013)

Before generating API documentation, discover and validate the contract files for the current WP.

### Discovery Sequence

1. Determine the WP slug from the WP filename (e.g., `WP03-review-spec.md` has slug `review-spec`)
2. Check for a contracts directory at `.sdd/plans/contracts/<WP-slug>/`
3. Scan for these contract file types:
   - `api-contracts.<ext>` -- API endpoint definitions (paths, methods, request/response types)
   - `error-catalog.<ext>` -- Error codes, messages, HTTP status codes
   - `interfaces.<ext>` -- Function/method signatures (may contain endpoint handler signatures)
   - `data-schemas.<ext>` -- Entity/model definitions (referenced by request/response types)
4. The `<ext>` matches the target language (e.g., `.ts`, `.py`, `.go`, `.rs`)

### No Contracts Handling (FR-013 Error)

If no contract files exist for the WP:
1. Log: "No contract files found for WP<NN> in `.sdd/plans/contracts/<WP-slug>/`. Skipping API doc generation."
2. Do NOT fall back to generating API docs from spec prose
3. Do NOT generate placeholder or stub API documentation
4. Exit the skill cleanly with no changes to `api-reference.md`

---

## Contract Parsing by Language

Contract files may use different programming languages depending on the project. The skill must handle the target language's syntax for type and endpoint definitions.

### TypeScript Contracts

Read TypeScript interfaces, types, and endpoint definitions:

```typescript
// api-contracts.ts
export interface CreateUserInput {
  email: string;
  name: string;
  role: "admin" | "user";
}

export interface CreateUserOutput {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  createdAt: string;
}

// Endpoint: POST /api/users
// Input: CreateUserInput
// Output: CreateUserOutput
```

Extract: method (POST), path (/api/users), input type fields, output type fields, field types, union types as enums.

### Python Contracts

Read Python dataclasses, Pydantic models, or typed dicts:

```python
# api_contracts.py
@dataclass
class CreateUserInput:
    email: str
    name: str
    role: Literal["admin", "user"]

@dataclass
class CreateUserOutput:
    id: str
    email: str
    name: str
    role: Literal["admin", "user"]
    created_at: str
```

Extract: class names, field names, types, Literal values as enums, Optional fields.

### Go Contracts

Read Go struct definitions:

```go
// api_contracts.go
type CreateUserInput struct {
    Email string `json:"email"`
    Name  string `json:"name"`
    Role  string `json:"role"` // "admin" | "user"
}
```

Extract: struct names, field names, JSON tags (for API field names), field types.

### Rust Contracts

Read Rust struct definitions with serde:

```rust
// api_contracts.rs
#[derive(Serialize, Deserialize)]
pub struct CreateUserInput {
    pub email: String,
    pub name: String,
    pub role: Role, // enum { Admin, User }
}
```

Extract: struct names, field names, types, enum variants.

---

## Section 1 -- Endpoint Documentation (FR-012.1, FR-012.2, FR-012.3)

Generate one section per API endpoint found in the contract files.

### Instructions

1. Read `api-contracts.<ext>` from the contracts directory
2. For each endpoint defined (identified by method + path comments, route decorators, or type naming conventions):
   a. Extract the HTTP method (GET, POST, PUT, PATCH, DELETE)
   b. Extract the URL path (e.g., `/api/users`, `/api/users/:id`)
   c. Write a brief description of the endpoint's purpose (from type names and spec context)
3. Create a subsection for each endpoint using the format below

### Output Format

```markdown
# API Reference

## POST /api/users

Create a new user account.
```

---

## Section 2 -- Request Parameters and Body (FR-012.4)

Document request parameters and body from contract type definitions.

### Instructions

1. For each endpoint, identify the input/request type from the contract file
2. Extract all fields with their names, types, required/optional status, and constraints
3. Distinguish between:
   - **Path parameters**: Parameters in the URL path (e.g., `:id` in `/users/:id`)
   - **Query parameters**: Parameters passed as query strings
   - **Request body**: JSON body fields from the input type definition
4. For union types or enums, list all valid values

### Output Format

```markdown
### Request

**Body** (`application/json`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email address |
| `name` | string | Yes | User display name |
| `role` | string | Yes | One of: `admin`, `user` |
```

---

## Section 3 -- Response Schema (FR-012.5)

Document response schemas from contract type definitions.

### Instructions

1. For each endpoint, identify the output/response type from the contract file
2. Extract all fields with their names, types, and descriptions
3. Document the success response (typically 200 or 201)
4. Note the response content type (typically `application/json`)

### Output Format

```markdown
### Response

**Success** (`200 OK`):

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique user identifier |
| `email` | string | User email address |
| `name` | string | User display name |
| `role` | string | User role |
| `createdAt` | string | ISO 8601 creation timestamp |
```

---

## Section 4 -- Error Codes (FR-012.6)

Document error codes and meanings from the error catalog contract.

### Instructions

1. Read `error-catalog.<ext>` from the contracts directory
2. For each error code relevant to the endpoint:
   a. Extract the error code identifier
   b. Extract the HTTP status code
   c. Extract the error message or description
3. Group errors by endpoint where possible
4. Include a general errors section for errors that apply across all endpoints (e.g., 401 Unauthorized, 500 Internal Server Error)

### Output Format

```markdown
### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Request body failed validation |
| 404 | `USER_NOT_FOUND` | No user exists with the given ID |
| 409 | `EMAIL_ALREADY_EXISTS` | A user with this email already exists |
```

---

## Section 5 -- Authentication Requirements (FR-012.7)

Document authentication requirements for each endpoint.

### Instructions

1. Read contract files and spec for authentication patterns
2. For each endpoint, document:
   - Whether authentication is required
   - What type of authentication (Bearer token, API key, session cookie, etc.)
   - Required roles or permissions (if role-based access control is defined)
3. If authentication details are not in the contract files, check the spec for security requirements

### Output Format

```markdown
### Authentication

Requires Bearer token in the `Authorization` header. User must have `admin` role.
```

---

## Section 6 -- Example Request/Response (FR-012.8)

Generate example request/response pairs from the contract schemas.

### Instructions

1. For each endpoint, generate a realistic example based on the contract type definitions
2. Use plausible sample data (not "string", "number" -- use actual example values)
3. Include the full HTTP request (method, path, headers, body)
4. Include the full HTTP response (status, headers, body)
5. Examples must be valid JSON and match the contract schema exactly

### Output Format

````markdown
### Example

**Request**:

```http
POST /api/users HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{
  "email": "jane@example.com",
  "name": "Jane Doe",
  "role": "admin"
}
```

**Response**:

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "usr_abc123",
  "email": "jane@example.com",
  "name": "Jane Doe",
  "role": "admin",
  "createdAt": "2026-01-15T10:30:00Z"
}
```
````

---

## Contract-Based Accuracy Rules (FR-013)

API documentation SHALL be generated from contract files, NOT from prose interpretation. These rules enforce that contract files are the single source of truth.

### Source Priority

1. **Primary source**: Contract files (`api-contracts.<ext>`, `error-catalog.<ext>`, `data-schemas.<ext>`, `interfaces.<ext>`)
2. **Context only**: Spec file -- used only to understand the purpose and context of endpoints, NOT to determine field names, types, or structures
3. **NEVER a source**: Prose descriptions, user stories, or acceptance scenarios -- these are informational and must never override contract definitions

### Accuracy Rules

1. **Field names match contracts exactly** -- If the contract defines `createdAt`, the docs use `createdAt`, not `created_at` or `dateCreated`
2. **Types match contracts exactly** -- If the contract defines `email: string`, the docs show type `string`, not `email address` or `varchar`
3. **Required/optional matches contracts** -- If a field has `?` (TypeScript), `Optional` (Python), or `omitempty` (Go), it is optional in the docs
4. **Enum values match contracts** -- If the contract defines `role: "admin" | "user"`, the docs list exactly `admin` and `user`, not additional values
5. **Error codes match error catalog** -- Error identifiers, HTTP status codes, and messages come from `error-catalog.<ext>`, not invented
6. **Endpoint paths match contracts** -- URL paths come from route decorators, comments, or naming conventions in the contract files

### Violation Detection

If a discrepancy is detected between the spec prose and the contract files:
- Always use the contract file's definition
- Add a note: `<!-- Note: spec describes <X> but contract defines <Y>. Using contract definition. -->`
- Do NOT attempt to reconcile or merge the two sources

---

## Incremental Update Protocol (FR-011)

When `api-reference.md` already exists with content from prior work packages:

### Rules

1. **Read before write** -- Always read the existing `api-reference.md` content before making any changes
2. **Identify endpoints by heading** -- Use endpoint headings (e.g., `## POST /api/users`) to locate existing endpoint sections
3. **Update existing endpoints** -- If the current WP modifies an existing endpoint (changes fields, adds parameters), update that endpoint's section in place
4. **Add new endpoints** -- If the current WP adds new endpoints, append new endpoint sections after existing ones
5. **Preserve unmodified endpoints** -- Endpoint sections not affected by the current WP SHALL remain unchanged
6. **Remove deprecated endpoints** -- If the current WP removes an endpoint (marked deprecated in contracts), add a deprecation notice rather than deleting the section

### Incremental Update Sequence

1. Read existing `api-reference.md` into memory
2. Parse into sections by `##` endpoint headings
3. For each endpoint in the current WP's contracts:
   a. If the endpoint exists in the docs, update its section with current contract data
   b. If the endpoint is new, create a new section with all subsections (request, response, errors, auth, example)
4. For endpoints in the docs but not in the current WP's contracts, leave them unchanged
5. Write the updated content back to `api-reference.md`

### Error Handling

- If `api-reference.md` does not exist, create it from scratch with an `# API Reference` heading and all endpoint sections
- If an endpoint section has non-standard formatting, preserve it and add a `<!-- Format note: this section uses non-standard formatting -->` comment

---

## Quality Checklist

Before completing, verify:

- [ ] Every endpoint has method, path, and description (FR-012.1, FR-012.2, FR-012.3)
- [ ] Request parameters/body match contract type definitions exactly (FR-012.4)
- [ ] Response schemas match contract type definitions exactly (FR-012.5)
- [ ] Error codes come from error-catalog contract, not invented (FR-012.6)
- [ ] Authentication requirements are documented per endpoint (FR-012.7)
- [ ] Example request/response pairs are valid JSON matching schemas (FR-012.8)
- [ ] All field names, types, and enum values match contracts exactly (FR-013)
- [ ] No API docs generated from prose -- contracts are the sole source (FR-013)
- [ ] If no contracts exist, skill skipped cleanly with a log message (FR-013 error)
- [ ] Incremental updates preserve prior endpoint documentation (FR-011)
- [ ] No em dashes, smart quotes, or curly apostrophes in output
