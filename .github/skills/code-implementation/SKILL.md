---
name: code-implementation
description: "Contract-first single-task implementation dispatched by Coder Coordinator"
argument-hint: "Invoked by Coder Coordinator - do not call directly"
---

# code-implementation

> **Phase**: 2 (Core Implementation)
> **Common contract**: `.github/skills/CODER-SKILL-CONTRACT.md`
> **Spec refs**: FR-023, FR-024, FR-025, FR-026

This skill is dispatched by the Coder Coordinator during Phase 2. It implements a single task contract-first, matching function signatures, field names, types, and error codes from contract files verbatim. Each invocation handles one task as dispatched by the Coder agent.

---

## Input Contract (FR-017)

| # | Input | Description |
|---|-------|-------------|
| 1 | `skill_path` | Path to this SKILL.md file |
| 2 | `wp_path` | Path to the WP file being implemented |
| 3 | `contracts_dir` | Path to contract files for this WP (`.sdd/plans/contracts/<WP-slug>/`) |
| 4 | `shared_contracts_dir` | Path to shared cross-WP contracts (`.sdd/plans/contracts/shared/`) |
| 5 | `spec_path` | Path to the source spec file |
| 6 | `patterns` | Active code-domain patterns to avoid (from `code-patterns.md`) |
| 7 | `target_language` | Programming language (e.g., TypeScript, Python) |
| 8 | `target_framework` | Framework (e.g., Express, FastAPI, React) |
| 9 | `task_list` | Tasks with acceptance criteria and spec refs |
| 10 | `dependency_source_summary` | Actual file paths, exports, and import paths from completed dependency WPs |

---

## Execution Sequence (FR-018)

1. **Read SKILL.md** -- Load this file for implementation instructions
2. **Read WP + contracts** -- Read the WP file and all contract files (interfaces, data schemas, API contracts, state machines, error catalogs)
3. **Read spec sections** -- Read the spec sections referenced by each task for requirements context
4. **Execute implementation** -- Implement all tasks contract-first in dependency order (Steps 1-4 below)
5. **Report results** -- Report files modified, tasks completed, test results, and issues back to the coordinator

---

## Output Contract (FR-019)

Report to the coordinator with these fields:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `status` | enum | `success` or `failure` | Skill outcome |
| `files_modified` | list(string) | file paths | Files created or changed |
| `tasks_completed` | list(string) | T<NN>-XX format | Tasks finished |
| `test_results` | object | `pass_count`, `fail_count`, `coverage_pct` | Test run summary (may be empty for this skill) |
| `issues` | list(string) | free text | Problems encountered |
| `failure_reason` | string | nullable | Why the skill failed (if status is `failure`) |

---

## Step 1 -- Read and Order Tasks (FR-026)

Each `code-implementation` invocation handles a single task dispatched by the Coder agent. The Coder dispatches one task at a time in dependency order.

1. Read the task from the `task_list` input (single task with acceptance criteria)
2. Verify all task dependencies are satisfied (prior tasks completed)
3. If dependencies are unmet, report failure immediately

Execute Steps 2-4 for this task.

---

## Step 2 -- Load Contract Files for the Task (FR-024)

Before implementing each task, read the contract files it references. Contract files live in `contracts_dir` and may include:

| Contract File | Contents | Spec Ref |
|---------------|----------|----------|
| `interfaces.<ext>` | Function/method signatures with parameter names, types, and return types | FR-024.1 |
| `data-schemas.<ext>` | Entity/model definitions with field names, types, defaults, and validation rules | FR-024.2 |
| `api-contracts.<ext>` | API endpoint paths, HTTP methods, request/response types | FR-024.3 |
| `state-machines.<ext>` | State enums, valid transitions, guard conditions | FR-024.4 |
| `error-catalog.<ext>` | Error codes, messages, HTTP status codes | FR-024.5 |

The `<ext>` matches the target language (e.g., `.ts`, `.py`, `.go`).

**Shared contracts**: Also read contract files from `shared_contracts_dir` (`.sdd/plans/contracts/shared/`). These contain entity types and interfaces defined by earlier WPs that the current WP may depend on. Import shared types from the shared contracts rather than re-defining them.

