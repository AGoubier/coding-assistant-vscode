---
name: review-spec
description: "Spec adherence review skill. Evaluates implementation against functional requirements, success criteria, and acceptance scenarios from the specification. Verifies SHALL obligations, preconditions, postconditions, error paths, edge cases, data models, and API contracts."
argument-hint: "Invoked by Review Coordinator - do not call directly"
---

# review-spec - Spec Adherence Review Skill

This skill is invoked by the Review Coordinator as a subagent. It receives a WP identifier and spec path, discovers and reads all implementation code relevant to the WP, evaluates each functional requirement against the code, and writes structured findings to the specified output path.

**Input contract** (received via subagent prompt):
1. Read this SKILL.md file for review instructions.
2. Read the specification file to extract functional requirements.
3. Read the WP file to identify what was implemented and scope the review.
4. Discover and read all implementation code relevant to this WP. Use `#tool:search/usages` to trace contract symbol implementations and `#tool:search/changes` or `#tool:search/searchSubagent` to find files modified by this WP. Use `#tool:read/problems` to check for compile and lint errors in implementation files.
5. Evaluate each checklist item below against the discovered code.
6. Write structured findings to the specified output path.
7. Return a brief summary (counts of PASS/WARN/FAIL/N/A).

**Constraint**: Do NOT modify any source code, the WP file, or the spec file. Only write to the specified output path.

---

## 1. Identify In-Scope FRs

1. Read the WP file and locate the `Spec References` section.
2. For each spec section referenced, identify the functional requirements (FR-XXX) that fall within those sections.
3. Also read the WP's task descriptions to identify any additional FRs mentioned.
4. Build a list of all FRs that this WP is responsible for implementing.

---

## 2. FR Classification Checklist

For each in-scope FR, classify implementation adherence as one of:

| Classification | Definition | Severity |
|---------------|------------|----------|
| **Compliant** | The FR is fully implemented exactly as specified. All obligations, preconditions, postconditions, and error paths are satisfied. | PASS |
| **Partial** | Some aspects of the FR are implemented but others are missing or incomplete. | FAIL |
| **Deviating** | The FR is implemented but behaves differently from the specification. | FAIL |
| **Missing** | The FR is not implemented at all. | FAIL |

### Detailed verification per FR

For each FR, check all of the following:

1. **SHALL/SHALL NOT obligation**: Is the exact obligation stated in the FR satisfied? Look for the specific behavior described.
2. **Preconditions enforced**: Are the preconditions listed in the FR checked before the main logic executes?
3. **Postconditions produced**: Does the code produce the outputs/state changes described as postconditions?
4. **Error paths handled**: Are all error conditions listed in the FR (under "Error:" bullets) handled with the specified behavior?
5. **Edge cases covered**: Are edge cases from the spec's acceptance scenarios (Section 5, Section 11.2) addressed in the implementation?
6. **Data model match**: Do data model fields, types, and validation rules match the spec's Section 7?
7. **API contract match**: Do API request/response schemas match the spec's Section 8?
8. **Error codes match**: Do returned error codes match the spec's error taxonomy?

For each checklist item that fails, cite the specific evidence: the code that deviates, the spec text that defines the expected behavior, and the file/line where the deviation occurs.

---

## 3. Stub Detection

The following patterns indicate stub implementations. Classify these as **Missing** (not Partial):

- `pass` as the sole statement in a function body (Python)
- `raise NotImplementedError` or `raise NotImplementedError(...)` (Python)
- `...` (ellipsis) as function body (Python)
- `# TODO`, `# FIXME`, `# HACK` as the only meaningful content in a function
- Empty function bodies: `{}` with no logic (JavaScript/TypeScript)
- `throw new Error("Not implemented")` or similar placeholder throws
- Any function body with fewer than 3 meaningful lines (excluding comments and whitespace) that does not perform the FR's specified behavior

When a stub is detected:
- Classification: **Missing**
- Finding severity: **FAIL**
- Evidence: show the stub code and the FR it should implement

---

## 4. Success Criteria Verification

For each success criterion (SC-XXX) referenced by the WP:

1. **Locate evidence**: Look for passing tests, observable behavior, or measurable metrics that demonstrate the SC is met.
2. **Verify evidence is genuine**: Confirm the claimed test file actually exists and its assertions are not vacuous (no `assert True`, no empty test bodies, no fully mocked subjects).
3. **Handle unverifiable SCs**: If an SC cannot be verified at this stage (e.g., requires runtime behavior not yet available), document it as N/A with justification: "Deferred verification: <reason>".

| Evidence status | Severity |
|----------------|----------|
| Genuine evidence exists | PASS |
| Evidence is fabricated (test does not exist or is vacuous) | FAIL |
| No evidence provided for a verifiable SC | FAIL |
| SC cannot be verified at this stage | N/A (with justification) |

