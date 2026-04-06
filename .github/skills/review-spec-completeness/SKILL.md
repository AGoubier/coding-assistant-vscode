---
name: review-spec-completeness
description: "Pre-planning spec completeness validation. Checks obligation language, error behaviors, data model depth, API contracts, state machines, traceability, integrations, artifact consistency, and security requirements."
argument-hint: "Invoked by Review Coordinator or Planner pre-check - do not call directly"
---

# review-spec-completeness - Pre-Planning Spec Completeness Validation

This skill validates that a specification is implementation-complete before planning begins (FR-001). It is dispatched by the Review Coordinator as a subagent, or directly by the Planner coordinator during its completeness pre-check.

The skill runs 10 distinct completeness checks against the spec and its companion artifacts, producing structured findings with a PASS/FAIL verdict. Specs that fail the completeness check SHALL NOT proceed to planning decomposition until the Spec Architect resolves the flagged gaps.

**Input contract** (received via subagent prompt):
1. Read this SKILL.md file for review instructions.
2. Read the specification file at the provided path (FR-002).
3. Read companion artifacts at the provided artifacts directory (FR-002).
4. Evaluate each completeness check below against the spec.
5. Produce findings in the standard format (Section 2 below).
6. Return the verdict and finding counts.

**Constraint**: Do NOT modify the spec file, any artifact files, or any WP files. Only produce findings output.

**Error handling**:
- Spec file not found: HALT immediately. Report error: "Spec file not found at `<path>`. Cannot perform completeness review."
- Artifacts directory not found: Do NOT halt. Flag as a HIGH finding (category: artifact-consistency) and continue with all other checks.

---

## 1. Completeness Checks

Run all 10 checks below sequentially against the spec. Each check produces zero or more findings. Finding IDs are sequential across all checks: SPEC-COMP-001, SPEC-COMP-002, etc. No gaps in numbering.

---

### Check 1: Obligation Language (FR-003)

Scan every FR (functional requirement) statement in the spec. Every FR SHALL use "SHALL" or "SHALL NOT" as its obligation language.

**Flag the following words when used as obligation (not permission)**:
- "should"
- "could"
- "might"
- "may" (when used as obligation, e.g., "The system may handle..." -- NOT when used as permission, e.g., "Users may optionally...")
- "can" (when used as obligation, e.g., "The system can process..." -- NOT when describing capability permission)

**Distinguishing obligation from permission**: "may" and "can" are acceptable when granting permission to a user or actor (e.g., "Users may choose to..."). They are NOT acceptable when describing system behavior that is required (e.g., "The system may return..." should be "The system SHALL return...").

**For each violation, produce a finding**:
- **Severity**: HIGH
- **Category**: obligation-language
- **Location**: The FR identifier (e.g., "FR-003")
- **Issue**: "FR-XXX uses '<word>' instead of SHALL/SHALL NOT obligation language"
- **Recommendation**: "Replace '<word>' with 'SHALL' or 'SHALL NOT' to make the requirement unambiguous"

---

### Check 2: Error Behavior (FR-004)

Scan every FR in the spec. Every FR SHALL have defined error behavior -- what happens when the happy path fails.

**Error behavior is typically found as**:
- "Error:" bullets under an FR
- A separate "Error behaviors" subsection
- "If X fails, then Y" statements
- "When X is invalid, the system SHALL..." statements

**For each FR missing error behavior, produce a finding**:
- **Severity**: HIGH
- **Category**: error-behavior
- **Location**: The FR identifier (e.g., "FR-005")
- **Issue**: "FR-XXX has no defined error behavior (no failure path specified)"
- **Recommendation**: "Add error behavior defining what happens when the happy path fails (e.g., invalid input, missing resource, timeout)"

---

### Check 3: Data Model Completeness (FR-005)

Scan every entity in the data model section (typically Section 7). Every entity SHALL have all 5 properties defined for every field:

1. **Explicit type** -- No untyped fields. Every field must declare its type (string, integer, enum, etc.)
2. **Nullability** -- Every field must declare whether it can be null
3. **Constraints** -- Every field must declare any constraints: required, unique, max length, format, min/max
4. **Validation rules** -- Rules beyond basic type constraints (e.g., "email format", "positive integer", "ISO 8601 date")
5. **Default values** -- Either an explicit default value or explicit "no default"

"No default" is acceptable as an explicit declaration. The absence of any default mention is what triggers a finding.

**For each missing property, produce a finding**:
- **Severity**: HIGH
- **Category**: data-model
- **Location**: Entity name and field name (e.g., "User.role")
- **Issue**: "Entity '<entity>' field '<field>' is missing <property>" (e.g., "missing explicit type", "missing nullability declaration")
- **Recommendation**: "Add <property> to the '<field>' field definition in Section 7"

---

### Check 4: API Endpoint Completeness (FR-006)

