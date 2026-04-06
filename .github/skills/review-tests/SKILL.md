---
name: review-tests
description: "Test quality review skill. Evaluates test validity, coverage thresholds, BDD scenario matching, edge cases, test structure, and error path testing."
argument-hint: "Invoked by Review Coordinator - do not call directly"
---

# review-tests - Test Quality Review Skill

This skill is invoked by the Review Coordinator as a subagent. It evaluates all test files associated with a WP across 6 quality dimensions, checking that tests exercise real behavior and meet coverage thresholds.

**Input contract** (received via subagent prompt):
1. Read this SKILL.md file for review instructions.
2. Read the specification file for acceptance scenarios and BDD requirements.
3. Read the WP file to identify in-scope tasks, FRs, and test requirements.
4. Discover and read all test files associated with this WP.
5. Evaluate each checklist item below against the discovered test code.
6. Write structured findings to the specified output path.
7. Return a brief summary (counts of PASS/WARN/FAIL/N/A).

**Constraint**: Do NOT modify any test files, source code, WP file, or spec file. Only write to the specified output path (FR-028).

---

## Test Quality Checklist

Before evaluating, identify all test files for this WP:
- Look for test files in `tests/`, `test/`, `__tests__/`, or `spec/` directories
- Match test files to WP source files by naming convention or import analysis
- Check the WP's task descriptions for `Test requirements` fields to identify expected test types (unit, integration, BDD, E2E, none)

### Dimension 1: Test Validity (FR-040.1)
- [ ] Do all test functions contain at least one meaningful assertion?
- [ ] Are there any tests with `assert True`, `assertTrue(True)`, or equivalent vacuous assertions?
- [ ] Are there any test functions with empty bodies (only `pass`, `...`, or a docstring)?
- [ ] Are there any tests with zero assertions (no `assert`, `expect`, `should`, or equivalent)?
- [ ] Do any tests mock away the entire subject under test, only asserting the mock's return value?
- [ ] Are there any tests where the assertion cannot possibly fail given the test setup?

