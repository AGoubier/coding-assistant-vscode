---
name: review-architecture
description: "Architecture adherence review skill. Evaluates component design, tech stack compliance, directory structure, SOLID principles, dependency direction, and scope discipline."
argument-hint: "Invoked by Review Coordinator - do not call directly"
---

# review-architecture - Architecture Adherence Review Skill

This skill is invoked by the Review Coordinator as a subagent. It evaluates whether the implementation follows the architecture defined in the specification, checking component design, technology choices, directory layout, design principles, and scope discipline.

**Input contract** (received via subagent prompt):
1. Read this SKILL.md file for review instructions.
2. Read the specification file, focusing on Sections 9.1-9.4 (architecture).
3. Read the WP file to identify in-scope tasks and declared scope.
4. Discover and read all implementation files modified or created by this WP. Use `#tool:search/searchSubagent` with the `Explore` agent to efficiently discover WP-scoped files. Use `#tool:read/problems` to check for structural issues.
5. Evaluate each checklist item below against the discovered code.
6. Write structured findings to the specified output path.
7. Return a brief summary (counts of PASS/WARN/FAIL/N/A).

**Constraint**: Do NOT modify any source code, the WP file, or the spec file. Only write to the specified output path (FR-028).

---

## Architecture Adherence Checklist

Before evaluating, gather context:
- Read the spec's Section 9 (Architecture) for the authoritative design
- Read the WP's task descriptions to determine the declared scope of changes
- Use `get_changed_files` or `git diff` against the WP's branch to identify all files modified
- Build a map of which files were created/modified and which WP tasks they belong to

### Dimension 1: Component Adherence (FR-042.1)
- [ ] Do implemented components match the system design in spec Section 9.1?
- [ ] Are component boundaries respected (no logic leaking across component interfaces)?
- [ ] Are all components required by the WP's FRs actually implemented?
- [ ] Are any components implemented that are NOT described in the spec?

### Dimension 2: Technology Stack Compliance (FR-042.2)
- [ ] Do all technologies used (languages, frameworks, libraries) match spec Section 9.2?
- [ ] Are there any unauthorized technology substitutions?
- [ ] Are dependency versions within the ranges specified (if the spec constrains versions)?
- [ ] Are there any new dependencies added that are not listed in the spec's technology table?

### Dimension 3: Directory Structure Compliance (FR-042.3)
- [ ] Do file locations match the directory structure defined in spec Section 9.3?
- [ ] Are files placed in the correct modules/packages per the architecture?
- [ ] Are there any files created outside the expected directory structure?
- [ ] Do new directories follow the naming conventions established in the spec?

### Dimension 4: Key Design Decisions (FR-042.4)
- [ ] Are architectural decisions from spec Section 9.4 honored in the implementation?
- [ ] If the spec prescribes specific patterns (e.g., repository pattern, event-driven), are they used?
- [ ] Are there any deviations from documented design decisions? If so, are they justified?

### Dimension 5: Separation of Concerns (FR-042.5)
- [ ] Does each module/class have a single clear responsibility?
- [ ] Are there any "god objects" or "god modules" that handle too many concerns?
- [ ] Is business logic separated from infrastructure concerns (I/O, persistence, transport)?
- [ ] Are cross-cutting concerns (logging, auth, validation) handled consistently?

### Dimension 6: SOLID Principles (FR-042.6)
- [ ] **Single Responsibility**: Does each class/module have one reason to change?
- [ ] **Open/Closed**: Are modules open for extension but closed for modification where applicable?
- [ ] **Liskov Substitution**: Do subtypes/implementations honor their parent contracts?
- [ ] **Interface Segregation**: Are interfaces focused and minimal (no forced empty implementations)?
- [ ] **Dependency Inversion**: Do high-level modules depend on abstractions, not concrete implementations?

### Dimension 7: Dependency Direction (FR-042.7)
- [ ] Do dependencies flow from higher-level to lower-level modules per the architecture?
- [ ] Are there any circular dependencies between modules?
- [ ] Do import/require statements point in the correct direction?
- [ ] Are there any lower-level modules importing from higher-level modules?

