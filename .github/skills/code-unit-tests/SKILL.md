---
name: code-unit-tests
description: "Unit test writing and execution with coverage threshold enforcement"
argument-hint: "Invoked by Coder Coordinator - do not call directly"
---

# code-unit-tests

> **Phase**: 3 (Unit Tests)
> **Common contract**: `.github/skills/CODER-SKILL-CONTRACT.md`
> **Spec refs**: FR-027, FR-028, FR-029, FR-030

This skill is dispatched by the Coder Coordinator during Phase 3. It reads spec acceptance scenarios, writes BDD-derived unit tests covering happy paths, error paths, and edge cases, runs them with coverage enforcement, and reports results to the coordinator.

---

## Input Contract (FR-017)

| # | Input | Description |
|---|-------|-------------|
| 1 | `skill_path` | Path to this SKILL.md file |
| 2 | `wp_path` | Path to the WP file being implemented |
| 3 | `contracts_dir` | Path to contract files for this WP (`.sdd/plans/contracts/<WP-slug>/`) |
| 4 | `spec_path` | Path to the source spec file |
| 5 | `patterns` | Active code-domain patterns to avoid (from `code-patterns.md`) |
| 6 | `target_language` | Programming language (e.g., TypeScript, Python) |
| 7 | `target_framework` | Framework (e.g., Express, FastAPI, React) |
| 8 | `task_list` | Tasks with acceptance criteria and spec refs |

---

## Execution Sequence (FR-018)

1. **Read SKILL.md** -- Load this file for test writing instructions and constraints
2. **Read WP + contracts** -- Read the WP file and contract files to understand what was implemented and what acceptance scenarios exist
3. **Read spec sections** -- Read the spec sections referenced by the WP's tasks for BDD scenarios and acceptance criteria
4. **Execute test writing and execution** -- Derive tests from spec scenarios, write them, run them, verify coverage (Steps 1-6 below)
5. **Report results** -- Report files modified, tasks completed, test results (pass/fail counts, coverage percentage), and issues back to the coordinator

---

## Output Contract (FR-019)

Report to the coordinator with these fields:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `status` | enum | `success` or `failure` | Skill outcome |
| `files_modified` | list(string) | file paths | Files created or changed |
| `tasks_completed` | list(string) | T<NN>-XX format | Tasks finished |
| `test_results` | object | `pass_count`, `fail_count`, `coverage_pct` | Test run summary |
| `issues` | list(string) | free text | Problems encountered |
| `failure_reason` | string | nullable | Why the skill failed (if status is `failure`) |

The `test_results` object SHALL include:
- `pass_count`: Number of tests that passed
- `fail_count`: Number of tests that failed
- `coverage_pct`: Code coverage percentage achieved

The coordinator uses `test_results.fail_count` to decide whether to dispatch the debug skill (FR-010). This field MUST be present and accurate.

---

## Step 1 -- Derive Tests from Spec Scenarios (FR-027.1)

Tests SHALL be derived from spec acceptance scenarios using a BDD approach. Do NOT derive tests from reading the implementation source code.

### 1a. Extract Acceptance Scenarios

For each task in the `task_list`:

1. Read the task's spec refs (FR-XXX, Section N.X) from the spec file
2. Identify every acceptance scenario, including:
   - Given/When/Then scenarios defined in the spec's BDD section
   - Acceptance criteria checkboxes in the WP file
   - SHALL obligations from the FR text
   - Error behaviors from the implementation contract
3. Create a test scenario list mapping each acceptance scenario to one or more test cases

### 1b. Map Scenarios to Test Cases

For each acceptance scenario, create test cases following this mapping:

| Scenario Type | Test Cases to Create |
|---------------|---------------------|
| Happy path (normal flow) | 1 test per success scenario |
| Error path (validation failure, missing data) | 1 test per error condition |
| Edge case (boundary values, empty inputs) | 1 test per boundary |
| Precondition violation | 1 test per precondition |
| Postcondition verification | 1 test verifying output shape/content |

### 1c. BDD Test Structure

Each test SHALL follow the Arrange/Act/Assert pattern (equivalent to Given/When/Then):

```
# Given: Set up preconditions and inputs
# When: Execute the action under test
# Then: Assert expected outcomes
```

Name tests descriptively so the test name reads as a behavior specification:
- Good: `test_create_user_returns_user_with_hashed_password`
- Good: `test_create_user_rejects_duplicate_email_with_USR_001`
- Bad: `test_create_user_1`
- Bad: `test_it_works`

---

## Step 2 -- Write Unit Tests (FR-027.2, FR-027.3, FR-027.4, FR-027.5)

### 2a. Coverage Requirements (FR-027.2)