**Detection patterns** (adapt for the project's language):
- Python: `assert True`, `self.assertTrue(True)`, `def test_*(): pass`, `def test_*(): ...`
- JavaScript/TypeScript: `expect(true).toBe(true)`, `it('...', () => {})`, `test('...', () => {})`
- Look for tests that mock the function being tested and only assert the mock was called

### Dimension 2: Coverage Thresholds (FR-040.2)
- [ ] Is code coverage >= 80% for all source files touched by this WP?
- [ ] Is branch coverage >= 90% for all source files touched by this WP?
- [ ] Are there any `# pragma: no cover`, `/* istanbul ignore */`, or equivalent exclusions?
- [ ] Do all coverage exclusions have documented justification in a comment?
- [ ] Is coverage tooling configured in the project (pytest-cov, istanbul, c8, coverage.py)?

**If coverage tooling is configured**: read existing coverage reports (e.g., `htmlcov/`, `coverage.xml`, `.coverage`, `lcov.info`, `coverage/lcov-report/`) and report actual thresholds found in the reports. If no reports exist, check the coverage configuration (e.g., `pytest-cov` in `pyproject.toml`, `.coveragerc`, `jest --coverage` in `package.json`, `.nycrc`) and flag as WARN - "Coverage tooling is configured but no coverage reports found. Cannot verify thresholds." Do NOT execute test runners or coverage tools (NFR-004: static analysis only).
**If coverage tooling is NOT configured**: flag as WARN - "No coverage tooling configured. Cannot verify thresholds."

### Dimension 3: BDD Scenario Matching (FR-040.3)
- [ ] Read the spec's Section 5 (User Stories) and Section 11.2 (BDD Scenarios).
- [ ] Identify which acceptance scenarios map to this WP's FRs.
- [ ] For each mapped scenario, verify a corresponding test exists.
- [ ] Flag any acceptance scenario that has no matching test.
- [ ] Verify BDD tests use Given/When/Then structure (or the project's BDD framework equivalent).
- [ ] Check that scenario descriptions match or reference the spec scenario IDs.

### Dimension 4: Edge Case Coverage (FR-040.4)
- [ ] Are error paths tested (expected exceptions, error responses, failure modes)?
- [ ] Are boundary values tested (0, 1, max, min, empty string, empty list)?
- [ ] Are empty/null inputs tested where applicable?
- [ ] Are maximum or oversized inputs tested where applicable?
- [ ] Are concurrent access scenarios tested where the spec requires them?
- [ ] Are invalid input combinations tested (wrong types, missing fields, extra fields)?

### Dimension 5: Test Structure (FR-040.5)
- [ ] Do tests follow Arrange/Act/Assert (or Given/When/Then) pattern?
- [ ] Are tests isolated with no shared mutable state between test functions?
- [ ] Are test names descriptive and indicate the behavior being tested?
- [ ] Are test fixtures/setup methods focused and minimal?
- [ ] Are there any test functions that test multiple unrelated behaviors?
- [ ] Is test data defined clearly within each test (or in well-named fixtures)?

### Dimension 6: Error Path Testing (FR-040.6)
- [ ] For each error response specified in the spec's API contracts or error taxonomy, does at least one test exercise it?
- [ ] Are error messages validated in test assertions (not just status codes)?
- [ ] Are authentication/authorization failure paths tested where applicable?
- [ ] Are validation error paths tested for each input constraint from the spec?

---

## Severity Guidance (FR-041)

### FAIL - Must fix before approval
- Vacuous tests: `assert True`, empty test bodies, no assertions, mocking entire subject under test
- Code coverage below 80% threshold without documented justification
- Branch coverage below 90% threshold without documented justification
- Missing BDD scenario coverage for acceptance scenarios mapped to this WP

### WARN - Should address, does not block approval
- Test naming does not clearly describe the behavior being tested
- Minor structural concerns: shared setup that could be more focused
- Coverage exclusion markers present with justification (acceptable but noted)
- Test organization could be improved (multiple concerns in one test)

### N/A - Not applicable
Use N/A with justification when a checklist dimension does not apply to this WP. Example justifications:
- "No test files in this WP - WP produces configuration/documentation only"
- "No BDD scenarios mapped to this WP's FRs in spec Section 11.2"
- "No API error responses specified for this WP's scope"

---

## Output Format

Write findings to the specified output path using the format below. Finding IDs use the `TEST-` prefix.

```markdown
---
skill: review-tests
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
  - <test-file-1>
  - <test-file-2>
  - <source-file-checked-for-coverage>
---

# review-tests Findings for <WP-ID>

## Summary

<Brief overview: number of test files reviewed, test count, overall test quality assessment.>

## Findings

### TEST-001 [FAIL]
- **Checklist item**: Test Validity - Vacuous test
- **Requirement**: FR-040 dimension 1
- **File**: tests/test_users.py#L25-L28
- **Description**: Test `test_user_creation` contains only `assert True`.
- **Expected**: Test should assert specific behavior of the user creation function.
- **Evidence**:
  ```python
  def test_user_creation():
      assert True
  ```

### TEST-002 [PASS]
- **Checklist item**: Test Structure - Arrange/Act/Assert
- **Requirement**: FR-040 dimension 5
- **File**: tests/test_auth.py
- **Description**: All 12 test functions follow clear Arrange/Act/Assert structure.

### TEST-003 [WARN]
- **Checklist item**: Test Structure - Naming
- **Requirement**: FR-040 dimension 5
- **File**: tests/test_utils.py#L10
- **Description**: Test function `test_1` has a non-descriptive name.
- **Expected**: Name should describe the behavior being tested, e.g., `test_parse_config_returns_default_on_missing_key`.
- **Evidence**:
  ```python
  def test_1():
  ```

### TEST-004 [N/A]
- **Checklist item**: Edge Case Coverage - Concurrent access
- **Justification**: No concurrency requirements specified for this WP's scope.
```
