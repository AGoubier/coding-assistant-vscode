---
name: retro-assembly
description: "Assembles extracted data into final SDD-compatible 18-section specifications at global, project, and module levels"
argument-hint: "Invoked by Retro-Spec Coordinator - do not call directly"
---

# retro-assembly -- Specification Assembly Skill

This skill is invoked by the Retro-Spec Coordinator as the FINAL skill. It takes all extracted data from prior skills (architecture, data model, API contracts, business logic, cross-cutting concerns, test analysis) and assembles finalized SDD-compatible specification documents at three levels: global view, per-project, and per-module.

## Input Contract

| # | Input | Description |
|---|-------|-------------|
| 1 | `skill_path` | Path to this SKILL.md file |
| 2 | `accumulator_path` | Path to the primary accumulator (project-level spec) |
| 3 | `artifacts_dir` | Path to the companion artifacts directory |
| 4 | `discovery_manifest_path` | Path to the discovery manifest |
| 5 | `source_path` | Path to the legacy source code |
| 6 | `target_language` | Target language for reimplementation |
| 7 | `project_name` | Name of the project |
| 8 | `scope` | Analysis scope: `full` | `project` | `overview` |
| 9 | `all_project_specs` | Paths to all project-level spec accumulators (for multi-project codebases) |

## Execution Sequence

1. **Read this SKILL.md**
2. **Read ALL accumulators** (all project specs with their extracted sections). Read multiple accumulators in parallel via concurrent tool calls.
3. **Read ALL artifacts** (data-schemas, api-contracts, interfaces, state-machines, error-catalogs, dependency-graphs). Read multiple artifact files in parallel.
4. **Read discovery manifest** for codebase topology
5. **Finalize project-level specs**: Fill missing boilerplate sections (1-3, 14-18), ensure 18-section completeness
6. **Produce global view spec**: Synthesize system-wide specification
7. **Produce module-level specs** (if full scope): Extract focused specs per module

## Constraints

- Do NOT invent requirements not supported by evidence from prior skills
- Do NOT modify extracted content -- organize and format it
- Carry forward ALL confidence markers from prior skills
- Ensure every FR has a unique identifier across the entire spec
- Ensure cross-references between sections are consistent

---

## Assembly Procedure

### Step 1: Validate Accumulator Completeness

For each project accumulator, check which sections are present:

| Section | Expected Source Skill | Status |
|---------|---------------------|--------|
| 1. Overview | Assembly (this skill) | TO WRITE |
| 2. Goals & Success Criteria | Assembly (this skill) | TO WRITE |
| 3. Users & Roles | Assembly (this skill) | TO WRITE |
| 4. Functional Requirements | retro-business-logic | CHECK |
| 5. User Stories | retro-business-logic | CHECK |
| 6. User Flows | retro-business-logic | CHECK |
| 7. Data Model | retro-data-model | CHECK |
| 8. API / Interface Design | retro-api-contracts | CHECK |
| 9. Architecture | retro-architecture | CHECK |
| 10. Non-Functional Requirements | retro-cross-cutting | CHECK |
| 11. Test Requirements | retro-test-analysis | CHECK |
| 12. Constraints & Assumptions | retro-cross-cutting | CHECK |
| 13. Out of Scope | retro-cross-cutting | CHECK |
| 14. Open Questions | Assembly (this skill) | TO WRITE |
| 15. Glossary | Assembly (this skill) | TO WRITE |
| 16. References | Assembly (this skill) | TO WRITE |
| 17. Traceability Matrix | Assembly (this skill) | TO WRITE |
| 18. Version History | Assembly (this skill) | TO WRITE |

If any section from an extraction skill is missing, mark it: `[SECTION MISSING: <skill> did not produce Section <N>]`

### Step 2: Write Boilerplate Sections

#### Section 1 -- Overview

Synthesize from the discovery manifest and all extracted data:

```markdown
## 1. Overview

> **Source**: Retro-spec analysis of legacy codebase at `<source_path>`
> **Legacy Language**: <language>
> **Target Language**: <target_language>
> **Status**: Draft (Retro-Spec Generated)
> **Confidence**: <overall confidence percentage>
> **Version**: 1.0

<System-name> is a <system-type> that <primary purpose description>.

The system is composed of <N> modules/components:
- **<Component A>**: <purpose>
- **<Component B>**: <purpose>

This specification was reverse-engineered from the legacy codebase and represents
the system's current behavior as implemented. Items marked with confidence levels
indicate the degree of certainty in the inferred requirement.
```

#### Section 2 -- Goals & Success Criteria

Infer from the system's capabilities:

```markdown
## 2. Goals & Success Criteria

### Goals (Inferred from Legacy Behavior)

| # | Goal | Evidence | Confidence |
|---|------|----------|------------|
| G-01 | <primary system goal> | <major feature area> | [INFERRED: confidence] |

### Success Criteria (for Reimplementation)

| # | Criterion | Measurement |
|---|----------|-------------|
| SC-01 | Feature parity with legacy system | All FRs marked [INFERRED: HIGH] are implemented |
| SC-02 | All extracted API contracts satisfied | API contract artifacts pass validation |
| SC-03 | All test-derived behaviors verified | Section 11 test scenarios pass |
| SC-04 | Data model migration capability | Legacy data can be imported via migration scripts |
```