Scan every API endpoint in the API/interface design section (typically Section 8). Every endpoint SHALL have all 4 properties:

1. **HTTP error codes** -- All applicable error codes from this list with meanings and response bodies: 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 409 (Conflict), 422 (Unprocessable Entity), 500 (Internal Server Error)
2. **Request schema** -- All request fields with types declared
3. **Response schema** -- All response fields with types declared
4. **Auth requirements** -- Authentication/authorization requirements stated

Not every endpoint will use all 7 error codes. The check verifies that all *applicable* codes are present based on the endpoint's HTTP method and semantics:
- GET: 400, 401, 403, 404, 500 are typically applicable
- POST: 400, 401, 403, 409, 422, 500 are typically applicable
- PUT/PATCH: 400, 401, 403, 404, 409, 422, 500 are typically applicable
- DELETE: 401, 403, 404, 500 are typically applicable

For specs without HTTP APIs (e.g., skill-based dispatch with no REST endpoints), this check produces no findings. Note the absence as N/A in the output.

**For each missing property, produce a finding**:
- **Severity**: HIGH
- **Category**: api-contract
- **Location**: Endpoint identifier (e.g., "POST /api/users")
- **Issue**: "Endpoint '<method> <path>' is missing <property>" (e.g., "missing 401 error code definition", "missing request schema")
- **Recommendation**: "Add <property> to the endpoint definition in Section 8"

---

### Check 5: State Machine Completeness (FR-007)

Scan every entity that has a status/state field. State fields are identified by names like "status", "state", "phase", "stage", or enum fields with lifecycle semantics.

For each entity with a state field, it SHALL have all 4 properties:

1. **Valid states** -- All valid states listed as an enum
2. **Transitions** -- All valid transitions defined (from-state, to-state)
3. **Guards** -- Guards/conditions on each transition
4. **Side effects** -- Side effects per transition

If no state fields exist in the spec, no findings are produced for this category.

**For each missing property, produce a finding**:
- **Severity**: MEDIUM
- **Category**: state-machine
- **Location**: Entity name and state field (e.g., "Order.status")
- **Issue**: "Entity '<entity>' state field '<field>' is missing <property>"
- **Recommendation**: "Add <property> to the state machine definition for '<entity>'"

---

### Check 6: Traceability Matrix (FR-008)

Scan the traceability matrix (typically Section 16). The matrix SHALL have no empty cells:

1. Every FR maps to at least one US (User Story)
2. Every US maps to at least one acceptance scenario
3. Every acceptance scenario maps to at least one test type
4. Every test type maps to a test section reference

Check each row of the traceability matrix. Any cell that is empty or contains only whitespace is a gap.

If Section 16 (or equivalent traceability section) does not exist, produce a single HIGH finding for the missing section.

**For each empty cell, produce a finding**:
- **Severity**: HIGH
- **Category**: traceability
- **Location**: The FR identifier and the empty column (e.g., "FR-012, User Story column")
- **Issue**: "Traceability matrix row for FR-XXX has empty '<column>' cell"
- **Recommendation**: "Fill in the '<column>' mapping for FR-XXX in Section 16"

---

### Check 7: Ambiguity Detection (FR-010)

Scan all FR and NFR text (not prose descriptions, not examples, not commentary -- only the requirement statements themselves). Flag any occurrence of these ambiguous terms:

- "appropriate"
- "reasonable"
- "as needed"
- "etc."
- "similar"
- "relevant"

**Scope**: Only FR-XXX and NFR-XXX statement text. Do NOT scan section headings, commentary, examples, or rationale text.

**For each occurrence, produce a finding**:
- **Severity**: MEDIUM
- **Category**: ambiguity
- **Location**: The requirement identifier (e.g., "FR-005", "NFR-002")
- **Issue**: "Requirement <id> uses ambiguous term '<term>'"
- **Recommendation**: "Replace '<term>' with a specific, measurable, unambiguous statement"

---

### Check 8: Integration Strategy (FR-009)

Scan the external integrations section (typically Section 9.5). Every external integration SHALL have:

1. **Timeout value** -- Explicit timeout duration
2. **Retry strategy** -- How retries are handled (count, backoff)
3. **Fallback behavior** -- What happens when the integration is unavailable
4. **Circuit breaker threshold** -- If applicable (high-volume, critical path integrations)

If no external integrations section exists, or the spec has no external dependencies, this check produces no findings. Note the absence as N/A.

Circuit breaker is "if applicable" -- only flag if the integration pattern warrants it (high-volume, critical path).

**For each missing item, produce a finding**:
- **Severity**: MEDIUM
- **Category**: integration
- **Location**: Integration name (e.g., "GitHub API integration")
- **Issue**: "Integration '<name>' is missing <property>"
- **Recommendation**: "Add <property> to the integration definition in Section 9.5"