### Dimension 8: Scope Discipline (FR-042.8)
- [ ] Is all created/modified code traceable to a specific WP task?
- [ ] Are there any files modified that fall outside the WP's declared scope?
- [ ] Are there any unspecified features, abstractions, or utilities added?
- [ ] Are there any "nice to have" improvements that were not requested?
- [ ] Are there any refactorings of code not touched by WP tasks?
- [ ] Do helper functions created serve a direct need of a WP task (not speculative reuse)?

**Note on scope discipline**: Helper functions and utilities directly required by WP tasks are in scope. Only flag code with zero traceability to any WP task. When in doubt, check if removing the code would break any WP task's acceptance criteria.

---

## Severity Guidance (FR-043)

### FAIL - Must fix before approval
- Scope creep: code with no traceability to any WP task
- Technology stack violations: unauthorized technologies, unapproved dependencies
- Component design violations: components not in the spec, logic in wrong component
- Circular dependencies between modules

### WARN - Should address, does not block approval
- Minor SRP concerns: a module handles two related responsibilities
- Minor structural deviations: file in a slightly different location than spec suggests
- Dependency direction suggestions: a dependency could be inverted for cleaner design
- Missing design pattern usage where spec recommends but does not mandate

### N/A - Not applicable
Use N/A with justification when a checklist dimension does not apply to this WP. Example justifications:
- "No new components created in this WP - only modifying existing files"
- "Spec Section 9.2 does not constrain technology choices for this domain"
- "WP does not introduce any new module dependencies"

---

## Output Format

Write findings to the specified output path using the format below. Finding IDs use the `ARCH-` prefix.

```markdown
---
skill: review-architecture
wp: <WP-ID>
spec: <spec-path>
reviewed_at: <ISO-8601-timestamp>
status: completed
finding_counts:
  pass: <count>
  warn: <count>
  fail: <count>
  na: <count>
files_reviewed:
  - <file-1>
  - <file-2>
---

# review-architecture Findings for <WP-ID>

## Summary

<Brief overview: files analyzed, architecture compliance assessment, scope discipline evaluation.>

## Findings

### ARCH-001 [FAIL]
- **Checklist item**: Scope Discipline - Unspecified code
- **Requirement**: FR-042 dimension 8
- **File**: src/utils/cache.py
- **Description**: Cache utility module was created but is not specified in any WP task.
- **Expected**: Only implement code required by WP tasks. Remove unspecified utilities.
- **Evidence**: No WP task references a cache module. The spec does not mention caching.

### ARCH-002 [PASS]
- **Checklist item**: Component Adherence - Spec alignment
- **Requirement**: FR-042 dimension 1
- **File**: src/api/users.py
- **Description**: Users API component matches spec Section 9.1 component diagram.

### ARCH-003 [WARN]
- **Checklist item**: Separation of Concerns - Mixed responsibilities
- **Requirement**: FR-042 dimension 5
- **File**: src/api/handlers.py#L45-L80
- **Description**: Request handler contains both input validation and business logic.
- **Expected**: Validation should be separated from core business logic.
- **Evidence**:
  ```python
  def create_user(request):
      # validation mixed with business logic
      if not request.email:
          raise ValueError("Email required")
      user = User(email=request.email)
      db.save(user)
  ```

### ARCH-004 [N/A]
- **Checklist item**: Dependency Direction - Module imports
- **Justification**: WP does not introduce any new module dependencies. All files are standalone skills.
```

---

## Quality Checklist

Before completing, verify:

- [ ] All 8 architecture dimensions are evaluated
- [ ] Every finding references a specific checklist item and requirement
- [ ] Evidence includes file paths with line numbers and code snippets
- [ ] N/A findings include a justification
- [ ] YAML frontmatter includes `finding_counts` and `files_reviewed`
- [ ] Verdict follows REVIEW-SKILL-CONTRACT aggregation rules
- [ ] No findings are duplicated across dimensions