#### Section 3 -- Users & Roles

Derive from authorization analysis:

```markdown
## 3. Users & Roles

| # | Role | Description | Capabilities | Source |
|---|------|-------------|-------------- |--------|
| R-01 | <role name> | <description> | <what they can do> | <auth code:line> |
```

#### Section 14 -- Open Questions

Collect all `[AMBIGUOUS]`, `[NEEDS CLARIFICATION]`, and `[INFERRED: LOW]` items:

```markdown
## 14. Open Questions

| # | Question | Impact | Source Section | Confidence |
|---|----------|--------|---------------|------------|
| OQ-01 | <what is unclear> | <what it affects> | Section X.Y | LOW |
```

#### Section 15 -- Glossary

Extract domain terms from code (class names, enum values, business concepts):

```markdown
## 15. Glossary

| Term | Definition | Source |
|------|-----------|--------|
| <domain term> | <meaning inferred from usage> | <file:line> |
```

#### Section 16 -- References

```markdown
## 16. References

| # | Reference | Type |
|---|----------|------|
| R-01 | Legacy codebase at `<source_path>` | Source code |
| R-02 | Discovery manifest at `.sdd/retro/discovery-manifest.md` | Analysis artifact |
```

#### Section 17 -- Traceability Matrix

Map every FR to its source evidence and test coverage:

```markdown
## 17. Traceability Matrix

| FR | Source File(s) | Test File(s) | User Story | API Endpoint | Confidence |
|----|---------------|-------------|------------|-------------- |------------|
| FR-001 | <source:line> | <test:name> | US-01 | POST /api/users | HIGH |
| FR-002 | <source:line> | [NO TEST] | US-01 | POST /api/users | MEDIUM |
```

Every FR SHALL have at least a source file reference. Empty cells SHALL be filled with `[NONE]`.

#### Section 18 -- Version History

```markdown
## 18. Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | <ISO date> | Initial retro-spec from legacy codebase analysis |
```

### Step 3: Confidence Aggregation

Calculate per-section and overall confidence:

```markdown
### Confidence Summary

| Section | HIGH | MEDIUM | LOW | AMBIGUOUS | Overall |
|---------|------|--------|-----|-----------|---------|
| 4. FRs | X | Y | Z | W | <weighted %> |
| 5. Stories | ... | ... | ... | ... | ... |
| ...
| **Total** | **X** | **Y** | **Z** | **W** | **X%** |
```

Weighted scoring: HIGH = 1.0, MEDIUM = 0.7, LOW = 0.3, AMBIGUOUS = 0.1

Insert this summary before Section 1 in the final spec.

### Step 4: Global View Specification

For multi-project codebases, produce `.sdd/retro/global-view.spec.md`:

```markdown
# <System Name> -- Global System Specification

> **Source**: Retro-spec analysis of <N> projects
> **Generated**: <ISO date>
> **Status**: Draft (Retro-Spec Generated)

## System Overview

<High-level description of the entire system>

## Projects

| # | Project | Language | Framework | Purpose | Spec Path |
|---|---------|----------|-----------|---------|-----------|
| 1 | <name> | <lang> | <fw> | <purpose> | <path to project.spec.md> |

## System Architecture

<Mermaid diagram showing all projects and their interactions>

## Cross-Project Integrations

| From | To | Integration Type | Protocol | Description |
|------|-----|-----------------|----------|-------------|
| Project A | Project B | API | REST/gRPC | <description> |

## Shared Data Model

Entities shared or referenced across projects:
| Entity | Owned By | Referenced By | Spec Reference |
|--------|----------|---------------|----------------|
| User | Project A | Project B, C | Section 7.1 of Project A spec |

## System-Wide NFRs

Non-functional requirements that apply across all projects:
<aggregated from individual project NFRs>

## Global Traceability

| FR Range | Project | Module(s) | Description |
|----------|---------|-----------|-------------|
| FR-001 to FR-050 | Project A | auth, users | Core user management |
| FR-051 to FR-100 | Project B | orders, payments | Order processing |
```

### Step 5: Module-Level Specifications (Full Scope Only)

For each module, read its module-level accumulator (produced during per-module deep extraction) and assemble a comprehensive module spec. Module specs SHALL be deep enough to reimplement the module independently.

