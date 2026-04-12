---
name: code-debug
description: "Test failure diagnosis, source code fixes, and regression detection"
argument-hint: "Invoked by Coder Coordinator - do not call directly"
---

# code-debug

> **Phase**: 5 (Conditional Debug)
> **Common contract**: `.github/skills/CODER-SKILL-CONTRACT.md`
> **Spec refs**: FR-034, FR-035, FR-036, FR-037

This skill is dispatched by the Coder Coordinator during Phase 5, only when unit or integration tests fail. It reads failing test output, diagnoses root causes, fixes source code (preferring source fixes over test fixes), re-runs all tests to verify fixes and detect regressions, and reports results. The coordinator controls the retry loop (max 3 attempts) -- this skill runs once per invocation.

---

## Input Contract (FR-017)

### Standard Inputs

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

### Debug-Specific Inputs

| # | Input | Description |
|---|-------|-------------|
| 9 | `test_output` | Failing test output: test names, error messages, stack traces from the most recent test run |
| 10 | `source_file_list` | List of source files relevant to the failing tests |
| 11 | `debug_attempt` | Current debug attempt number (1, 2, or 3). Indicates urgency and remaining budget. |

The `test_output` input is the raw output from the test runner (unit + integration). It includes the names of failing tests, assertion error messages, and stack traces. The coordinator captures this from the prior test skill invocations.

The `debug_attempt` counter tells this skill how many attempts remain. At attempt 3, the skill should be more thorough in its diagnosis and consider escalating if the root cause is unclear.

---

## Execution Sequence (FR-018)

1. **Read SKILL.md** -- Load this file for debugging instructions, safety constraints, and reporting format
2. **Read WP + contracts** -- Read the WP file and contract files to understand the intended behavior and interface contracts
3. **Read spec sections** -- Read the spec sections referenced by the failing tests' tasks for requirements context
4. **Execute diagnosis and fix** -- Diagnose root causes, apply fixes, re-run all tests (Steps 1-5 below)
5. **Report results** -- Report fixed tests, still-failing tests, regressions, and files modified back to the coordinator

---

## Output Contract (FR-019)

Report to the coordinator with these fields:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `status` | enum | `success` or `failure` | Skill outcome (`success` = all tests pass, `failure` = tests still failing or cannot diagnose) |
| `files_modified` | list(string) | file paths | Files created or changed during debugging |
| `tasks_completed` | list(string) | T<NN>-XX format | Tasks whose failing tests are now fixed |
| `test_results` | object | `pass_count`, `fail_count`, `coverage_pct` | Test run summary after fixes |
| `issues` | list(string) | free text | Problems encountered during debugging |
| `failure_reason` | string | nullable | Why the skill failed (if status is `failure`) |

### Debug-Specific Output Fields

| Field | Type | Description |
|-------|------|-------------|
| `tests_fixed` | list(string) | Test names that were previously failing and now pass |
| `tests_still_failing` | list(object) | Tests still failing: `{name, error, diagnosis}` for each |
| `regressions` | list(string) | Test names that were passing before fixes but now fail |

The coordinator uses these fields to decide:
- **All tests pass** (`fail_count == 0`, `regressions` empty): Done. Do not dispatch again.
- **Tests still failing** (`fail_count > 0`, `debug_attempt < 3`): Retry with incremented attempt counter.
- **Cannot diagnose** (`status == failure`, `failure_reason` set): Escalate to human immediately.
- **3 attempts exhausted** (`debug_attempt == 3`, `fail_count > 0`): Coordinator escalates to human.

---

## Step 1 -- Read and Categorize Failing Tests (FR-034.1)

Parse the `test_output` input to extract every failing test. For each failure, record:

| Field | Source | Example |
|-------|--------|---------|
| Test name | Test runner output | `test_create_user_returns_hashed_password` |
| Error type | Exception/assertion class | `AssertionError`, `TypeError`, `AttributeError` |
| Error message | Assertion diff or exception message | `expected 'string' but got 'number'` |
| Stack trace | Full traceback | File, line number, function name |
| Test file | Stack trace or test runner | `tests/unit/test_user.py:42` |

### 1a. Group Failures by Root Cause

Multiple test failures often share a single root cause. Group failures that:
- Reference the same source file and function
- Produce the same error type
- Fail on the same assertion pattern (e.g., all get a `TypeError` from the same function)

Fixing the shared root cause should resolve all tests in the group. Prioritize groups with the most failures first.

### 1b. Identify the Relevant Source Code (FR-034.2)

For each failure group, locate the source code under test:

1. Read the stack trace to find the source file and line number where the error originates
2. Read the test file to identify which function/class/module is being tested
3. Read the source file containing the function under test
4. Read enough surrounding context (the full function, class, or module) to understand the logic

**Diagnostic tool guidance**:
- Use `#tool:read/problems` to check for compile and lint errors in source files -- these often reveal the root cause faster than reading stack traces
- Use `#tool:search/usages` to trace how a failing symbol is referenced across the codebase -- this finds all callers, definitions, and implementations in one call
- Use `#tool:execute/executionSubagent` for running targeted test commands and filtering output to only the relevant failure details