---

### Check 9: Artifact Consistency (FR-011)

Verify that companion artifact files exist in `.sdd/specs/artifacts/<spec-slug>/` and are consistent with the prose spec:

1. **Data model artifacts** -- Every entity in Section 7 has a corresponding type definition in `data-models.<ext>`
2. **API contract artifacts** -- Every API endpoint in Section 8 has corresponding request/response types in `api-contracts.<ext>`
3. **Error catalog artifacts** -- Every error code in Section 4 has a corresponding entry in `error-catalog.<ext>`
4. **Field name and type match** -- Field names are identical (case-sensitive) and types match semantically between prose and artifacts

Artifact files use language-appropriate extensions: `.ts` for TypeScript, `.py` for Python, etc.

If the artifacts directory does not exist, produce a HIGH finding for the missing directory but do NOT halt -- continue with all other checks.

Not all specs will have all artifact types. Flag what is missing but defined in the prose.

**For each missing or inconsistent artifact, produce a finding**:
- **Severity**: HIGH
- **Category**: artifact-consistency
- **Location**: Entity, endpoint, or error code identifier
- **Issue**: "Entity/endpoint/error '<name>' in prose has no corresponding artifact definition" or "Field '<field>' type mismatch: prose says '<prose_type>', artifact says '<artifact_type>'"
- **Recommendation**: "Add or update the artifact file to match the prose spec" or "Align the field type between prose and artifact"

---

### Check 10: Security Requirements (FR-012)

Scan the security requirements section (typically Section 10.2). The security requirements SHALL include:

1. **Per-component security requirements** -- Each major module/service has its own security considerations, not just a blanket "follow OWASP" statement
2. **OWASP mitigation references** -- Specific OWASP mitigation references are cited
3. **Data sensitivity classification** -- Per-entity data sensitivity classification exists (e.g., PII, confidential, public)

If the spec has minimal security needs (e.g., local-only tools with no network access, no user data), the section may legitimately be brief. Use judgment -- a single line saying "No special security requirements" is acceptable for truly non-security-relevant specs. Flag it only when security is relevant but inadequately addressed.

**For each missing item, produce a finding**:
- **Severity**: MEDIUM
- **Category**: security
- **Location**: "Section 10.2" or the security section identifier
- **Issue**: "Security requirements are missing <property>"
- **Recommendation**: "Add <property> to the security requirements section"

---

## 2. Finding Output Format (FR-013)

Every finding SHALL use this exact format:

```
### Finding: SPEC-COMP-XXX
- **Severity**: HIGH | MEDIUM | LOW
- **Category**: obligation-language | error-behavior | data-model | api-contract | state-machine | traceability | integration | ambiguity | artifact-consistency | security
- **Location**: Section N, FR-XXX or entity name
- **Issue**: Description of what is missing or incorrect (1-500 chars)
- **Recommendation**: Specific action to fix (1-500 chars)
```

**Finding ID rules**:
- Prefix: `SPEC-COMP-`
- Numbering: Sequential starting at 001, no gaps (SPEC-COMP-001, SPEC-COMP-002, ...)
- Numbering continues across all checks (check 1 findings, then check 2 findings, etc.)

**Field constraints**:
- `issue`: 1-500 characters. Concise description of the gap.
- `recommendation`: 1-500 characters. Specific, actionable fix.

**Valid categories** (exactly 10):
1. `obligation-language`
2. `error-behavior`
3. `data-model`
4. `api-contract`
5. `state-machine`
6. `traceability`
7. `integration`
8. `ambiguity`
9. `artifact-consistency`
10. `security`

---

## 3. Verdict (FR-014)

After all 10 checks complete, produce a verdict:

- **PASS**: Zero HIGH findings. The spec is implementation-ready. Planning may proceed.
- **FAIL**: One or more HIGH findings. The spec needs revision before planning.

Include finding counts by severity:

```
## Verdict

**Result**: PASS | FAIL
- HIGH findings: <high_count>
- MEDIUM findings: <medium_count>
- LOW findings: <low_count>
- Total findings: <total>
```

---

## 4. Output Structure

Produce the full output in this order:

```markdown
# review-spec-completeness Findings

## Summary

Spec: <spec_path>
Artifacts: <artifacts_dir>
Checks performed: 10
Total findings: <count>

## Findings

### Finding: SPEC-COMP-001
...

### Finding: SPEC-COMP-002
...

(all findings in sequential order)

## Checks with No Findings

- <Check name>: No issues found
- <Check name>: N/A (no external integrations in this spec)

## Verdict

**Result**: PASS | FAIL
- HIGH findings: <high_count>
- MEDIUM findings: <medium_count>
- LOW findings: <low_count>
- Total findings: <total>
```

If a check produces no findings, list it in the "Checks with No Findings" section with either "No issues found" or "N/A" with a brief justification.
