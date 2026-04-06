---
name: review-docs
description: "Documentation accuracy review skill. Compares .sdd/docs/ content against implementation for accuracy, completeness, and staleness."
argument-hint: "Invoked by Review Coordinator - do not call directly"
---

# review-docs - Documentation Accuracy Review Skill

This skill is invoked by the Review Coordinator as a subagent. It compares documentation files in `.sdd/docs/` against the actual implementation to detect inaccuracies, stale content, and missing documentation.

**Input contract** (received via subagent prompt):
1. Read this SKILL.md file for review instructions.
2. Read the specification file for documentation requirements.
3. Read the WP file to identify what was implemented.
4. Read all `.sdd/docs/` files and compare against the actual codebase.
5. Evaluate each checklist item below.
6. Write structured findings to the specified output path.
7. Return a brief summary (counts of PASS/WARN/FAIL/N/A).

**Constraint**: Do NOT modify any documentation files, source code, the WP file, or the spec file. Only write to the specified output path (FR-028).

---

## Documentation Checklist

The project maintains 6 standard documentation files under `.sdd/docs/`. For each file, compare the documented content against the actual implementation.

### Category 1: Architecture Docs (FR-046.1)
- [ ] Does `.sdd/docs/architecture.md` exist and contain substantive content?
- [ ] Does the documented module structure match the real directory layout?
- [ ] Do documented component relationships match actual imports and dependencies?
- [ ] Are all components implemented in this WP reflected in the architecture docs?

### Category 2: API Reference (FR-046.2)
- [ ] Does `.sdd/docs/api-reference.md` exist and contain substantive content?
- [ ] Do documented endpoints match actual route definitions?
- [ ] Do documented parameters (names, types, required/optional) match actual code?
- [ ] Do documented response schemas match actual response structures?
- [ ] Do documented error codes match actual error handling?

### Category 3: Configuration Guide (FR-046.3)
- [ ] Does `.sdd/docs/configuration-guide.md` exist and contain substantive content?
- [ ] Do documented environment variables match actual env var usage in code?
- [ ] Do documented default values match actual defaults in code?
- [ ] Are all configuration options used in the WP's code documented?

### Category 4: Data Model Docs (FR-046.4)
- [ ] Are data entities, fields, and types documented accurately?
- [ ] Do documented relationships match actual schema definitions?
- [ ] Are validation rules documented and consistent with code?

### Category 5: User Guide (FR-046.5)
- [ ] Does `.sdd/docs/user-guide.md` exist and contain substantive content?
- [ ] Do documented user flows match actual application behavior?
- [ ] Are new features from this WP reflected in the user guide?

### Category 6: Developer Guide (FR-046.6)
- [ ] Does `.sdd/docs/developer-guide.md` exist and contain substantive content?
- [ ] Do setup instructions match actual project requirements?
- [ ] Does documented project structure match the actual directory layout?
- [ ] Are coding conventions documented and consistent with the codebase?

### Category 7: Deployment Guide (FR-046.7)
- [ ] Does `.sdd/docs/deployment-guide.md` exist and contain substantive content?
- [ ] Do documented prerequisites match actual deployment requirements?
- [ ] Does the deployment process match actual infrastructure needs?

### Category 8: Staleness (FR-046.8)
- [ ] Are there references to functions, endpoints, or env vars that no longer exist?
- [ ] Are there references to removed features or deprecated behavior?
- [ ] Are there outdated code examples that no longer compile or run?
- [ ] Are version numbers or dependency references current?

### Category 9: Completeness (FR-046.9)
- [ ] Do all 6 standard doc files exist under `.sdd/docs/`?
- [ ] Are any of the 6 files empty or contain only boilerplate headers?
- [ ] Are all public APIs, config options, and workflows covered?

---

## Severity Guidance (FR-047)

### FAIL - Must fix before approval
- Missing or empty required documentation files
- Inaccurate content: documented behavior contradicts actual implementation
- Stale content that references removed features as if they still exist

### WARN - Should address, does not block approval
- Minor omissions: a parameter missing from an otherwise accurate API doc
- Slightly outdated examples that still convey correct concepts
- Documentation exists but could be more detailed

### N/A - Not applicable
Use N/A with justification when a category does not apply. Example justifications:
- "No API endpoints in this WP" for API Reference checks
- "No environment variables introduced" for Configuration Guide checks
- "No user-facing features in this WP" for User Guide checks

---

## Output Format

Write findings to the specified output path using the format below. Finding IDs use the `DOC-` prefix.

```markdown
---
skill: review-docs
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
  - .sdd/docs/architecture.md
  - .sdd/docs/api-reference.md
  - .sdd/docs/configuration-guide.md
  - .sdd/docs/user-guide.md
  - .sdd/docs/developer-guide.md
  - .sdd/docs/deployment-guide.md
---

# review-docs Findings for <WP-ID>

## Summary

<Brief overview: doc files checked, accuracy assessment, staleness findings.>

## Findings

### DOC-001 [FAIL]
- **Checklist item**: API Reference - Endpoint mismatch
- **Requirement**: FR-046 category 2
- **File**: .sdd/docs/api-reference.md#L45
- **Description**: API reference documents GET /users/:id but implementation uses GET /api/v1/users/:id.
- **Expected**: API reference path should match actual route definition.
- **Evidence**: Route defined in src/routes/users.js#L12 as `/api/v1/users/:id`.

### DOC-002 [WARN]
- **Checklist item**: Configuration Guide - Missing parameter
- **Requirement**: FR-046 category 3
- **File**: .sdd/docs/configuration-guide.md
- **Description**: Environment variable LOG_FORMAT is used in code but not documented.
- **Expected**: All env vars should be listed with type, default, and description.
- **Evidence**: `os.getenv("LOG_FORMAT", "json")` found in src/config.py#L18.

### DOC-003 [N/A]
- **Checklist item**: Deployment Guide - Prerequisites
- **Justification**: No deployment changes in this WP. Deployment guide remains accurate.
```
