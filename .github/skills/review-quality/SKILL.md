---
name: review-quality
description: "Code quality review skill. Evaluates readability, complexity, naming, comments, error handling, style consistency, dead code, and duplication."
argument-hint: "Invoked by Review Coordinator - do not call directly"
---

# review-quality - Code Quality Review Skill

This skill is invoked by the Review Coordinator as a subagent. It evaluates implementation code quality across 8 dimensions, enforcing objective standards based on codebase conventions - not subjective preferences.

**Input contract** (received via subagent prompt):
1. Read this SKILL.md file for review instructions.
2. Read the specification file for context.
3. Discover and read all implementation code relevant to this WP.
4. Evaluate each checklist item below against the discovered code.
5. Write structured findings to the specified output path.
6. Return a brief summary (counts of PASS/WARN/FAIL/N/A).

**Constraint**: Do NOT modify any source code, the WP file, or the spec file. Only write to the specified output path.

**Critical rule (FR-039)**: Do NOT enforce subjective style preferences. Only flag deviations from EXISTING codebase patterns. If you cannot determine the codebase convention for a style question, do not flag it.

---

## Code Quality Checklist

Before evaluating, discover existing codebase patterns first: naming conventions (camelCase vs snake_case), indentation style, import ordering, module structure. These become the baseline for consistency checks.

### Dimension 1: Readability
- [ ] Are functions concise and single-purpose (under 50 lines of meaningful code)?
- [ ] Is control flow straightforward with low nesting depth (no more than 3 levels)?
- [ ] Is the code understandable without needing extensive comments to explain it?
- [ ] Are complex expressions broken into named intermediate variables?

### Dimension 2: Complexity
- [ ] Do all functions have estimated cyclomatic complexity <= 10?
  Count branching points: if/elif/else, for, while, try/except, ternary, boolean operators (and/or) in conditions.
- [ ] Are deeply nested conditionals (4+ levels) refactored into early returns or helper functions?
- [ ] Are complex boolean expressions simplified or extracted into named predicates?

### Dimension 3: Naming Quality
- [ ] Do variables, functions, classes, and modules have descriptive, intention-revealing names?
- [ ] Are there any single-letter variable names outside of loop counters (i, j, k)?
- [ ] Are there any misleading names (name does not match actual behavior)?
- [ ] Is naming consistent with the codebase's established conventions?

### Dimension 4: Comment Quality
- [ ] Do comments explain "why" rather than restating "what" the code does?
- [ ] Is there any commented-out code that should be removed?
- [ ] Are there redundant comments that simply restate the code?
- [ ] Are TODO/FIXME/HACK markers present? (Flag as WARN - these indicate deferred work)

### Dimension 5: Error Handling
- [ ] Are all errors handled explicitly (no bare `except:` in Python, no empty `catch {}` blocks)?
- [ ] Are exception types specific (not generic catch-all)?
- [ ] Are error messages descriptive and actionable?
- [ ] Is error recovery graceful (does the system degrade safely)?
- [ ] Are exceptions not silently swallowed (caught and ignored without logging or re-raising)?

### Dimension 6: Style and Consistency
- [ ] Does the code follow the codebase's established patterns for indentation, bracket style, and formatting?
- [ ] Is import ordering consistent with existing modules?
- [ ] Does module structure match the project's conventions?
- [ ] Were any inconsistencies introduced by this WP that deviate from existing patterns?

### Dimension 7: Dead Code
- [ ] Are all declared functions, classes, and methods referenced somewhere?
- [ ] Are all imported modules/symbols actually used?
- [ ] Is there any unreachable code (code after return, throw, break, or continue)?
- [ ] Are all declared variables read after assignment?

Note: Framework hooks, lifecycle methods, signal handlers, and route handlers are NOT dead code even if not explicitly called. Only flag symbols with zero references AND no framework registration.

### Dimension 8: Duplication
- [ ] Is there significant code duplication (3+ lines of identical or near-identical logic in multiple locations)?
- [ ] Are there copy-pasted blocks with only minor variable name differences?
- [ ] Could duplicated logic be extracted into a shared helper function?

---

## Severity Rules

| Finding type | Severity |
|-------------|----------|
| Dead code: declared but never referenced symbols | FAIL |
| Unreachable code paths | FAIL |
| Bare exception handlers / empty catch blocks | FAIL |
| Silently swallowed exceptions | FAIL |
| Cyclomatic complexity > 10 | WARN |
| Cyclomatic complexity > 20 | FAIL |
| Naming issues (misleading, single-letter outside loops) | WARN |
| Comment issues (TODO/FIXME/HACK, commented-out code) | WARN |
| Style inconsistencies (deviations from codebase patterns) | WARN |
| Code duplication (3+ lines) | WARN |
| Readability concerns (long functions, deep nesting) | WARN |

**Escalation rule**: 3+ WARN-level issues of the same type in the same file indicate a systemic quality problem. Note this pattern in the findings but do not escalate to FAIL unless individual items cross FAIL thresholds above.

**Non-applicable items**: Mark as N/A with justification when a dimension does not apply (e.g., "No database code in this WP, SQL duplication check N/A").

---

## Output Format

Write findings to the specified output path using this exact format:

### YAML Frontmatter

```yaml
---
skill: review-quality
wp: <WP-id>
spec: <spec_path>
reviewed_at: <ISO 8601 timestamp>
status: completed
finding_counts:
  pass: <count>
  warn: <count>
  fail: <count>
  na: <count>
files_reviewed:
  - <file1>
  - <file2>
---
```

### Findings Body

```markdown
# review-quality Findings for <WP-id>

## Summary

<Brief overview: files reviewed, overall code quality assessment, key concerns.>

## Findings

### QUAL-001 [FAIL]
- **Checklist item**: Dead Code - Unused function
- **Requirement**: FR-037 dimension 7
- **File**: <file_path>#L<start>-L<end>
- **Description**: Function `process_legacy()` is defined but never called anywhere.
- **Expected**: Remove unused function or document why it is retained.
- **Evidence**: Search for `process_legacy` returns only the definition, no call sites.

### QUAL-002 [WARN]
- **Checklist item**: Complexity - High cyclomatic complexity
- **Requirement**: FR-037 dimension 2
- **File**: <file_path>#L<start>-L<end>
- **Description**: Function has estimated cyclomatic complexity of 14.
- **Expected**: Refactor into smaller functions or simplify branching logic. Threshold: 10.
- **Evidence**: 14 branching points counted (6 if/elif, 3 for, 2 try/except, 3 boolean operators).

### QUAL-003 [N/A]
- **Checklist item**: Duplication - SQL pattern duplication
- **Justification**: No SQL or database code in this WP.
```

### Rules

- Finding IDs use prefix `QUAL-` and are sequential: QUAL-001, QUAL-002, etc. No gaps.
- Every FAIL/WARN finding MUST include: Checklist item, Requirement, File (with line range), Description, Expected, Evidence.
- Every PASS finding MUST include: Checklist item, Requirement, File, Description.
- Every N/A finding MUST include: Checklist item, Justification.
- `finding_counts` MUST accurately reflect the actual findings in the file.
- `files_reviewed` MUST list every file read and evaluated during this review.