---

## 5. Severity Rules

| Finding type | Severity | Notes |
|-------------|----------|-------|
| FR classified as Compliant | PASS | All 8 checklist items verified |
| FR classified as Partial | FAIL | List which items are missing |
| FR classified as Deviating | FAIL | Describe the deviation |
| FR classified as Missing | FAIL | Note if stub detected |
| SC-XXX with genuine evidence | PASS | |
| SC-XXX with missing/fabricated evidence | FAIL | |
| SC-XXX not verifiable at this stage | N/A | Include justification |
| FR not applicable to this WP | N/A | Include justification |

**There is no WARN level for spec adherence.** Spec compliance is binary: either the requirement is fully met or it is not.

Every N/A finding MUST include a justification field explaining why the item does not apply. Do NOT produce findings for checklist items that are not applicable -- record them as N/A with justification instead.

---

## 6. Output Format

Write findings to the specified output path using this exact format:

### YAML Frontmatter

```yaml
---
skill: review-spec
wp: <WP-id>
spec: <spec_path>
reviewed_at: <ISO 8601 timestamp>
status: completed
finding_counts:
  pass: <count>
  warn: 0
  fail: <count>
  na: <count>
files_reviewed:
  - <file1>
  - <file2>
---
```

### Findings Body

```markdown
# review-spec Findings for <WP-id>

## Summary

<Brief overview of scope and overall assessment. List total FRs evaluated, how many Compliant vs Partial/Deviating/Missing.>

## Findings

### SPEC-001 [PASS]
- **Checklist item**: FR classification - SHALL obligation
- **Requirement**: FR-001
- **File**: <file_path>
- **Description**: <What was verified and found correct>

### SPEC-002 [FAIL]
- **Checklist item**: FR classification - SHALL obligation
- **Requirement**: FR-012
- **File**: <file_path>#L<start>-L<end>
- **Description**: <What was found wrong or missing>
- **Expected**: <What the spec requires>
- **Evidence**:
  ```
  <code snippet showing the deviation>
  ```

### SPEC-003 [N/A]
- **Checklist item**: API contract match
- **Justification**: No API endpoints in this WP - all artifacts are markdown files.
```

### Rules

- Finding IDs use prefix `SPEC-` and are sequential: SPEC-001, SPEC-002, etc. No gaps.
- Every FAIL finding MUST include: Checklist item, Requirement, File (with line range), Description, Expected, Evidence.
- Every PASS finding MUST include: Checklist item, Requirement, File, Description.
- Every N/A finding MUST include: Checklist item, Justification.
- `finding_counts` MUST accurately reflect the actual findings in the file.
- `files_reviewed` MUST list every file that was read and evaluated during this review.
- `warn` count is always 0 for this skill (spec adherence has no WARN level).

---

## 7. Contract-Aware Review

After completing all prose-based checks (Sections 1-6 above), check whether formal contract files exist for the work package. Contract-aware checks are additive -- they run AFTER prose-based checks and produce additional findings that are combined into one unified output.

### 7.1 Discover Contract Files

1. Determine the WP slug from the WP filename (e.g., `WP03-review-spec.md` has slug `review-spec`).
2. Check for a contracts directory at `.sdd/plans/contracts/<WP-slug>/`.
3. If the contracts directory exists, scan for these contract file types:
   - `interfaces.<ext>` -- function/method signatures
   - `data-schemas.<ext>` -- entity/model definitions
   - `api-contracts.<ext>` -- API endpoint definitions
   - `state-machines.<ext>` -- state enums and transitions
   - `error-catalog.<ext>` -- error codes and messages
4. The `<ext>` matches the target language (e.g., `.ts`, `.py`, `.go`).
5. If the contracts directory does not exist or contains no contract files, fall back to prose-only review (see Section 13).

### 7.2 Contract File Loading

For each contract file found:

1. Read the file contents in full.
2. If the file has syntax errors (cannot be parsed as valid source in its language), flag a HIGH finding:
   ```
   ### Finding: SPEC-CONTRACT-XXX [FAIL]
   - **Severity**: HIGH
   - **Category**: <contract-type>-mismatch
   - **Contract file**: <path>
   - **Issue**: Contract file has syntax errors and cannot be parsed
   - **Recommendation**: Fix syntax errors in the contract file before review
   ```
   Skip all contract checks for that file and continue with remaining contract files.
3. If the file is empty, treat it the same as a syntax error (HIGH finding, skip checks for that file).

---

## 8. Interface Contract Check

Compare every public function/method signature in the implementation against `interfaces.<ext>`. This check validates FR-016.1 and FR-017.

### 8.1 Scope

- Only public/exported functions are checked. Private/internal functions are excluded:
  - Python: functions prefixed with `_` are excluded
  - TypeScript/JavaScript: functions not exported are excluded
  - Go: unexported functions (lowercase first letter) are excluded
