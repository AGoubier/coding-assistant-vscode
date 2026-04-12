---
name: spec-security
description: "Produces expanded security requirements with OWASP mitigations"
argument-hint: "Invoked by Spec Architect Coordinator - do not call directly"
---

# spec-security - Security Requirements Skill

This skill is invoked by the Spec Architect Coordinator as a subagent. It EXPANDS Section 10.2 (Security) of the specification with detailed security requirements, OWASP mitigations, and data classification. Section 10 was initially created by the spec-requirements skill with a brief security overview; this skill replaces Section 10.2 with comprehensive security analysis.

## Input Contract

This skill receives the following inputs via the coordinator's subagent prompt:

| # | Input | Description |
|---|-------|-------------|
| 1 | `skill_path` | Path to this SKILL.md file |
| 2 | `accumulator_path` | Path to the spec file being built |
| 3 | `artifacts_dir` | Path to the companion artifacts directory |
| 4 | `brief_path` | Path to the source ideation brief |
| 5 | `research_summary` | Key findings from the research phase |
| 6 | `section_numbers` | `10.2` (expansion, not new section) |
| 7 | `patterns` | Active spec-domain patterns to avoid |
| 8 | `target_language` | Programming language for artifacts (not used by this skill) |

## Execution Sequence

1. **Read this SKILL.md** to load instructions and guidelines
2. **Read the accumulator** at `accumulator_path` to understand sections 1-9 (including data model and architecture)
3. **Read the brief** at `brief_path` for security context. Read accumulator and brief in parallel.
4. **Conduct web research** (MANDATORY - see below)
5. **Expand Section 10.2** in the accumulator by replacing the placeholder with detailed security content
6. **Produce artifacts** - N/A (this skill produces no companion artifacts)

## Constraints

- Do NOT modify sections 1 through 9
- Do NOT modify Section 10.1 (Performance), 10.3-10.5 (Scalability, Accessibility, Observability)
- You MAY replace Section 10.2 content (the placeholder left by spec-requirements)
- If you discover an inconsistency with a prior section, add: `[CROSS-REF ISSUE: <description>]`
- Use plain ASCII only - no em dashes, smart quotes, or curly apostrophes
- Security requirements must be SPECIFIC to this system, not generic boilerplate

---

## Pre-Write Research (MANDATORY) (FR-049)

Before writing Section 10.2, perform web research:

1. **Fetch OWASP Top 10**: Read https://owasp.org/www-project-top-ten/ to identify which categories apply to THIS system
2. **Fetch framework security docs**: Look up security best practices for the framework identified in Section 9.2 (e.g., Express helmet middleware, Django security checklist, FastAPI security documentation)
3. **Identify applicable threats**: Based on the system's data model (Section 7) and API surface (Section 8), determine which OWASP categories are relevant

Use `fetch_webpage` for web research. If URLs are unreachable, proceed with documented OWASP knowledge but note: "[Research note: OWASP URL unreachable, using cached knowledge]".

---

## Section 10.2 - Security (FR-047)

Expand Section 10.2 with ALL of the following subsections:

### 10.2.1 Authentication

```markdown
#### 10.2.1 Authentication

- **Protocol**: <JWT / OAuth2 / session-based / API key>
- **Token format**: <JWT with HS256/RS256, session cookie, etc.>
- **Token expiry**: <access token TTL, e.g., 15 minutes>
- **Refresh mechanism**: <refresh token with longer TTL, or re-authentication>
- **Multi-factor**: <required / optional / not applicable>

**Requirements**:
- The system SHALL [specific auth requirement]
- The system SHALL [specific auth requirement]
```

### 10.2.2 Authorization

```markdown
#### 10.2.2 Authorization

**Model**: <RBAC / ABAC / hybrid>

**Permissions Matrix**:

| Resource | Action | <role1> | <role2> | <role3> |
|----------|--------|---------|---------|---------|
| User | create | yes | no | no |
| User | read (own) | yes | yes | no |
| User | read (any) | yes | no | no |
| User | update (own) | yes | yes | no |
| User | delete | yes | no | no |

**Requirements**:
- The system SHALL enforce role-based access on every endpoint
- The system SHALL deny access by default (allowlist approach)
```

Derive roles from Section 3 (Users & Roles) and Section 8 (API auth requirements).

### 10.2.3 Data Classification

```markdown
#### 10.2.3 Data Classification

| Entity | Field | Classification | Handling |
|--------|-------|---------------|----------|
| User | id | internal | No special handling |
| User | email | confidential | No plaintext logging, encrypted at rest |
| User | password_hash | restricted | Never exposed in API, bcrypt with cost 12+ |
| User | api_key | restricted | Never logged, rotatable, hashed in DB |
```

