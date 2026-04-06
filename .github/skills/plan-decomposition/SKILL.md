---
name: plan-decomposition
description: "WP identification, task breakdown, sequencing, and dependencies"
argument-hint: "Invoked by Planner Coordinator - do not call directly"
---

# plan-decomposition

> **Phase**: 1 (Decomposition)
> **Common contract**: `.github/skills/PLAN-SKILL-CONTRACT.md`
> **Spec refs**: FR-028, FR-029, FR-030, FR-031, FR-032

This skill is dispatched by the Planner Coordinator during Phase 1. It analyzes a validated specification and decomposes it into structured, sequenced work packages with atomic tasks.

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

1. **Read SKILL.md** - Load this file for planning instructions
2. **Read plan state** - Read existing plan files (README, any existing WP files) to understand prior context
3. **Read spec + artifacts** - Read the full spec at `spec_path` and companion artifacts at `spec_artifacts_dir`
4. **Write plan files** - Write WP files and skeleton README to `plan_dir`

---

## Step 1 - Analyze the Specification (FR-028.1)

Read the specification thoroughly. Extract and organize:

1. **Functional requirements (FRs)**: Every FR-XXX with its SHALL obligations, error behaviors, preconditions, and postconditions
2. **User stories**: Every US-XXX with acceptance scenarios (Given/When/Then)
3. **Architecture decisions**: System design, tech stack, directory structure, module boundaries
4. **Data model**: Entities, relationships, state machines
5. **API surface**: Endpoints, interfaces, public methods
6. **Non-functional requirements**: Performance, security, accessibility constraints
7. **Cross-cutting concerns**: Auth, logging, pagination, rate limiting
8. **Testing strategy**: Test types, coverage thresholds, BDD scenarios

---

## Step 2 - Identify Work Packages (FR-028.2, FR-028.5)

Group related FRs into logical work packages following this sequencing logic:

1. **Foundation (P0)** - Project scaffolding, directory structure, tooling, CI/CD setup, base infrastructure
2. **Core domain (P1)** - Primary entities, business logic, core internal APIs
3. **Integrations (P1)** - External systems, third-party APIs, messaging
4. **User-facing layers (P1)** - UI components, CLI, public API surface
5. **Quality (P2)** - Extended test suites, observability, performance hardening
6. **Delivery (P2)** - Deployment, documentation, release preparation

Adjust sequencing based on actual spec dependencies. Not every layer is needed for every spec.

**Priority assignment**:
- **P0**: Foundation WP -- scaffolding with no user-facing functionality
- **P1**: MVP work packages -- deliver a user-testable increment
- **P2+**: Post-MVP enhancements -- incremental improvements

**Splitting rules**:
- Split a WP if two areas have zero shared dependencies and could be worked in parallel
- Target 5-12 tasks per WP (FR-030)
- A WP with fewer than 5 tasks is too granular -- merge with another WP
- A WP with more than 12 tasks should be split into separate WPs

---

## Step 3 - Decompose WPs into Tasks (FR-028.3, FR-029)

For each work package, create atomic tasks. A task is complete when it maps to a single, reviewable change.

Each task SHALL include (FR-029):

```markdown
### T<NN>-XX - <Task title>

- **Description**: <What must be done, precisely>
- **Spec refs**: FR-XXX, FR-XXX, Section N.X
- **Parallel**: Yes / No
- **Acceptance criteria**:
  - [ ] <Placeholder -- filled by plan-acceptance skill>
- **Test requirements**: unit / integration / BDD / E2E / none
- **Depends on**: T<NN>-XX or none
- **Implementation Guidance**:
  - <Placeholder -- filled by plan-acceptance skill>
```

**Task ID format**: `T<WP-number>-<sequence>` (e.g., T01-01, T01-02, T03-05)

**Foundation WP special rule (FR-032)**: The first task of the foundation WP SHALL always be virtual environment setup for languages with package isolation:
- Python: `python -m venv .venv` or poetry/conda
- Node.js: local `node_modules` with lockfile
- Go: go modules
- If the project does not use a language with package isolation, document why this task is skipped

---

## Step 4 - Define Dependencies (FR-028.4)

For each task and WP:

1. **Inter-task dependencies**: Declare by task ID (e.g., `Depends on: T01-03`)
2. **Inter-WP dependencies**: Declare in the WP metadata table (e.g., `Depends on: WP01, WP02`)
3. **Parallel flags**: Mark tasks that can run concurrently within a WP
4. **Parallelisable WPs**: Mark WPs that have no shared mutable state and can run in parallel

Verify:
- No circular dependencies (in tasks or WPs)
- Every dependency reference is a valid ID
- Shared mutable state is not accessed by parallel tasks

---

## Step 5 - Write WP Files (FR-028.6, FR-031)

Write one file per work package at `<plan_dir>/WP<NN>-<slug>.md` with this structure:

```markdown
---
lane: planned
---

# WP<NN> - <Title>

| Field | Value |
|-------|-------|
| Spec | `<spec_path>` |
| Priority | P0 / P1 / P2 |
| Lane | planned |
| Depends on | WP<NN> or none |
| Goal | One-sentence user-observable outcome |
| Status | Not Started |
| Independent Test | How to verify in isolation |
| Parallelisable | Yes / No |
| Prompt | `<plan_dir>/WP<NN>-<slug>.md` |

## Objective

<2-3 sentences: what this WP delivers and why it matters>

## Spec References

<Comma-separated list of FRs and sections this WP covers>

## Tasks

<All tasks with the T<NN>-XX format from Step 3>

## Implementation Notes

<Key technical decisions, known pitfalls, sequencing rationale>

## Risks & Mitigations

<Known risks with mitigation strategies>

## Activity Log

- <timestamp> - planner - lane=planned - Work package created
```

**WP numbering**: Use two-digit zero-padded numbers (WP01, WP02, ...). If the plan directory already has WP files from a prior spec, continue from the highest existing WP number + 1.

---

## Step 6 - Write Skeleton README (FR-028.7)

Write or update `<plan_dir>/README.md` with:

1. **Spec reference**: Link to the source spec file
2. **WP table**: All WPs with ID, title, priority, status, depends-on, parallelisable
3. **Dependency graph**: Show the critical path and parallel opportunities (text or mermaid)
4. **Task index placeholder**: To be populated by plan-acceptance

If the README already exists from a prior spec, append a new section for this spec.

---

## Constraints

- Every task MUST trace to at least one spec FR -- never invent requirements
- Every WP file MUST be self-contained enough for a coder to understand the scope without reading the full spec
- Do NOT fill acceptance criteria or implementation guidance placeholders -- that is plan-acceptance's job
- Do NOT write contract files -- that is Phase 2's responsibility
- Do NOT modify files outside `plan_dir`
- Stay within 500 lines per file write operation
- Use plain ASCII hyphens and straight quotes only -- no em dashes, smart quotes, or curly apostrophes