- Every function/method defined in `interfaces.<ext>` MUST have a corresponding implementation.

### 8.2 Token-Level Comparison

For each function/method in `interfaces.<ext>`, compare against the implementation:

| Token | Comparison | Example |
|-------|-----------|---------|
| Function/method name | Exact match | `createUser` not `addUser` |
| Parameter names | Exact match, in order | `input` not `data` |
| Parameter types | Exact match, including generics and nullability | `CreateUserInput` not `UserInput`, `string \| null` not `string` |
| Return type | Exact match, including generics and nullability | `Promise<User>` not `Promise<any>` |

### 8.3 Findings

- **Missing function**: A function defined in the contract but absent from the implementation is a HIGH finding (category: `interface-mismatch`).
- **Name mismatch**: A function name that differs between contract and implementation is a HIGH finding.
- **Parameter name mismatch**: A parameter name that differs is a HIGH finding.
- **Parameter type mismatch**: A parameter type that differs is a HIGH finding.
- **Return type mismatch**: A return type that differs is a HIGH finding.
- **Extra public function**: A public function in the implementation that is NOT in the contract is a MEDIUM finding.

---

## 9. Data Schema Contract Check

Compare every entity/model class in the implementation against `data-schemas.<ext>`. This check validates FR-016.2 and FR-017.

### 9.1 Scope

- Every entity/model defined in `data-schemas.<ext>` MUST have a corresponding implementation.
- Compare field-by-field within each entity.

### 9.2 Token-Level Comparison

For each entity in `data-schemas.<ext>`, compare against the implementation:

| Token | Comparison | Example |
|-------|-----------|---------|
| Entity/class name | Exact match (case-sensitive) | `User` not `UserModel` |
| Field names | Exact match (case-sensitive) | `email` not `emailAddress` |
| Field types | Exact match, including generics and nullability | `string` not `string \| undefined` |
| Constraints | Match if specified in contract | `required`, `unique`, `maxLength` |
| Defaults | Match if specified in contract | `status = 'active'` |

### 9.3 Findings

- **Missing entity**: An entity defined in the contract but absent from the implementation is a HIGH finding (category: `schema-mismatch`).
- **Missing field**: A field present in the contract but absent in the implementation is a HIGH finding.
- **Extra field**: A field present in the implementation but absent from the contract is a MEDIUM finding (may be a computed/derived field).
- **Field name mismatch**: A field name that differs is a HIGH finding.
- **Field type mismatch**: A field type that differs is a HIGH finding.

---

## 10. API Contract Check

Compare every API endpoint in the implementation against `api-contracts.<ext>`. This check validates FR-016.3 and FR-017.

### 10.1 Scope

- Every endpoint defined in `api-contracts.<ext>` MUST have a corresponding implementation.
- Compare: HTTP method, URL path, request schema, response schema, and error responses.

### 10.2 Token-Level Comparison

For each endpoint in `api-contracts.<ext>`, compare against the implementation:

| Token | Comparison | Example |
|-------|-----------|---------|
| HTTP method | Exact match | `POST` not `PUT` |
| URL path | Exact match | `/api/users` not `/users` |
| Request body fields | Exact match per field (names and types) | Field `name: string` not `fullName: string` |
| Response body fields | Exact match per field (names and types) | Field `id: string` not `userId: string` |
| Error response codes | All error codes from contract must be handled | `400`, `401`, `404` each present |

### 10.3 Findings

- **Missing endpoint**: An endpoint defined in the contract but absent from the implementation is a HIGH finding (category: `api-mismatch`).
- **Method mismatch**: A different HTTP method is a HIGH finding.
- **Path mismatch**: A different URL path is a HIGH finding.
- **Request schema mismatch**: Request body fields that differ are HIGH findings.
- **Response schema mismatch**: Response body fields that differ are HIGH findings.
- **Missing error response**: An error response in the contract but not handled in the implementation is a HIGH finding.

---

## 11. State Machine Contract Check

Compare every state transition in the implementation against `state-machines.<ext>`. This check validates FR-016.4 and FR-017.

### 11.1 Scope

- Every state enum and transition defined in `state-machines.<ext>` MUST have a corresponding implementation.
- The implementation SHALL NOT allow transitions not defined in the contract.

### 11.2 Token-Level Comparison

For each state machine in `state-machines.<ext>`, compare against the implementation:

| Token | Comparison | Example |
|-------|-----------|---------|
| State enum values | Exact match | `'active'` not `'ACTIVE'` |
| Valid transitions | Every from->to pair in contract must exist in implementation | `pending -> active` |
| Guards | Guard conditions from contract must be enforced | `isEmailVerified` check present |
| Invalid transitions | Implementation must NOT allow transitions absent from contract | No `active -> pending` if not in contract |