For each task, write tests covering ALL three paths:

1. **Happy path**: The normal success flow described in the acceptance scenario
2. **Error paths**: Every error condition, validation failure, and exception described in the spec
3. **Edge cases**: Boundary values, empty collections, null/None inputs, maximum lengths, zero values

Do NOT skip error paths or edge cases. If the spec mentions an error condition, there SHALL be a test for it.

### 2b. Real Behavior Testing (FR-027.3)

Tests SHALL test real behavior through real code paths:

- Import and call the actual function/method/class under test
- Pass real (or realistic) input data
- Assert on the actual output, side effects, or state changes
- Verify the contract between caller and callee

**Example of real behavior testing**:
```python
# GOOD: Tests real behavior
def test_create_user_hashes_password():
    result = create_user(CreateUserInput(email="a@b.com", password="secret"))
    assert result.password_hash != "secret"
    assert verify_password("secret", result.password_hash)
```

### 2c. External Dependency Mocking (FR-027.4)

Mock ONLY external dependencies -- never the subject under test:

**What to mock** (external dependencies):
- Database connections and queries
- HTTP/API calls to external services
- File system operations (when testing business logic, not file handling)
- Message queues, caches, third-party SDKs
- System clock (time-dependent logic)

**What NOT to mock** (subject under test):
- The function/class being tested
- Internal helper functions called by the subject
- Data transformations within the module
- Validation logic within the module

**Mock boundary rule**: If it crosses a network, process, or I/O boundary, mock it. If it is in-process computation, do NOT mock it.

### 2d. Test Framework (FR-027.5)

Use the project's existing test framework. Detect from the project configuration:

| Language | Framework Detection | Default |
|----------|-------------------|---------|
| Python | `pytest` in requirements/pyproject.toml | pytest |
| TypeScript/JavaScript | `jest` or `mocha` in package.json | Jest |
| Go | Built-in `testing` package | testing |
| Rust | Built-in `#[cfg(test)]` | built-in |

Follow the framework's conventions for:
- Test file naming (e.g., `test_*.py`, `*.test.ts`, `*_test.go`)
- Test file location (e.g., `tests/`, `__tests__/`, alongside source)
- Assertion style (e.g., `assert`, `expect`, `require`)
- Setup/teardown patterns (e.g., fixtures, beforeEach, TestMain)

---

## Step 3 -- Test Validity Constraints (FR-028)

Every test SHALL be capable of failing. Apply these constraints before finalizing any test file.

### 3a. Forbidden: Trivial Assertions (FR-028.1)

The following assertion patterns are FORBIDDEN:

```python
# FORBIDDEN -- Python
assert True
assert 1 == 1
assert "hello" == "hello"  # literal-to-literal comparison
self.assertTrue(True)
```

```typescript
// FORBIDDEN -- TypeScript/JavaScript
expect(true).toBe(true);
expect(1).toEqual(1);
assert.ok(true);
```

```go
// FORBIDDEN -- Go
if true != true { t.Fatal() }
```

A valid assertion MUST compare a computed value against an expected value:
```python
# VALID -- compares computed result to expected
assert create_user(input).email == "a@b.com"
```

### 3b. Forbidden: Empty Test Bodies (FR-028.2)

The following patterns are FORBIDDEN:

```python
# FORBIDDEN -- Python
def test_something():
    pass

def test_something():
    ...  # Ellipsis as placeholder

def test_something():
    """TODO: implement"""
```

```typescript
// FORBIDDEN -- TypeScript/JavaScript
it('should do something', () => {});
it('should do something', () => { /* TODO */ });
test('placeholder', () => undefined);
```

Every test body SHALL contain at least one assertion that exercises the subject under test.

### 3c. Forbidden: Mock-Only Assertions (FR-028.3)

Tests that ONLY verify a mock was called, without verifying behavior, are FORBIDDEN:

```python
# FORBIDDEN -- only checks mock was called, not what happened
def test_create_user(mock_db):
    create_user(input)
    mock_db.save.assert_called_once()
    # No assertion on the return value or side effects
```

```python
# VALID -- checks mock interaction AND verifies behavior
def test_create_user_saves_and_returns(mock_db):
    mock_db.save.return_value = User(id="123", email="a@b.com")
    result = create_user(input)
    mock_db.save.assert_called_once_with(expected_user)
    assert result.id == "123"  # Verifies actual behavior
    assert result.email == "a@b.com"
```

**Exception**: `assert mock.called` is acceptable ONLY when verifying a required side effect (e.g., "the system SHALL send a notification email"). In this case, the mock assertion IS the behavioral test. But the test SHALL also verify the arguments passed to the mock.

### 3d. Self-Check: Can This Test Fail?