**Missing contract file handling**: If a task references a contract file that does not exist in `contracts_dir` or `shared_contracts_dir`:
- Report failure immediately
- Set `status: failure` and `failure_reason: "Contract file <path> referenced by task <task_id> not found"`
- Do NOT continue with the remaining tasks -- halt and let the coordinator handle it

---

## Step 3 -- Implement Contract-First (FR-023, FR-024)

Implement the code that satisfies every acceptance criterion for the assigned task. The Coder dispatches this skill once per task, so focus on implementing ONLY the task specified in the prompt. Follow this sequence:

### 3a. Read Spec Refs, Acceptance Criteria, and Implementation Guidance

Read the task's spec refs (FR-XXX, Section N.X) from the spec file. Understand every SHALL obligation, precondition, postcondition, and error path.

Read the task's **Implementation Guidance** section from the WP file. This section contains specific instructions, recommended libraries, doc links, patterns, and constraints for how to implement this task. Follow its guidance precisely -- it was written by the Planner with knowledge of the target stack and architecture.

### 3a.1. Extract Business Logic from Spec

Beyond the basic FR obligations, extract and implement ALL business logic specified:

1. **Business rules & invariants**: Conditions the system must enforce at all times. These become validation checks, guards, or assertions in the implementation.
2. **Decision logic**: If the FR includes a decision table or multi-branch conditional logic, implement ALL branches exactly as specified. Do NOT simplify or collapse branches.
3. **Computed values**: If the FR specifies a formula or derivation (e.g., `total = sum(items.price * items.qty)`), implement the exact computation. Do NOT approximate or use different formulas.
4. **Side effects**: If the FR specifies events to emit, notifications to send, cache operations, or audit logging, implement them as part of the operation. Side effects are NOT optional enhancements -- they are specified behavior.
5. **Temporal rules**: If the FR specifies time-based constraints (cooldown periods, expiration windows, rate limits), implement the exact timing logic specified.

If the spec references an invariant, decision table, or side effect but the task description does not repeat it, still implement it -- the spec is the source of truth.

### 3a.1. Directory Structure (Greenfield)

If this is the first task of the first WP (no existing source files), read the spec's **Section 9.3 Directory Structure** to determine where files should be placed. Create directories as needed. For subsequent tasks and WPs, follow the directory structure already established by prior tasks.

### 3b. Copy Interface/Type Definitions Verbatim (FR-024.1, FR-024.2)

Copy interface and type definitions from contract files into the implementation. "Verbatim" means exact:

- Function signatures SHALL match `interfaces.<ext>` exactly: same parameter names, same types, same return types
- Data entity fields SHALL match `data-schemas.<ext>` exactly: same field names, same types, same defaults, same validation rules
- Do NOT rename parameters, fields, or types
- Do NOT add optional parameters not in the contract
- Do NOT change type signatures

**Tool guidance for implementation efficiency**:
- Use `#tool:edit/editFiles` with multi-replace mode when making multiple independent edits across files in a single operation
- Call `#tool:read/problems` after each file edit to catch syntax and type errors immediately -- do not wait until all edits are done
- Read multiple contract files in parallel via concurrent tool calls
- Use `#tool:search/usages` to verify contract symbol implementations when checking interface compliance

**Example**: Given a contract defining:
```typescript
createUser(input: CreateUserInput): Promise<User>
```
The implemented function SHALL have exactly that signature -- not `addUser`, not `createNewUser`, not `createUser(data: any)`.

### 3c. Implement API Endpoints (FR-024.3)

API endpoint paths, HTTP methods, and request/response types SHALL match `api-contracts.<ext>` exactly:
- Path: `/api/users` -- not `/users`, not `/api/v1/users` (unless the contract says so)
- Method: `POST` -- not `PUT`, not `PATCH` (unless the contract says so)
- Request body type: matches the contract request schema exactly
- Response type: matches the contract response schema exactly

### 3d. Implement State Transitions (FR-024.4)

State transitions SHALL match `state-machines.<ext>` exactly:
- Valid states: only the states defined in the contract
- Transitions: only the transitions defined in the contract (from state -> to state with guard)
- Guards: enforce the guard conditions specified in the contract
- Do NOT add states, transitions, or guards not in the contract

### 3e. Implement Error Handling (FR-024.5)

Error codes and messages SHALL match `error-catalog.<ext>` exactly:
- Error code: the exact string from the catalog (e.g., `USR-001`)
- Message: the exact message template from the catalog
- HTTP status: the exact status code from the catalog
- Do NOT invent error codes not in the catalog
- Do NOT change error message wording