### 11.3 Findings

- **Missing state**: A state defined in the contract but absent from the implementation is a HIGH finding (category: `state-mismatch`).
- **Extra state**: A state in the implementation but absent from the contract is a HIGH finding.
- **Missing transition**: A valid transition from the contract not implemented is a HIGH finding.
- **Extra transition**: A transition allowed by the implementation but not in the contract is a HIGH finding.
- **Missing guard**: A guard condition from the contract not enforced in the implementation is a HIGH finding.

---

## 12. Error Catalog Contract Check

Compare every error code and message in the implementation against `error-catalog.<ext>`. This check validates FR-016.5 and FR-017.

### 12.1 Scope

- Every error code defined in `error-catalog.<ext>` MUST be handled in the implementation.
- Error codes, HTTP status codes, and message templates must match exactly.

### 12.2 Token-Level Comparison

For each error in `error-catalog.<ext>`, compare against the implementation:

| Token | Comparison | Example |
|-------|-----------|---------|
| Error code string | Exact match | `'USR-001'` not `'USER-001'` |
| HTTP status code | Exact match | `404` not `400` |
| Message template | Exact match | `'User not found'` not `'No user found'` |

### 12.3 Findings

- **Missing error code**: An error code in the contract but not handled in the implementation is a HIGH finding (category: `error-mismatch`).
- **Error code mismatch**: An error code string that differs is a HIGH finding.
- **HTTP status mismatch**: An HTTP status code that differs is a HIGH finding.
- **Message mismatch**: A message template that differs is a HIGH finding.

---

## 13. Fallback to Prose-Only Review

If contract files do not exist for the WP (e.g., the WP was planned by Planner V1 which does not produce contracts):

1. The skill SHALL fall back to prose-only review using Sections 1-6 above with no degradation in quality.
2. The absence of contracts SHALL be noted as an informational finding:
   ```
   ### SPEC-CONTRACT-001 [WARN]
   - **Checklist item**: Contract Availability
   - **Requirement**: Section 12 contract-based review
   - **File**: .sdd/plans/contracts/<WP-slug>/
   - **Description**: No contract files found. Falling back to prose-only review.
   - **Expected**: Contract files generated by Planner for stricter implementation validation.
   - **Evidence**: Directory does not exist or is empty.
   ```
3. This finding counts as a WARN (not INFO). WARN findings do not block approval but are tracked.
4. Continue with prose-based review only -- do NOT report contract mismatch findings.

---

## 14. Contract Finding Format

Contract-based findings use the `SPEC-CONTRACT-` prefix and follow this format (FR-018):

```markdown
### Finding: SPEC-CONTRACT-XXX [FAIL]
- **Severity**: HIGH
- **Category**: interface-mismatch | schema-mismatch | api-mismatch | state-mismatch | error-mismatch
- **Contract file**: <path to contract file>
- **Implementation file**: <path>:<line>
- **Expected**: <what the contract defines>
- **Actual**: <what the implementation has>
- **Recommendation**: <specific action to align implementation with contract, 1-500 chars>
```

### Rules

- Contract finding IDs are sequential within a review run, starting from SPEC-CONTRACT-001.
- The `Expected` field shows the exact definition from the contract file.
- The `Actual` field shows the exact definition from the implementation.
- Default severity for all contract mismatches is HIGH.
- Extra public functions not in the contract are MEDIUM.
- The five mismatch categories are:
  1. `interface-mismatch` -- function/method signature deviations
  2. `schema-mismatch` -- entity/model field deviations
  3. `api-mismatch` -- API endpoint deviations
  4. `state-mismatch` -- state transition deviations
  5. `error-mismatch` -- error code/message deviations
- Contract findings are combined with prose-based findings in the final output. The skill produces one unified findings file.
- All combined finding counts (prose + contract) are reflected in the YAML frontmatter `finding_counts`.

### Extended YAML Frontmatter

When contract files are present, include `contract_files_reviewed` in the YAML frontmatter:

```yaml
---
skill: review-spec
wp: <WP-id>
spec: <spec_path>
reviewed_at: <ISO 8601 timestamp>
status: completed
finding_counts:
  pass: <count>
  warn: 0
  fail: <count>
  na: <count>
files_reviewed:
  - <file1>
  - <file2>
contract_files_reviewed:
  - <contract_file1>
  - <contract_file2>
---
```

---

## Quality Checklist

Before completing, verify:

- [ ] All SHALL obligations in the spec evaluated
- [ ] Preconditions and postconditions checked for every function
- [ ] Error paths verified against spec error catalog
- [ ] Edge cases from acceptance scenarios tested
- [ ] Contract files (if present) cross-referenced with implementation
- [ ] `finding_counts` match actual findings in the output
- [ ] `files_reviewed` lists every file read during this review
