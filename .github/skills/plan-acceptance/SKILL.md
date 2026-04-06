---
name: plan-acceptance
description: "Acceptance criteria extraction, spec traceability per task"
argument-hint: "Invoked by Planner Coordinator - do not call directly"
---

# plan-acceptance

> **Phase**: 1 (Acceptance)
> **Common contract**: `.github/skills/PLAN-SKILL-CONTRACT.md`
> **Spec refs**: FR-033, FR-034, FR-035, FR-036

This skill is dispatched by the Planner Coordinator during Phase 1, after plan-decomposition has created the WP file skeletons. It populates acceptance criteria, implementation guidance, test requirements, and ensures full FR traceability.

---

## Input Contract (FR-023)

| # | Input | Description |
|---|-------|-------------|
| 1 | `skill_path` | Path to this SKILL.md file |
| 2 | `plan_dir` | Path to `.sdd/plans/` directory |
| 3 | `contracts_dir` | Path to `.sdd/plans/contracts/` directory |
| 4 | `spec_path` | Path to the source spec file |
| 5 | `spec_artifacts_dir` | Path to spec companion artifacts |
| 6 | `research_summary` | Key findings from the research phase |
| 7 | `target_language` | Programming language for contract generation |
| 8 | `patterns` | Active plan-domain patterns to avoid |
| 9 | `phase` | Phase indicator (always `1` for this skill) |

---

## Execution Sequence (FR-024)

1. **Read SKILL.md** - Load this file for acceptance criteria instructions
2. **Read plan state** - Read WP files written by plan-decomposition
3. **Read spec + artifacts** - Read the full spec at `spec_path` for SHALL obligations, BDD scenarios, and implementation details
4. **Modify WP files** - Update existing WP files and README in `plan_dir` (using `[CONSISTENCY FIX]` marker per FR-027)

---

## Step 1 - Build FR Inventory (FR-034.1)

Create a complete inventory of all spec FRs:

1. Extract every FR-XXX from the spec
2. Note its SHALL obligations, error behaviors, preconditions, postconditions
3. Note its category/section for grouping
4. Track which task in which WP each FR is assigned to

**Validation**: Every FR MUST be assigned to exactly one task. If an FR has no task, it is a gap. If multiple tasks claim the same FR, resolve the overlap.

---

## Step 2 - Populate Acceptance Criteria (FR-033)

For each task in each WP file, replace the acceptance criteria placeholder with concrete, verifiable criteria:

### 2a. Extract SHALL Statements (FR-033.1)

For each FR referenced by the task:
- Copy exact SHALL/SHALL NOT statements as acceptance criterion checkboxes
- Minimum 3 acceptance criteria per task
- Use the spec wording verbatim -- do not paraphrase

Format:
```markdown
- **Acceptance criteria**:
  - [ ] <Exact SHALL statement from FR-XXX>
  - [ ] <Exact SHALL statement from FR-XXX>
  - [ ] <Acceptance scenario: Given/When/Then from spec>
  - [ ] <Edge case or error path from spec>
```

### 2b. Map BDD Scenarios (FR-033.2)

For each task that has corresponding BDD scenarios in the spec's test strategy section:
- Copy the Given/When/Then scenarios as acceptance criteria
- Map each scenario to the task's FR refs
- If a FR has no BDD scenario in the spec, note it as a gap

### 2c. Add Error Path Criteria (FR-033.3)

For each task:
- Ensure every error code and failure mode from the spec is represented
- Add explicit acceptance criteria for error paths, not just happy paths

---

## Step 3 - Add Implementation Guidance (FR-033.3)

For each task, replace the implementation guidance placeholder with actionable developer guidance:

```markdown
- **Implementation Guidance**:
  - Official docs: <URL or reference for the primary library/API used>
  - Patterns: <Specific design pattern or approach from the spec/architecture>
  - Known pitfalls: <Common mistakes or gotchas for this feature area>
  - Files to create/modify: <Specific paths based on the spec's directory structure>
  - Error handling: <Exact error codes and expected failure behaviors from spec>
  - Spec validation rules: <Copy relevant validation constraints from spec Section 7 Data Model>
```

Source the guidance from:
1. The spec's architecture section (tech stack, directory structure)
2. The spec's security section (for auth, input validation tasks)
3. The spec's non-functional requirements (for performance, scaling tasks)
4. The research summary provided by the coordinator

---

## Step 4 - Set Test Requirements (FR-035)

For each task, set the `Test requirements` field based on spec analysis:

| FR type | Default test type |
|---------|------------------|
| Business logic, domain rules | unit |
| Cross-module interaction | integration |
| User story acceptance scenarios | BDD |
| Full workflow, deployment verification | E2E |
| Pure scaffolding, config-only | none |

**BDD/TDD mandate (FR-035)**:
- Specs with BDD scenarios MUST have matching BDD test types
- Every task with test requirements MUST follow TDD: write test scenarios (or stubs) before implementation
- Coverage thresholds from the spec (default: 80% code, 90% branch) MUST be noted in the WP-level implementation notes

---

## Step 5 - Verify FR Traceability (FR-034)

Perform a complete traceability check:

1. **Forward trace** (FR -> Task): Every FR in the spec is assigned to at least one task
2. **Backward trace** (Task -> FR): Every task references at least one FR
3. **Completeness**: No FR is left unassigned
4. **Uniqueness**: No FR is claimed by more than one task (unless it genuinely spans multiple tasks, which must be documented)

**If gaps are found**:
- FR with no task: Flag as `[GAP]` -- the coordinator will decide whether to add a task or escalate
- Task with no FR: Flag as `[UNTRACED]` -- may indicate scope creep; the coordinator should remove it or trace it

Output the traceability summary in each WP file:

```markdown
## FR Traceability

| FR | Task | Status |
|----|------|--------|
| FR-001 | T01-01 | Covered |
| FR-002 | T01-02 | Covered |
| ... | ... | ... |
```

---

## Step 6 - Update README (FR-036)

Update `<plan_dir>/README.md` with:

1. **WP index table** with columns: WP ID, Title, Priority, Lane, Depends On, Tasks Count, FR Count
2. **MVP scope** section listing which WPs are P0/P1 (MVP) vs P2+ (post-MVP)
3. **Dependency graph** in mermaid format showing WP sequencing
4. **FR coverage summary**: Total FRs in spec vs total FRs assigned to tasks (should be 100%)

If README was created by plan-decomposition, update the existing sections. Append if sections do not exist.

---

## Constraints

- Only MODIFY existing WP files written by plan-decomposition -- do not create new WP files
- Every modification to an existing WP file MUST use the `[CONSISTENCY FIX]` marker per FR-027
- Do NOT write contract files -- that is Phase 2's responsibility
- Do NOT modify files outside `plan_dir`
- Minimum 3 acceptance criteria per task -- if the spec has fewer than 3 SHALL statements for a task's FRs, add edge case or error path criteria to meet the minimum
- Every acceptance criterion MUST be verifiable: a reviewer must be able to determine pass/fail unambiguously
- Use plain ASCII hyphens and straight quotes only -- no em dashes, smart quotes, or curly apostrophes
