---
name: spec-requirements
description: "Produces functional requirements, NFRs, constraints, and out-of-scope sections"
argument-hint: "Invoked by Spec Architect Coordinator - do not call directly"
---

# spec-requirements - Functional Requirements Skill

This skill is invoked by the Spec Architect Coordinator as a subagent. It produces Section 4 (Functional Requirements), Section 10 (Non-Functional Requirements), Section 12 (Constraints & Assumptions), and Section 13 (Out of Scope) of the specification.

## Input Contract

This skill receives the following inputs via the coordinator's subagent prompt:

| # | Input | Description |
|---|-------|-------------|
| 1 | `skill_path` | Path to this SKILL.md file |
| 2 | `accumulator_path` | Path to the spec file being built |
| 3 | `artifacts_dir` | Path to the companion artifacts directory |
| 4 | `brief_path` | Path to the source ideation brief |
| 5 | `research_summary` | Key findings from the research phase |
| 6 | `section_numbers` | `4, 10, 12, 13` |
| 7 | `patterns` | Active spec-domain patterns to avoid |
| 8 | `target_language` | Programming language for artifacts (not used by this skill) |

## Execution Sequence

1. **Read this SKILL.md** to load instructions and guidelines
2. **Read the accumulator** at `accumulator_path` to understand sections 1-3 (Overview, Goals, Users & Roles)
3. **Read the brief** at `brief_path` for full context on what is being built. Read accumulator and brief in parallel.
4. **Write sections 4, 10, 12, 13** to the accumulator by APPENDING after existing content
5. **Produce artifacts** - N/A (this skill produces no companion artifacts)

## Constraints

- Do NOT modify sections 1, 2, or 3 (coordinator-owned sections)
- Do NOT modify any sections written by earlier skills
- If you discover an inconsistency with a prior section, add: `[CROSS-REF ISSUE: <description>]`
- Use `[NEEDS CLARIFICATION: <reason>]` for any unresolved decisions
- Use plain ASCII only - no em dashes, smart quotes, or curly apostrophes

---

## Section 4 - Functional Requirements (FR-029, FR-032)

Write Section 4 organized by **feature area**. Group related requirements under subsections named after the feature area.

### FR Format

Every functional requirement SHALL follow this exact format:

```markdown
- **FR-XXX**: The system SHALL [obligation statement].
  - Precondition: [state that must be true before this FR applies, or "None"]
  - Postcondition: [expected state after the FR is satisfied]
  - Error: [what happens when the happy path fails]
```

### Requirements Rules

1. **SHALL or SHALL NOT** - Every requirement uses obligation language per RFC 2119. Never use "should", "could", "might", or "may".
2. **Unique FR-XXX identifiers** - Number sequentially starting from FR-001. Never reuse or skip numbers.
3. **Preconditions** - State what must be true before the requirement applies. Write "None" if trivial.
4. **Postconditions** - Describe the expected system state after the requirement is satisfied.
5. **Error behavior** - Every FR defines what happens on failure. No exceptions.
6. **Testable** - Every FR must be verifiable by a test. If you cannot write a test for it, it is too vague.
7. **No ambiguity** - Never use: "appropriate", "reasonable", "as needed", "etc.", "similar", "and/or", "optionally".

### Deep Business Logic -- Beyond Surface-Level FRs

FRs that only describe surface behavior ("the system SHALL create a user") produce shallow specifications that force the Coder to invent business logic. Every feature area SHALL also capture:

1. **Business Rules & Invariants**: Conditions the system MUST enforce at all times (e.g., "account balance SHALL NOT be negative", "order total SHALL equal sum of line items"). Document as FRs with the invariant as the obligation.
2. **Decision Logic**: When a feature has non-trivial conditional behavior (e.g., discount tiers, approval routing, permission escalation), document each branch as a separate FR or add a decision table:
   ```markdown
   | Condition | Outcome | FR Ref |
   |-----------|---------|--------|
   | order.total < 50 | No discount | FR-XXX |
   | order.total >= 50 AND < 200 | 10% discount | FR-XXX |
   | order.total >= 200 | 20% discount + free shipping | FR-XXX |
   ```
3. **Computed Values**: When a feature computes or derives values, document the formula explicitly in the FR (e.g., "The system SHALL compute `tax_amount` as `subtotal * tax_rate` where `tax_rate` is determined by the shipping address jurisdiction").
4. **Side Effects**: When an operation triggers secondary actions (events, notifications, cache invalidation, audit logging), document each as a separate FR (e.g., "The system SHALL emit an `OrderPlaced` event after successfully creating an order").
5. **Temporal Rules**: Time-based constraints that affect business behavior (e.g., "The system SHALL reject password resets requested within 5 minutes of the previous reset request").