### 3f. Implement All Error Paths and Validation Rules

From the spec sections, identify every error condition mentioned and implement it:
- Precondition violations: validate inputs and return the appropriate error
- Postcondition enforcement: ensure outputs match the spec
- Edge cases: handle boundaries described in the spec or acceptance scenarios

### 3g. Follow Codebase Conventions

Match the existing codebase style:
- Naming conventions (camelCase, snake_case, PascalCase)
- File organization (where new files go)
- Import style (relative vs absolute, named vs default)
- Error handling patterns (try/catch, Result types, error returns)
- Logging patterns (if the codebase uses a logger, use the same one)

If the codebase is empty (greenfield), follow the conventions specified in the spec or standard conventions for the target language/framework.

### 3g.1. Import from Dependency WPs

When the current WP depends on modules from earlier WPs (per `dependency_source_summary` input):
- Use the actual file paths and import paths listed in the dependency source summary
- Do NOT guess import paths -- use the exact module paths from the summary
- If a needed symbol is listed in the dependency exports, import it directly
- If a needed symbol is NOT in the dependency exports, check shared contracts first, then report as an issue

### 3h. Check Off Acceptance Criteria (FR-023.7)

After implementing each task, update the WP file:
- Change `- [ ]` to `- [x]` for each acceptance criterion that is satisfied
- Only check off criteria that are fully satisfied -- do not partially check

---

## Step 4 -- Handle Ambiguous Requirements

If a requirement is ambiguous (multiple valid interpretations exist):

1. Flag the ambiguity in the WP file by appending a note under the task:
   ```
   [IMPL ISSUE: <description of the ambiguity and the interpretation chosen>]
   ```
2. Continue with the best interpretation based on:
   - Related requirements in the spec
   - Existing codebase patterns
   - Contract file definitions (which take precedence)
3. Report the issue in the `issues` output field

Do NOT halt for ambiguous requirements. Flag, choose the best interpretation, and continue.

---

## Constraints (FR-025)

### SHALL NOT: Over-Engineering (FR-025.1)

- Do NOT add features not specified in the spec or contracts
- Do NOT add abstraction layers (base classes, generics, strategy patterns) unless the contract defines them
- Do NOT add configuration options not in the spec
- Do NOT add "nice-to-have" utilities or helper functions beyond what the task requires
- Implement exactly what is specified -- no more, no less

### SHALL NOT: Scope Creep (FR-025.2)

- Do NOT refactor unrelated code outside the current task's scope
- Do NOT "improve" existing code while implementing a new task
- Do NOT fix unrelated bugs found during implementation (report them as issues instead)
- Do NOT reorganize file structure unless the task explicitly requires it

### SHALL NOT: Contract Modification (FR-025.3)

- Do NOT modify any file in `.sdd/plans/contracts/`
- Contracts are the Planner's output and the spec's derivative
- If a contract appears wrong, report it as an issue and implement against the contract as written
- The coordinator will escalate contract issues to the Planner or Spec Architect

### SHALL NOT: Self-Review (FR-025.4)

- Do NOT perform self-assessment or quality evaluation of the code
- Do NOT write "verified implementation quality" or similar review statements
- Do NOT add review checklists or quality scores
- The Reviewer agent is the sole quality gate

### Single Task Per Invocation (FR-026)

- Each `code-implementation` invocation handles a single task dispatched by the Coder agent
- The Coder dispatches one invocation per task in dependency order
- Do NOT attempt to process multiple tasks within a single invocation

---

## Error Handling Summary

| Scenario | Behavior |
|----------|----------|
| Missing contract file | Halt. Set `status: failure`. Report to coordinator. |
| Ambiguous requirement | Flag with `[IMPL ISSUE]` in WP. Continue with best interpretation. |
| Circular task dependency | Halt. Set `status: failure`. Report cycle details. |
| Implementation error (e.g., compile failure) | Attempt to fix. If unfixable, report as issue and continue with remaining tasks. |
| Contract appears incorrect | Implement as written. Report as issue. Coordinator escalates to Planner. |

---

## Active Patterns

Before implementing, review the `patterns` input. These are mistakes caught in prior code reviews. Avoid repeating them. If the patterns list is empty ("No active patterns"), proceed normally.