Classification levels:
- **public**: No restrictions
- **internal**: Not exposed to unauthorized users
- **confidential**: Sensitive data; regulatory handling may apply, encrypted at rest
- **restricted**: Maximum protection; never logged, encrypted at rest and in transit

### 10.2.4 OWASP Top 10 Mitigations

For EACH applicable OWASP category, write a specific mitigation for THIS system:

```markdown
#### 10.2.4 OWASP Top 10 Mitigations

| # | OWASP Category | Applies | Mitigation |
|---|---------------|---------|------------|
| A01 | Broken Access Control | Yes | Enforce RBAC on every endpoint (see 10.2.2). Deny by default. |
| A02 | Cryptographic Failures | Yes | bcrypt for passwords, AES-256 for PII at rest, TLS 1.2+ in transit |
| A03 | Injection | Yes | Parameterized queries via ORM. No raw SQL. Input validation on all endpoints. |
| A04 | Insecure Design | Yes | Spec-driven development with security review at each stage |
| A05 | Security Misconfiguration | Yes | No default credentials. ENV-based config. Disable debug in production. |
| A06 | Vulnerable Components | Yes | Automated dependency scanning (npm audit / pip-audit). Pin versions. |
| A07 | Auth Failures | Yes | Rate limit login attempts. Lock after N failures. |
| A08 | Data Integrity Failures | Partial | Verify dependency integrity (lock files). Signed releases if applicable. |
| A09 | Logging Failures | Yes | Log all auth events. Never log sensitive data. Structured logging. |
| A10 | SSRF | No/Yes | <specific assessment based on system's external integrations> |
```

Do NOT mark all categories as "Yes" reflexively. Assess each based on the actual system design.

### 10.2.5 Per-Component Security

```markdown
#### 10.2.5 Per-Component Security

| Component | Security Responsibility | Key Measures |
|-----------|----------------------|-------------|
| API Server | Auth enforcement, input validation | JWT verification middleware, request schema validation |
| Database | Data protection | Encrypted connections, parameterized queries, least-privilege DB user |
| Cache | Session security | Short TTL, no sensitive data in cache keys |
```

Derive components from Section 9.1.

### 10.2.6 Input Validation Strategy

```markdown
#### 10.2.6 Input Validation Strategy

- **Approach**: <allowlist / denylist>
- **Location**: <centralized middleware / per-endpoint / both>
- **Schema validation**: <library, e.g., Zod, Pydantic, Joi>
- **Requirements**:
  - The system SHALL validate all input against typed schemas before processing
  - The system SHALL reject input that does not match the schema with 400 status
  - The system SHALL sanitize string inputs to prevent XSS
  - The system SHALL enforce max request body size
```

### 10.2.7 Secrets Management

```markdown
#### 10.2.7 Secrets Management

- **Storage**: <environment variables / vault / cloud KMS>
- **Rotation**: <rotation policy for API keys, JWT secrets>
- **Requirements**:
  - The system SHALL NOT store secrets in source code, config files, or logs
  - The system SHALL load secrets from environment variables at startup
  - The system SHALL validate all required secrets are present before starting
  - The system SHALL support secret rotation without downtime
```

---

## Cross-Reference: Data Model Security (FR-048)

After writing Section 10.2, cross-reference against Section 7 (Data Model):

1. **Scan Section 7 entities** for fields containing: passwords, tokens, API keys, email, phone, addresses, SSN, or any PII
2. **For each sensitive field**, verify Section 10.2.3 (Data Classification) includes it with explicit handling rules
3. **Verify handling rules cover**: encryption at rest, masking in logs, access control, API exposure rules
4. **If a sensitive field is missing**, add: `[CROSS-REF ISSUE: Sensitive field <entity>.<field> has no handling rules in Section 10.2.3]`

---

## Quality Checklist

1. [ ] All 7 subsections (10.2.1-10.2.7) are present
2. [ ] Authentication details include protocol, token format, expiry, refresh
3. [ ] Permissions matrix covers all roles from Section 3 and all resources from Section 8
4. [ ] Data classification covers every entity with sensitive fields from Section 7
5. [ ] OWASP Top 10 mitigations are specific to THIS system (not generic)
6. [ ] Per-component security maps to components from Section 9.1
7. [ ] Input validation approach specifies library and location
8. [ ] Secrets management prohibits secrets in code and logs
9. [ ] Cross-reference against Section 7 completed: all sensitive fields have handling rules
10. [ ] Web research was conducted (OWASP + framework security docs)
11. [ ] Active patterns from the coordinator prompt have been followed
