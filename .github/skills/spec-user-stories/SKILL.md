---
name: spec-user-stories
description: "Produces user stories, acceptance scenarios, edge cases, and user flows"
argument-hint: "Invoked by Spec Architect Coordinator - do not call directly"
---

# spec-user-stories - User Stories & Flows Skill

This skill is invoked by the Spec Architect Coordinator as a subagent. It produces Section 5 (User Stories) and Section 6 (User Flows) of the specification.

## Input Contract

This skill receives the following inputs via the coordinator's subagent prompt:

| # | Input | Description |
|---|-------|-------------|
| 1 | `skill_path` | Path to this SKILL.md file |
| 2 | `accumulator_path` | Path to the spec file being built |
| 3 | `artifacts_dir` | Path to the companion artifacts directory |
| 4 | `brief_path` | Path to the source ideation brief |
| 5 | `research_summary` | Key findings from the research phase |
| 6 | `section_numbers` | `5, 6` |
| 7 | `patterns` | Active spec-domain patterns to avoid |
| 8 | `target_language` | Programming language for artifacts (not used by this skill) |

## Execution Sequence

1. **Read this SKILL.md** to load instructions and guidelines
2. **Read the accumulator** at `accumulator_path` to understand sections 1-4, 10, 12, 13 (everything spec-requirements wrote)
3. **Read the brief** at `brief_path` for full context
4. **Write sections 5, 6** to the accumulator by APPENDING after existing content
5. **Produce artifacts** - N/A (this skill produces no companion artifacts)

## Constraints

- Do NOT modify sections 1 through 4, or sections 10, 12, 13 (earlier skills' sections)
- If you discover an inconsistency with a prior section, add: `[CROSS-REF ISSUE: <description>]`
- Use `[NEEDS CLARIFICATION: <reason>]` for any unresolved decisions
- Use plain ASCII only - no em dashes, smart quotes, or curly apostrophes

---

## Section 5 - User Stories (FR-033)

Write Section 5 with priority-ordered user stories. Stories SHALL be grouped by actor/role and ordered by priority within each group.

### User Story Format

Every user story SHALL follow this exact format:

```markdown
### US-XX -- <Title> (Priority: P1) MVP

**As a** <role>, **I want** <capability>, **so that** <benefit>.

**Why PX**: <rationale for chosen priority level>

**Independent Test**: <how to verify this story in isolation>

**Acceptance Scenarios**:
1. **Given** <precondition>, **When** <action>, **Then** <result> (happy path)
2. **Given** <precondition>, **When** <action>, **Then** <result> (error path)

### Edge Cases
- What happens when <edge case>? <answer>
```

### Story Rules

1. **Unique US-XX identifiers** - Number sequentially starting from US-01. Never reuse or skip numbers.
2. **Priority levels** - P1 (must have / MVP), P2 (should have / near-term), P3 (nice to have / future). Every story SHALL have a priority with rationale.
3. **MVP tag** - P1 stories include "MVP" after the priority. P2 and P3 stories do not.
4. **"As a / I want / so that"** - Every story follows this format. No exceptions.
5. **Independent Test** - Every story includes a concrete statement of how to verify it in isolation.
6. **Acceptance Scenarios** - Minimum 1 happy path + 1 error path per story, in Given/When/Then format.
7. **Edge Cases** - Every story includes at least one edge case with its resolution.
8. **Derived from FRs** - Every story SHALL trace back to at least one FR from Section 4.

### Priority Guideline

- **P1**: Core functionality without which the system is unusable. These form the MVP.
- **P2**: Important capabilities that enhance the core but are not blocking for initial release.
- **P3**: Desirable features for future iterations. Include to document scope awareness.

---

## Section 6 - User Flows (FR-034)

Write Section 6 with numbered step-by-step flows for each primary user journey.

### Flow Format

```markdown
### 6.X <Flow Name>

**Actor**: <role>
**Precondition**: <what must be true before this flow starts>
**Trigger**: <what initiates this flow>

1. **<Actor>** <action>
2. **System** <response>
3. **<Actor>** <action>
4. **System** <response>
   - *If <condition>*: <alternative path>
   - *If <condition>*: <alternative path>
5. **System** <final outcome>

**Postcondition**: <system state after successful completion>
```

### Flow Rules

1. **Numbered steps** - Every flow uses numbered steps. No prose paragraphs.
2. **Actor identification** - Bold the actor name at the start of each step.
3. **System responses** - Every actor action is followed by a system response (or explicitly noted as having none).
4. **Branching conditions** - Use indented italic text for conditional branches.
5. **Error paths** - Include at least one error/alternative path per flow.
6. **Coverage** - Write flows for all P1 user stories at minimum. P2 stories should have flows if the interaction is non-trivial.

---

## FR Cross-Reference Validation (FR-035)

After writing all stories and flows, perform a cross-reference check:

### Forward Check (US -> FR)
For every US-XX, verify it maps to at least one FR-XXX from Section 4. If a story has no backing FR, flag it:
```
[CROSS-REF ISSUE: US-XX has no backing functional requirement in Section 4]
```

### Reverse Check (FR -> US)
For every FR-XXX in Section 4, verify it is covered by at least one US-XX. List any orphan FRs as notes for the traceability skill:
```markdown
**FR-US Coverage Notes** (for traceability skill):
- FR-XXX: Not covered by any user story. Reason: <explanation>
```

This coverage data feeds into the traceability matrix (Section 16) written by the spec-traceability skill later.

---

## Quality Checklist

Before finishing, verify your output against these checks:

1. [ ] Every story uses "As a / I want / so that" format
2. [ ] Every story has a unique US-XX identifier, sequential with no gaps
3. [ ] Every story has Priority (P1/P2/P3) with rationale
4. [ ] Every story has at least 1 happy path + 1 error path acceptance scenario
5. [ ] Every story has at least 1 edge case
6. [ ] Every story has an Independent Test statement
7. [ ] P1 stories are tagged "MVP"
8. [ ] User flows have numbered steps with bold actor names
9. [ ] User flows include branching conditions and error paths
10. [ ] Forward FR cross-reference check passed (every US maps to an FR)
11. [ ] Reverse FR cross-reference check performed (orphan FRs documented)
12. [ ] No ambiguous language: "appropriate", "reasonable", "as needed", "etc.", "similar"
13. [ ] Active patterns from the coordinator prompt have been followed
