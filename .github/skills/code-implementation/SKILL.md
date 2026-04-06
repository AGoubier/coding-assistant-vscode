---
name: code-implementation
description: "Contract-first task implementation for all tasks in a work package"
argument-hint: "Invoked by Coder Coordinator - do not call directly"
---

# code-implementation

> **Phase**: 2 (Core Implementation)
> **Common contract**: `.github/skills/CODER-SKILL-CONTRACT.md`
> **Spec refs**: FR-023, FR-024, FR-025, FR-026

This skill is dispatched by the Coder Coordinator during Phase 2. It implements all tasks in a work package contract-first, matching function signatures, field names, types, and error codes from contract files verbatim. One invocation handles all tasks in one WP.

---

## Input Contract (FR-017)

| # | Input | Description |
|---|-------|-------------|
| 1 | `skill_path` | Path to this SKILL.md file |
| 2 | `wp_path` | Path to the WP file being implemented |
| 3 | `contracts_dir` | Path to contract files for this WP (`.sdd/plans/contracts/<WP-slug>/`) |
| 4 | `spec_path` | Path to the source spec file |
| 5 | `patterns` | Active code-domain patterns to avoid (from `code-patterns.md`) |
| 6 | `target_language` | Programming language (e.g., TypeScript, Python) |
| 7 | `target_framework` | Framework (e.g., Express, FastAPI, React) |
| 8 | `task_list` | Tasks with acceptance criteria and spec refs |

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

One `code-implementation` invocation handles all tasks in one WP. Process tasks sequentially in dependency order.

1. Read all tasks from the `task_list` input
2. Build a dependency graph from each task's `Depends on` field
3. Sort tasks in topological order (tasks with no dependencies first)
4. If circular dependencies are detected, report failure immediately

For each task in order, execute Steps 2-4.

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

**Missing contract file handling**: If a task references a contract file that does not exist in `contracts_dir`:
- Report failure immediately
- Set `status: failure` and `failure_reason: "Contract file <path> referenced by task <task_id> not found"`
- Do NOT continue with the remaining tasks -- halt and let the coordinator handle it

---

## Step 3 -- Implement Contract-First (FR-023, FR-024)

For each task, implement the code that satisfies every acceptance criterion. Follow this sequence:

### 3a. Read Spec Refs and Acceptance Criteria

Read the task's spec refs (FR-XXX, Section N.X) from the spec file. Understand every SHALL obligation, precondition, postcondition, and error path.

### 3b. Copy Interface/Type Definitions Verbatim (FR-024.1, FR-024.2)

Copy interface and type definitions from contract files into the implementation. "Verbatim" means exact:

- Function signatures SHALL match `interfaces.<ext>` exactly: same parameter names, same types, same return types
- Data entity fields SHALL match `data-schemas.<ext>` exactly: same field names, same types, same defaults, same validation rules
- Do NOT rename parameters, fields, or types
- Do NOT add optional parameters not in the contract
- Do NOT change type signatures

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

### Single Invocation Per WP (FR-026)

- One `code-implementation` invocation handles all tasks in one WP
- Tasks are processed sequentially in dependency order within the single invocation
- Do NOT request multiple invocations for a single WP

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