Before adding any test, apply this mental check:

1. If I change the implementation to return a wrong value, will this test fail? If no, the test is vacuous.
2. If I delete the function under test entirely, will this test fail? If no, the test is not testing real code.
3. Does this test add information beyond what other tests already verify? If no, it may be redundant (but redundancy for edge cases is acceptable).

---

## Step 4 -- Organize Test Files

### 4a. File Placement

Place test files according to the project's existing convention. If no convention exists:

| Language | Convention |
|----------|-----------|
| Python | `tests/unit/test_<module>.py` |
| TypeScript | `tests/unit/<module>.test.ts` or `src/__tests__/<module>.test.ts` |
| Go | `<module>_test.go` (same directory as source) |
| Rust | `#[cfg(test)] mod tests` in source file, or `tests/` for integration |

### 4b. Test Grouping

Group tests logically:
- One test file per source module/class
- Within a file, group by function/method using the framework's grouping mechanism:
  - Python: test classes or descriptive function names
  - TypeScript: `describe()` blocks
  - Go: `t.Run()` subtests

---

## Step 5 -- Run Tests and Report Results (FR-029)

After writing all unit tests, run the complete test suite.

### 5a. Run Tests with Coverage

Execute tests with coverage enabled:

| Language | Command |
|----------|---------|
| Python | `pytest --cov --cov-branch --cov-report=term-missing` |
| TypeScript (Jest) | `npx jest --coverage` |
| Go | `go test -coverprofile=coverage.out -covermode=atomic ./...` |
| Rust | `cargo tarpaulin` |

### 5b. Capture Results

Record the following from the test output:
- Total tests run
- Tests passed (`pass_count`)
- Tests failed (`fail_count`)
- Code coverage percentage
- Branch coverage percentage (if reported separately)
- List of failing test names and error messages (if any)

### 5c. Report to Coordinator

Include test results in the output contract:

```
test_results:
  pass_count: <number>
  fail_count: <number>
  coverage_pct: <number>
```

If any tests fail:
- Set `fail_count` to the exact number of failing tests
- Include the failing test names and error messages in `issues`
- The coordinator will use `fail_count > 0` to trigger debug skill dispatch

---

## Step 6 -- Coverage Threshold Enforcement (FR-030)

### 6a. Verify Thresholds

After running tests, verify coverage meets the minimum thresholds:

| Metric | Minimum Threshold |
|--------|------------------|
| Code coverage (line/statement) | 80% |
| Branch coverage | 90% |

### 6b. Below Threshold: Add More Tests

If coverage is below either threshold:

1. **Identify uncovered lines**: Parse the coverage report for uncovered lines and branches
2. **Prioritize uncovered branches**: Branch coverage is typically harder to achieve than line coverage. Focus on:
   - Untested `if/else` branches
   - Unexercised `switch/match` cases
   - Error handling paths (`try/catch`, `except`, `if err != nil`)
   - Guard clauses and early returns
   - Default cases
3. **Write targeted tests**: For each uncovered line/branch, write a test that exercises that specific path
4. **Re-run tests**: Run the full test suite again with coverage
5. **Repeat**: Continue adding tests and re-running until both thresholds are met

### 6c. Coverage Iteration Limit

If after 3 iterations of adding tests the coverage still does not meet thresholds:
- Report the current coverage percentages
- Report the remaining uncovered lines/branches
- Set `status: success` (the tests themselves pass -- coverage is a coordinator concern)
- Include coverage shortfall details in `issues`
- The coordinator will handle further coverage improvement

### 6d. Already at Threshold

If coverage meets or exceeds both thresholds on the first run:
- Report the coverage percentages
- No additional tests needed
- Set `status: success`

---

## Constraints

### SHALL NOT: Implementation-Derived Tests

Do NOT read the implementation source code to decide what to test. Tests SHALL be derived from:
1. Spec acceptance scenarios (primary source)
2. WP acceptance criteria
3. Contract file definitions (for verifying interface compliance)

This prevents tests that merely confirm what the code does rather than what is should do.

### SHALL NOT: Self-Review

Do NOT perform quality assessment, review checklists, or "verified implementation quality" statements. Write tests, run them, report results. The Reviewer is the sole quality gate.

### SHALL NOT: Modify Contracts

Contract files in `.sdd/plans/contracts/` are READ-ONLY. Do NOT modify any contract file. If a contract appears incorrect, flag it as an issue and continue.

### SHALL NOT: Delete or Weaken Existing Tests

If existing tests from a prior phase fail:
- Do NOT delete them
- Do NOT weaken their assertions
- Report them as failing in `test_results`
- The coordinator will dispatch the debug skill to fix them