The goal is that a Coder reading the spec can implement the COMPLETE business behavior without needing to invent or infer any logic.

### Implementation Contract Subsections

Every feature area in Section 4 SHALL end with an Implementation Contract subsection:

```markdown
#### Implementation Contract -- <Feature Area>

**Inputs**: <description with types>
**Outputs**: <description with types>
**Error behaviors**:
- <error condition> -> <response/behavior>
- <error condition> -> <response/behavior>
```

Contracts SHALL be specific enough for a Coder agent to implement without interpretation. Include:
- Input parameter names, types, and validation constraints
- Output field names, types, and structure
- Exhaustive error-to-response mapping (not just "returns an error")
- Business rules that apply during this operation (invariants to enforce, computed values to derive)
- Side effects triggered by successful completion (events, notifications, cache updates)
- Decision logic tables for non-trivial branching within this feature area

### Organization Pattern

```markdown
## 4. Functional Requirements

### 4.1 <Feature Area Name>

- **FR-001**: The system SHALL ...
  - Precondition: ...
  - Postcondition: ...
  - Error: ...

- **FR-002**: The system SHALL ...
  - Precondition: ...
  - Postcondition: ...
  - Error: ...

#### Implementation Contract -- <Feature Area Name>

**Inputs**: ...
**Outputs**: ...
**Error behaviors**: ...

---

### 4.2 <Next Feature Area>

...
```

---

## Section 10 - Non-Functional Requirements (FR-030)

Write Section 10 covering ALL of the following categories. Each NFR SHALL have a unique NFR-XXX identifier and a measurable target.

### Required Categories

1. **Performance** - Response time targets (with percentiles: p50, p95, p99), throughput limits, resource consumption bounds
2. **Security** - High-level security posture (the spec-security skill will expand Section 10.2 in detail later)
3. **Scalability** - Concurrency limits, data volume expectations, growth patterns
4. **Accessibility** - WCAG compliance level, keyboard navigation, screen reader support (if applicable)
5. **Observability** - Logging requirements, metrics, alerting, tracing

### NFR Format

```markdown
- **NFR-XXX**: The system SHALL [measurable requirement with specific target].
```

Bad example: "The system should be fast." (vague, no target, uses "should")
Good example: "The system SHALL respond to API requests within 200ms at p95 under normal load (up to 100 concurrent users)."

### Organization Pattern

```markdown
## 10. Non-Functional Requirements

### 10.1 Performance

- **NFR-001**: The system SHALL ...

### 10.2 Security

<Brief overview. The spec-security skill will expand this subsection.>

### 10.3 Scalability

- **NFR-XXX**: The system SHALL ...

### 10.4 Accessibility

- **NFR-XXX**: The system SHALL ...

### 10.5 Observability

- **NFR-XXX**: The system SHALL ...
```

---

## Section 12 - Constraints & Assumptions (FR-031)

Write Section 12 listing:

### Constraints

Technical, organizational, regulatory, or resource constraints that limit design choices. Each constraint SHALL explain its impact on the system design.

```markdown
### 12.1 Constraints

| # | Constraint | Impact |
|---|-----------|--------|
| C-01 | <constraint> | <how it affects design> |
```

### Assumptions

Conditions assumed to be true that, if violated, would require spec revision. Each assumption SHALL state the consequence of being wrong.

```markdown
### 12.2 Assumptions

| # | Assumption | If wrong |
|---|-----------|----------|
| A-01 | <assumption> | <consequence> |
```

---

## Section 13 - Out of Scope (FR-031)

Write Section 13 as a bulleted list of features, behaviors, or capabilities explicitly excluded from this specification. For each item, briefly explain WHY it is out of scope (deferred to future version, separate project, not needed, etc.).

```markdown
## 13. Out of Scope

- **<Feature/Capability>**: <reason for exclusion>
- **<Feature/Capability>**: <reason for exclusion>
```

---

## Quality Checklist

Before finishing, verify your output against these checks:

1. [ ] Every FR uses SHALL or SHALL NOT (search for "should", "could", "might" - there should be zero)
2. [ ] Every FR has Precondition, Postcondition, and Error defined
3. [ ] Every feature area has an Implementation Contract subsection
4. [ ] FR numbers are sequential with no gaps or duplicates
5. [ ] NFRs have measurable targets (numbers, percentiles, thresholds)
6. [ ] No ambiguous language: "appropriate", "reasonable", "as needed", "etc.", "similar"
7. [ ] All `[NEEDS CLARIFICATION]` markers include a specific reason
8. [ ] Section 10.2 (Security) is a placeholder for the security skill to expand
9. [ ] Constraints table includes impact column
10. [ ] Assumptions table includes "if wrong" column
11. [ ] Out of scope items include exclusion rationale
12. [ ] Active patterns from the coordinator prompt have been followed
