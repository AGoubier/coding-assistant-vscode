---
name: spec-traceability
description: "Produces traceability matrix, glossary, references, and version history"
argument-hint: "Invoked by Spec Architect Coordinator - do not call directly"
---

# spec-traceability - Traceability & Completeness Skill

This skill is invoked by the Spec Architect Coordinator as the LAST skill in the chain. It produces sections 14-18 and performs final cross-spec validation to catch orphan FRs, orphan USes, and traceability gaps.

## Input Contract

This skill receives the following inputs via the coordinator's subagent prompt:

| # | Input | Description |
|---|-------|-------------|
| 1 | `skill_path` | Path to this SKILL.md file |
| 2 | `accumulator_path` | Path to the spec file being built |
| 3 | `artifacts_dir` | Path to the companion artifacts directory |
| 4 | `brief_path` | Path to the source ideation brief |
| 5 | `research_summary` | Key findings from the research phase |
| 6 | `section_numbers` | `14, 15, 16, 17, 18` |
| 7 | `patterns` | Active spec-domain patterns to avoid |
| 8 | `target_language` | Programming language for artifacts (not used by this skill) |

## Execution Sequence

1. **Read this SKILL.md** to load instructions and guidelines
2. **Read the ENTIRE accumulator** at `accumulator_path` (sections 1-11 -- all prior skills' output)
3. **Read the brief** at `brief_path` for context. Read accumulator and brief in parallel.
4. **Write sections 14, 15, 16, 17, 18** to the accumulator by APPENDING after existing content
5. **Produce artifacts** - N/A (this skill produces no companion artifacts)

## Constraints

- Do NOT modify sections 1 through 11 (all earlier sections)
- If you discover an inconsistency, add: `[CROSS-REF ISSUE: <description>]`
- Use plain ASCII only - no em dashes, smart quotes, or curly apostrophes
- The traceability matrix SHALL have NO empty cells

---

## Section 14 - Open Questions (FR-053)

Collect ALL unresolved decisions from the entire spec. Scan ALL sections (1-11) for `[NEEDS CLARIFICATION]` markers and any other unresolved items.

```markdown
## 14. Open Questions

| # | Question | Impact | Owner | Section |
|---|---------|--------|-------|---------|
| OQ-01 | <question> | <what is blocked or uncertain> | <who should answer> | <source section> |
```

If no open questions remain, write: "No open questions. All decisions resolved during specification."

---

## Section 15 - Glossary (FR-053)

Define key terms, acronyms, and domain concepts used throughout the spec. Sort alphabetically.

```markdown
## 15. Glossary

| Term | Definition |
|------|-----------|
| <term> | <concise definition> |
```

Include:
- Domain-specific terms from the brief
- Technical terms introduced in the spec (e.g., "accumulator", "companion artifact")
- Acronyms (FR, NFR, US, BDD, RBAC, OWASP, etc.)
- Enum values and their meanings (from Section 7 state machines)

---

## Section 16 - Traceability Matrix (FR-053, FR-054)

Build a comprehensive matrix mapping every FR to its user story, acceptance scenario, test type, and test section reference.

```markdown
## 16. Traceability Matrix

| FR ID | Requirement Summary | User Story | Acceptance Scenario | Test Type | Test Section Ref |
|-------|-------------------|------------|--------------------|-----------|----|
| FR-001 | <brief summary> | US-01 | Scenario 1 | BDD | 11.2 |
| FR-001 | <brief summary> | US-01 | Scenario 2 (error) | BDD | 11.2 |
| FR-002 | <brief summary> | US-02 | Scenario 1 | unit, BDD | 11.1, 11.2 |
```

### Building the Matrix

For each FR-XXX found in Section 4:

1. **Find mapped US**: Search Section 5 for user stories that reference or implement this FR
2. **Find acceptance scenarios**: For each mapped US, list each Given/When/Then scenario
3. **Find test type**: Search Section 11 for corresponding tests (unit=11.1, BDD=11.2, integration=11.3, E2E=11.4, perf=11.5, security=11.6)
4. **Fill the row**: Every column must have a value

### No Empty Cells Rule (FR-054)

The traceability matrix SHALL have NO empty cells:

- **FR ID**: Always filled (source: Section 4)
- **Requirement Summary**: Always filled (brief description of the FR)
- **User Story**: At least one US-XX. If no US covers this FR, attempt to identify the closest match
- **Acceptance Scenario**: At least one scenario reference. If none exists, note the gap
- **Test Type**: At least one test type (unit, BDD, integration, E2E, performance, security)
- **Test Section Ref**: At least one section reference (11.1, 11.2, etc.)

If any cell CANNOT be filled after cross-referencing:
```
[TRACEABILITY GAP: FR-XXX has no <missing column>]
```

Use `[TRACEABILITY GAP]` markers, NEVER leave cells empty.

---

## Section 17 - Technical References (FR-053)

List all sources consulted during the specification process, grouped by topic.

```markdown
## 17. Technical References

### Architecture
- <title>. <URL>. Accessed <date>.

### Security
- OWASP Top 10 (2021). https://owasp.org/www-project-top-ten/. Accessed <date>.

### Standards & RFCs
- RFC 2119 - Key words for use in RFCs. https://datatracker.ietf.org/doc/html/rfc2119

### Frameworks & Libraries
- <framework> documentation. <URL>. Version <X>.
```

Derive references from:
- The research summary provided by the coordinator
- URLs mentioned in any spec section
- Standards referenced (RFC 2119 for SHALL, OWASP, etc.)

---

## Section 18 - Version History (FR-053)

```markdown
## 18. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | <today's date> | Spec Architect | Initial specification |
```

---

## Orphan Detection (MANDATORY) (FR-055)

After completing the traceability matrix, perform orphan detection:

### 1. Orphan FR Check
Scan Section 4 for ALL FR-XXX identifiers (use regex pattern `FR-\d{3}` across all subsections, not just top-level). Verify each appears in at least one row of the traceability matrix.

Flag missing:
```
[TRACEABILITY GAP: FR-XXX has no entry in traceability matrix]
```

### 2. Orphan US Check
Scan Section 5 for ALL US-XX identifiers. Verify each is referenced in at least one row of the traceability matrix.

Flag missing:
```
[TRACEABILITY GAP: US-XX not referenced in traceability matrix]
```

### 3. Orphan Test Check
Scan Section 11.2 for ALL Gherkin scenarios. Verify each has a `# Source: US-XX` reference that maps to a real acceptance scenario in Section 5.

Flag missing:
```
[TRACEABILITY GAP: Gherkin scenario "<title>" has no acceptance scenario source in Section 5]
```

### 4. Completeness Report

At the end of Section 16, add a summary:

```markdown
### Traceability Summary

- Total FRs: <count>
- Total USes: <count>
- Total Gherkin scenarios: <count>
- Matrix rows: <count>
- Traceability gaps: <count> (0 = complete)
- Orphan FRs: <count>
- Orphan USes: <count>
- Orphan tests: <count>
```

---

## Quality Checklist

1. [ ] All 5 sections (14-18) are present
2. [ ] Open questions list includes all `[NEEDS CLARIFICATION]` markers from entire spec
3. [ ] Glossary is alphabetically sorted with all domain terms
4. [ ] Traceability matrix has NO empty cells
5. [ ] Every FR from Section 4 appears in at least one matrix row
6. [ ] Every US from Section 5 appears in at least one matrix row
7. [ ] Orphan detection completed: orphan FRs, USes, and tests reported
8. [ ] Completeness report added with counts
9. [ ] Technical references include all sources from research
10. [ ] Version history has initial entry
11. [ ] Active patterns from the coordinator prompt have been followed