### 1c. Read Contract and Spec Context (FR-034.3)

For each failure group, load the relevant contracts and spec sections:

1. Read contract files from `contracts_dir` that define the interface, data schema, or error catalog for the failing code
2. Read the spec sections referenced by the task that owns the failing tests
3. Identify the expected behavior according to the spec and contracts -- this is the source of truth for determining whether the source code or test code is wrong

---

## Step 2 -- Diagnose Root Causes (FR-034.4)

For each failure group, determine the root cause by answering these questions in order:

### 2a. Diagnosis Decision Tree

```
1. Does the source code match the contract file signatures exactly?
   - Function names, parameter names, types, return types
   - Data entity field names, types, defaults, validation rules
   - Error codes, messages, HTTP status codes
   If NO --> Root cause: contract deviation in source code

2. Does the source code implement the spec's SHALL obligations?
   - All preconditions checked
   - All postconditions produced
   - All error paths handled
   If NO --> Root cause: missing or incorrect spec implementation

3. Does the test correctly reflect the spec's expected behavior?
   - Test assertions match spec acceptance scenarios
   - Test inputs match spec preconditions
   - Expected outputs match spec postconditions
   If NO --> Root cause: incorrect test (test does not match spec)

4. Is there a logic error in the source code?
   - Off-by-one errors, wrong operator, missing null check
   - Incorrect control flow (wrong branch, missing case)
   - Data transformation error (wrong field, wrong format)
   If YES --> Root cause: implementation bug
```

### 2b. Document Each Diagnosis

For each failure group, record:

- **Root cause**: One-sentence description of what is wrong
- **Evidence**: The specific code, contract, or spec text that proves the diagnosis
- **Category**: `contract-deviation`, `missing-implementation`, `incorrect-test`, `logic-error`, or `unknown`
- **Fix location**: Whether the source code or test code needs to change
- **Spec justification**: The FR or acceptance scenario that defines the correct behavior

---

## Step 3 -- Apply Fixes with Prioritization (FR-035)

### 3a. Fix Priority: Source Code First

The skill SHALL prioritize source code fixes over test code fixes. Use this decision flow:

1. **Is the test correct per the spec?** Read the spec FR and acceptance scenario that the test is derived from.
   - If the test correctly reflects the spec's expected behavior but the source code produces wrong results --> **Fix the source code**
   - If the test does NOT match the spec's expected behavior (wrong assertion, wrong expected value, wrong precondition) --> **Fix the test**

2. **When fixing source code**: Change the implementation to produce the behavior described in the spec and contracts. Cite the FR that defines the correct behavior.

3. **When fixing test code**: Change the test to match the spec. Only do this when the test genuinely tests the wrong behavior. Always cite the spec FR or acceptance scenario that justifies the test change.

### 3b. Fix Scope

- Fix only the code necessary to resolve the diagnosed root cause
- Do NOT refactor surrounding code while fixing a bug
- Do NOT add features or "improvements" alongside bug fixes
- Do NOT change code unrelated to the failing tests
- If multiple failure groups share a root cause, apply one fix that resolves all of them

---

## Safety Constraints (FR-036)

These constraints are absolute. Violating any of them is a skill failure.

### SHALL NOT: Delete or Skip Failing Tests (FR-036.1)

- Do NOT delete test functions or test files
- Do NOT comment out failing tests
- Do NOT add `@skip`, `@pytest.mark.skip`, `xit()`, `test.skip()`, or equivalent decorators
- Do NOT rename tests to remove them from the test runner's discovery pattern
- Every test that existed before debugging must still exist and run after debugging

### SHALL NOT: Weaken Assertions (FR-036.2)

The following patterns are FORBIDDEN:

| Forbidden Pattern | Why It Is Wrong |
|-------------------|----------------|
| Changing `assertEqual(x, 42)` to `assertTrue(x > 0)` | Weakens the precision of the check |
| Changing `toEqual(expected)` to `toBeDefined()` | Removes value verification |
| Changing `assert x == "exact"` to `assert "exact" in x` | Weakens exact match to substring |
| Adding `try/except` around assertions | Suppresses assertion failures |
| Changing `assert len(items) == 3` to `assert len(items) > 0` | Weakens count verification |
| Wrapping assertions in conditional checks | Makes assertions optional |

If a test's assertion is genuinely wrong per the spec, change it to the correct assertion -- do NOT weaken it. The new assertion must be at least as strong as the original.

### SHALL NOT: Add Broad Exception Handlers (FR-036.3)

- Do NOT add `except Exception`, `catch(e)`, or similar broad handlers to suppress errors
- Do NOT add `try/except: pass` blocks
- Do NOT add error handlers that silently swallow exceptions
- Specific, narrow exception handling is acceptable only when the spec requires it (e.g., "catch ValueError and return error code USR-001")

### SHALL NOT: Modify Contract Files (FR-036.4)

- Do NOT modify any file in `.sdd/plans/contracts/`
- Contracts are read-only -- they are the Planner's output and the spec's derivative
- If a contract appears wrong, report the discrepancy in the `issues` output field
- The coordinator will escalate contract issues to the Planner or Spec Architect