```markdown
# <Module Name> -- Module Specification

> **Project**: <project name>
> **Path**: <module path>
> **Type**: <feature/layer/utility>
> **Generated**: <ISO date>
> **Confidence**: <module-level confidence %>

---

## 1. Module Overview

<What this module does, its role in the project, why it exists>

### Domain Context

<The business domain this module operates in and the real-world concepts it models>

---

## 2. Public Interface

<Extracted from Section 8, filtered to this module's exports>

| Symbol | Type | Signature | Description | Confidence |
|--------|------|-----------|-------------|------------|
| <name> | function | <full signature with param types and return type> | <purpose> | [INFERRED: X] |
| <name> | class | <constructor + all public methods> | <purpose> | [INFERRED: X] |
| <name> | type/interface | <full definition> | <purpose> | [INFERRED: X] |

---

## 3. Data Model (Module-Owned Entities)

<Entities owned or primarily managed by this module, from Section 7>

For each entity:
- Full field table with types and constraints
- Relationships to other entities (including cross-module references)
- Validation rules specific to this module's operations on the entity
- State machines (if the entity has stateful lifecycle managed here)

---

## 4. Business Rules & Domain Logic

This is the core section. It documents EVERY business rule enforced by this module.

### 4.1 Invariants

Rules that must ALWAYS hold true within this module:

| # | Invariant | Enforcement | Source |
|---|-----------|-------------|--------|
| INV-01 | <business invariant> | <where/how enforced> | <file:line> |

### 4.2 Validation Rules

Input validation and business constraint checks:

| # | Rule | Trigger | Error on Violation | Source |
|---|------|---------|-------------------|--------|
| VR-01 | <validation rule> | <when checked> | <error code/message> | <file:line> |

### 4.3 Decision Logic

Conditional business logic (branches, switches, policies):

| # | Decision | Condition | Outcome A | Outcome B | Source |
|---|----------|-----------|-----------|-----------|--------|
| DL-01 | <what is being decided> | <condition> | <then behavior> | <else behavior> | <file:line> |

### 4.4 Computed Values & Transformations

Calculations, derived fields, data transformations with business meaning:

| # | Computation | Formula/Logic | Business Purpose | Source |
|---|------------|---------------|-----------------|--------|
| CV-01 | <what is computed> | <how> | <why> | <file:line> |

### 4.5 Side Effects & Event Production

Actions triggered as consequences of operations:

| # | Trigger Operation | Side Effect | Purpose | Source |
|---|-------------------|-------------|---------|--------|
| SE-01 | <operation> | <event emitted / notification / cache update> | <business reason> | <file:line> |

---

## 5. Functional Requirements (Module-Scoped)

FRs from Section 4 that belong to this module, with full detail:

- **FR-XXX**: The module SHALL <obligation>.
  - Precondition: <state>
  - Postcondition: <result>
  - Error: <failure behavior>
  - Business rationale: <why this behavior exists>
  [INFERRED: X] Source: <file:line>

---

## 6. Workflows & Orchestration

Multi-step processes orchestrated by or within this module:

### 6.1 <Workflow Name>

**Trigger**: <what starts this workflow>
**Actor**: <who/what initiates it>
**Steps**:
1. <step> -- <business purpose>
   - Calls: <function/service> with <params>
   - On success: <next step>
   - On failure: <error handling / compensation>
2. ...

**End state**: <what is true when the workflow completes>

---

## 7. Inter-Module Interactions

| Called Module | Function/Method | Data Passed | Data Returned | Business Purpose |
|---------------|----------------|-------------|---------------|------------------|
| <module> | <function> | <params> | <return> | <why this call is made> |

### Inbound Dependencies (other modules that call into this one)

| Calling Module | Entry Point | Context |
|---------------|-------------|--------|
| <module> | <function> | <when/why they call us> |

---

## 8. Error Handling (Module-Specific)

| # | Error Condition | Error Type/Code | HTTP Status | Recovery | Source |
|---|----------------|----------------|-------------|----------|--------|
| E-01 | <condition> | <error type> | <status> | <retry/fail/compensate> | <file:line> |

---

## 9. Internal Data Flow

<Step-by-step description of how data moves through this module, from entry point to response>

```mermaid
graph LR
    Input --> Validation --> BusinessLogic --> Persistence --> Response
```

---

## 10. Module-Specific Tests

<Tests from Section 11 that cover this module, mapped to FRs and business rules>

| Test | Covers | Type | Confidence |
|------|--------|------|------------|
| <test name> | FR-XXX, VR-01 | unit | HIGH |

### Coverage Gaps

<Business rules and FRs in this module that have NO test coverage>

---

## 11. Glossary (Module Domain Terms)

| Term | Meaning | Source |
|------|---------|--------|
| <domain term from code> | <business meaning> | <file:line> |
```

### Step 6: Final Validation

Before declaring assembly complete:

1. **FR uniqueness**: Verify no duplicate FR-XXX identifiers
2. **Cross-references**: Verify all Section 7 entity references in Section 8 are valid
3. **Traceability completeness**: Verify no FR is orphaned (missing from traceability matrix)
4. **Artifact consistency**: Verify artifact type definitions match Section 7 entity definitions
5. **Section ordering**: Verify sections are in standard SDD order (1-18)

Report any validation errors as `[ASSEMBLY ISSUE: <description>]` at the top of the spec.

---

## Spec File Header

Every finalized spec file SHALL begin with this YAML-style header:

```markdown
---
source: retro-spec
legacy_path: <path to legacy source>
legacy_language: <language>
target_language: <target language>
confidence_overall: <percentage>
generated_at: <ISO 8601 timestamp>
status: Draft
version: "1.0"
---
```
