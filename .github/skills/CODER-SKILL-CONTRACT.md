# Coder Skill Contract

This document defines the common input/output contract that all coding skills (`code-*/SKILL.md`) must follow. It serves as the developer guide for creating new coding skills.

Reference: FR-017 through FR-019 of `.sdd/specs/004-coder-v2.spec.md`

---

## 1. Inputs (FR-017)

Every coding skill receives the following 8 inputs in its subagent prompt from the coordinator:

| # | Input | Type | Description |
|---|-------|------|-------------|
| 1 | `skill_path` | Path | Path to this skill's SKILL.md file |
| 2 | `wp_path` | Path | Path to the WP file being implemented |
| 3 | `contracts_dir` | Path | Path to contract files for this WP (`.sdd/plans/contracts/<WP-slug>/`) |
| 4 | `spec_path` | Path | Path to the source spec file |
| 5 | `patterns` | Text | Active code-domain patterns to avoid (from `code-patterns.md`) |
| 6 | `target_language` | String | Programming language (e.g., TypeScript, Python) |
| 7 | `target_framework` | String | Framework (e.g., Express, FastAPI, React) |
| 8 | `task_list` | Text | Tasks with acceptance criteria and spec refs |

---

## 2. Execution Sequence (FR-018)

Every coding skill SHALL execute these 5 steps in order:

1. **Read SKILL.md** - Load its own SKILL.md to get implementation instructions and guidelines
2. **Read WP + contracts** - Read the WP file and contract files (interfaces, data schemas, API contracts, state machines, error catalogs) to understand what to implement
3. **Read spec sections** - Read the spec sections referenced by its tasks for requirements context
4. **Execute implementation work** - Perform the skill's primary function (code, tests, or debugging)
5. **Report results** - Report files modified, tasks completed, test results, and issues back to the coordinator

---

## 3. Output Contract (FR-019)

Each skill SHALL report to the coordinator with these fields:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `status` | enum | `success` or `failure` | Skill outcome |
| `files_modified` | list(string) | file paths | Files created or changed |
| `tasks_completed` | list(string) | T<NN>-XX format | Tasks finished |
| `test_results` | object | `pass_count`, `fail_count`, `coverage_pct` | Test run summary (Section 7.4) |
| `issues` | list(string) | free text | Problems encountered |
| `failure_reason` | string | nullable | Why the skill failed (if status is `failure`) |

---

## 4. Skill Subagent Prompt Template (Section 8.2)

```
Implement: <skill_name>

1. Read the skill instructions at: <skill_path>
2. Read the WP file at: <wp_path>
3. Read contract files at: <contracts_dir>
4. Read spec sections: <spec_refs>
5. Active patterns to avoid: <patterns>
6. Target: <target_language> with <target_framework>
7. Tasks: <task_list_with_acceptance_criteria>

Rules:
- Implement contract-first: signatures, types, fields MUST match contract files exactly
- Check off acceptance criteria in the WP file as you complete them
- Follow existing codebase conventions
- Do NOT add features not in the spec
- Do NOT perform self-review or quality assessment
- Report files modified, tasks completed, test results, and issues
```

---

## 5. Canonical Skill Dispatch Order (FR-006)

The coordinator dispatches coding skills in this deterministic order:

| Phase | Skill | Purpose |
|-------|-------|---------|
| 1 | `code-env-setup` | Environment verification, dependency installation, baseline test verification |
| 2 | `code-implementation` | Contract-first task implementation for all tasks in the WP |
| 3 | `code-unit-tests` | Unit test writing and execution with coverage threshold enforcement |
| 4 | `code-integration-tests` | Integration test writing for component boundaries |
| 5 | `code-debug` | Conditional: test failure diagnosis and fix (max 3 attempts) |

Skills not present are skipped. Skills present but not in this list are dispatched after all known skills, in alphabetical order.

---

## 6. Skill Directory Structure

Each skill lives in `.github/skills/code-<name>/` and must contain at minimum a `SKILL.md` file with valid YAML frontmatter:

```yaml
---
name: code-<name>
description: "<one-line purpose, 1-500 characters>"
argument-hint: "Invoked by Coder Coordinator - do not call directly"
---
```

The coordinator discovers skills by scanning `code-*/SKILL.md` via glob (FR-005) and dispatches them in the canonical order defined by FR-006.

---

## 7. Error Handling

| Skill Phase | Failure Behavior |
|-------------|-----------------|
| `code-env-setup` | Halt entire WP. Escalate to human. |
| `code-implementation` | Halt entire WP. Report error to coordinator. |
| `code-unit-tests` | Report test failures. Coordinator dispatches `code-debug`. |
| `code-integration-tests` | Report test failures. Coordinator dispatches `code-debug`. |
| `code-debug` | Re-run all tests after fixes. Max 3 attempts. Escalate after 3 failures. |

---

## 8. Constraints

### 8.1 Contract Files Are Read-Only

Skills SHALL NOT modify contract files (`.sdd/plans/contracts/`). Contracts are the Planner's output and the spec's derivative. If a contract is wrong, the skill SHALL report a failure and the coordinator SHALL escalate to the Planner or Spec Architect.

### 8.2 No Self-Review

Skills SHALL NOT perform self-assessment, self-review, or quality evaluation of the code. The Reviewer agent is the sole quality gate (FR-015).

### 8.3 Scope Discipline

Skills SHALL NOT add features, abstraction layers, or configuration not specified in the spec or contracts (FR-025). Implementation must match contracts exactly - no more, no less.