---

## Step 4 -- Re-Run All Tests and Detect Regressions (FR-037)

After applying fixes, re-run ALL tests -- both unit and integration. Do NOT re-run only the previously-failing tests. The full test suite must pass to confirm fixes and catch regressions.

### 4a. Run the Full Test Suite

Use the project's test runner to execute all tests:

| Language | Command | Coverage |
|----------|---------|----------|
| Python | `pytest --tb=short -q` | `pytest --cov` |
| TypeScript | `npx jest` or `npm test` | `npx jest --coverage` |
| Go | `go test ./...` | `go test -cover ./...` |
| Rust | `cargo test` | `cargo tarpaulin` |

Run both unit and integration test suites. If they use separate commands or directories, run both.

### 4b. Categorize Results (FR-037.1, FR-037.2, FR-037.3)

Compare the post-fix test results against the pre-fix `test_output` to categorize every test:

| Category | Definition | Report Field |
|----------|------------|--------------|
| **Fixed** | Was failing in `test_output`, now passes | `tests_fixed` |
| **Still failing** | Was failing in `test_output`, still fails | `tests_still_failing` |
| **Regression** | Was NOT failing in `test_output`, now fails | `regressions` |
| **Unchanged pass** | Was passing, still passes | (not reported -- this is expected) |

### 4c. Handle Regressions

If any regression is detected (`regressions` is non-empty):

1. The fix introduced a new failure. This is a critical signal.
2. Attempt to resolve the regression without breaking the original fix:
   - Read the regressed test to understand what behavior changed
   - Determine if the fix needs adjustment to preserve both behaviors
   - Apply a corrected fix and re-run all tests again
3. If the regression cannot be resolved without breaking the original fix, report both the regression and the original failure as `tests_still_failing` and revert the fix that caused the regression.

### 4d. Populate Test Results

After the final test run, populate the output fields:

```
test_results:
  pass_count: <number of passing tests>
  fail_count: <number of failing tests>
  coverage_pct: <code coverage percentage>

tests_fixed: [<list of test names that were failing and now pass>]
tests_still_failing:
  - name: <test name>
    error: <error message>
    diagnosis: <why this test still fails>
regressions: [<list of test names that were passing but now fail>]
```

---

## Step 5 -- Report Results to Coordinator

### 5a. Success Report

If all tests pass (`fail_count == 0` and `regressions` is empty):

```
status: success
files_modified: [<list of files changed during debugging>]
tasks_completed: [<tasks whose tests are now fixed>]
test_results:
  pass_count: <N>
  fail_count: 0
  coverage_pct: <N>
tests_fixed: [<previously-failing test names>]
tests_still_failing: []
regressions: []
issues: []
failure_reason: null
```

### 5b. Partial Fix Report

If some tests are fixed but others still fail (`fail_count > 0`):

```
status: failure
files_modified: [<list of files changed>]
tasks_completed: [<tasks whose tests all pass now>]
test_results:
  pass_count: <N>
  fail_count: <N>
  coverage_pct: <N>
tests_fixed: [<tests that were fixed>]
tests_still_failing:
  - name: <test name>
    error: <error message>
    diagnosis: <root cause analysis>
regressions: [<any regressions introduced>]
issues: [<context about remaining failures>]
failure_reason: "<N> tests still failing after debug attempt <attempt_number>"
```

The coordinator will use `tests_still_failing` to provide context in the next debug attempt's `test_output` input.

### 5c. Escalation Report (Cannot Diagnose)

If the skill cannot diagnose the root cause of one or more failures, report with full context for human escalation:

```
status: failure
files_modified: []
tasks_completed: []
test_results:
  pass_count: <N>
  fail_count: <N>
  coverage_pct: <N>
tests_fixed: []
tests_still_failing:
  - name: <test name>
    error: <full error message and stack trace>
    diagnosis: "Unable to determine root cause"
regressions: []
issues:
  - "Cannot diagnose failure in <test_name>"
  - "Relevant source file: <path>"
  - "Contract reference: <contract file and section>"
  - "Spec reference: <FR-XXX, Section N.X>"
  - "Attempted fixes: <description of what was tried, if anything>"
failure_reason: "Cannot diagnose root cause of <N> test failure(s). Recommend human review."
```

The escalation report SHALL include sufficient context for the coordinator to present the full picture to a human:

| Required Context | Source | Purpose |
|-----------------|--------|---------|
| Failing test names | `test_output` | Identify what fails |
| Error messages and stack traces | `test_output` | Show the symptoms |
| Relevant source files | Stack trace analysis | Show where the problem is |
| Contract file references | `contracts_dir` | Show expected behavior |
| Spec references | Task spec refs | Show requirements |
| Attempted fixes (if any) | Debug actions taken | Show what was tried |
| Debug attempt number | `debug_attempt` | Show how many tries remain |

---

## Active Patterns

Before debugging, review the `patterns` input. These are mistakes caught in prior code reviews. Avoid repeating them during fixes. If the patterns list is empty ("No active patterns"), proceed normally.
