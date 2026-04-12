---
name: retro-test-analysis
description: "Analyzes existing tests to extract behavior contracts, acceptance scenarios, coverage mapping, and test-derived requirements"
argument-hint: "Invoked by Retro-Spec Coordinator - do not call directly"
---

# retro-test-analysis -- Test Analysis Skill

This skill is invoked by the Retro-Spec Coordinator as the sixth extraction skill (validation phase). It analyzes existing test files to validate extracted specifications, discover additional behaviors documented through tests, map coverage, and enrich acceptance scenarios. It produces Section 11 (Test Requirements) and updates confidence markers throughout the accumulator.

## Input Contract

| # | Input | Description |
|---|-------|-------------|
| 1 | `skill_path` | Path to this SKILL.md file |
| 2 | `accumulator_path` | Path to the spec file being built |
| 3 | `artifacts_dir` | Path to companion artifacts directory |
| 4 | `discovery_manifest_path` | Path to the discovery manifest |
| 5 | `source_path` | Path to the legacy source code |
| 6 | `target_language` | Target language for artifacts |
| 7 | `project_name` | Name of the project |
| 8 | `module_filter` | Modules to analyze |

## Execution Sequence

1. **Read this SKILL.md**
2. **Read discovery manifest** for test infrastructure details
3. **Read the FULL accumulator** (all sections written by prior skills)
4. **Analyze test files** in the legacy codebase. Use `#tool:search/searchSubagent` to discover all test files and `#tool:search/usages` to trace which source symbols are covered by tests.
5. **Write Section 11** to the accumulator
6. **Annotate prior sections** with test-validation markers (inline additions only, not modifications)

## Constraints

- NEVER execute tests -- analysis is purely static (read test source code)
- NEVER modify legacy source files
- NEVER modify prior sections' requirement text -- only ADD inline annotations
- Inline annotations use the format: `[TEST VALIDATED: <test_file>:<test_name>]` or `[NO TEST COVERAGE]`
- If no test files are found, write Section 11 noting complete absence and skip all test analysis

---

## Extraction Procedure

### Step 1: Test File Discovery

1. **Locate test files** using patterns from the discovery manifest's test infrastructure section
2. **Sort tests by type**:
   - **Unit tests**: Co-located with source or in `__tests__/`, `test/unit/`, `tests/unit/`
   - **Integration tests**: In `test/integration/`, `tests/integration/`, `e2e/`
   - **E2E tests**: In `test/e2e/`, `cypress/`, `playwright/`
   - **Performance tests**: In `test/perf/`, `benchmark/`, `test/load/`
3. **Count test files and estimate test count**:
   - Grep for `it\(|test\(|def test_|func Test|@Test|\[Fact\]|\[Test\]` to estimate number of test cases
4. **Identify test utilities**: Factories, fixtures, helpers, mocks, stubs

### Step 2: Test-to-Requirement Mapping

For each test file:

1. **Read the test file**
2. **Extract test descriptions**: The `describe`/`it`/`test` strings or method names
3. **Map test assertions to FRs**:
   - Does this test verify a behavior documented in Section 4?
   - If yes: link the FR to this test -> `[TEST VALIDATED: file:test_name]`
   - If no: this test documents a behavior NOT yet captured -> add a new FR with `[INFERRED: HIGH]` (test-derived)

4. **Extract Given/When/Then from test structure**:
   - Setup/arrange phase -> Given (precondition)
   - Action/act phase -> When (trigger)
   - Assertion/assert phase -> Then (expected result)
   - Convert to acceptance scenarios for Section 5

5. **Quality assessment of each test**:
   - Does it test behavior or implementation detail?
   - Does it use real dependencies or mocks?
   - Does it test error paths?

### Step 3: Coverage Mapping

Build a coverage matrix mapping FRs to test evidence:

| FR | Test File | Test Name | Type | Verdict |
|----|-----------|-----------|------|---------|
| FR-001 | user.test.ts | "creates user with valid email" | unit | Covered |
| FR-002 | user.test.ts | "rejects duplicate email" | unit | Covered |
| FR-003 | - | - | - | **NOT COVERED** |
| FR-004 | auth.e2e.ts | "blocks unauthorized access" | e2e | Covered |

### Step 4: Behavior Discovery

Tests often document behaviors not immediately obvious from production code:

1. **Edge cases**: Tests for boundary values, empty inputs, maximum lengths
2. **Race conditions**: Tests with concurrent operations or timeout handling
3. **Error cascades**: Tests that verify system behavior when dependencies fail
4. **Data format quirks**: Tests verifying specific date formats, number precision, encoding
5. **Feature interactions**: Tests that exercise multiple features together

For each discovered behavior that is NOT already in the accumulator:
- Add as a new FR with `[INFERRED: HIGH] Source: <test_file>:<test_name>` (tests are strong evidence)
- Add as an edge case in the relevant user story

### Step 5: Mock/Stub Analysis

Analyze test mocks and stubs to understand expected interfaces:

1. **What is mocked**: Identifies external dependencies and their expected interfaces
2. **Mock return values**: Documents expected response shapes from dependencies
3. **Mock verification**: Documents expected call patterns (method, arguments, call count)
4. **This validates Section 8**: Mock interfaces should match extracted interfaces

If mocks reveal interfaces NOT captured in Section 8, add inline notes:
`[INTERFACE GAP: test mocks <service> at <file:line>, but no interface extracted in Section 8]`

---

## Section 11 Output Format

```markdown
## 11. Test Requirements

### 11.1 Test Coverage Summary

| Metric | Value |
|--------|-------|
| Total FRs | <count> |
| FRs with test evidence | <count> |
| FRs without test coverage | <count> |
| Coverage percentage | <X%> |
| Total test files analyzed | <count> |
| Estimated test cases | <count> |

### 11.2 Test Infrastructure (Legacy)

| Aspect | Detail | Source |
|--------|--------|--------|
| Unit test framework | <jest/pytest/etc.> | <config file> |
| Integration test framework | <supertest/etc.> | <config file> |
| E2E test framework | <cypress/playwright/none> | <config file> |
| Mocking library | <jest mocks/unittest.mock/etc.> | <test files> |
| Test runner | <npm test/pytest/go test> | <package.json/Makefile> |
| Coverage tool | <istanbul/coverage.py/etc.> | <config file> |
| CI test execution | <yes/no> | <CI config file> |

### 11.3 Recommended Test Strategy (for Reimplementation)

Based on legacy test analysis, the reimplementation SHOULD include:

#### Unit Tests (target: 80% line coverage, 90% branch coverage)

| # | Test Scope | Priority | FR Reference | Legacy Evidence |
|---|-----------|----------|-------------- |-----------------|
| UT-01 | <behavior to test> | P1 | FR-001 | <legacy test or gap> |

**Given/When/Then Scenarios** (derived from legacy tests):

```gherkin
Scenario: <derived from legacy test>
  Given <setup from test arrange phase>
  When <action from test act phase>
  Then <assertion from test assert phase>
  Source: <legacy test file:test name>
```

#### Integration Tests

| # | Test Scope | Components | FR Reference | Legacy Evidence |
|---|-----------|------------|--------------|-----------------|
| IT-01 | <integration point> | <A + B> | FR-XXX | <legacy test or gap> |

#### E2E Tests

| # | Test Scope | User Flow | Legacy Evidence |
|---|-----------|-----------|-----------------|
| E2E-01 | <end-to-end scenario> | Section 6.X | <legacy test or gap> |

### 11.4 Coverage Gaps

FRs that have NO test coverage in the legacy codebase (high priority for reimplementation tests):

| FR | Description | Risk Level | Recommendation |
|----|------------|------------|----------------|
| FR-XXX | <description> | HIGH | Requires unit + integration tests |

### 11.5 Test-Derived Behaviors

Behaviors discovered through test analysis that were NOT immediately apparent from production code:

| # | Behavior | Test Source | Added To |
|---|----------|-------------|----------|
| TB-01 | <behavior description> | <test file:test name> | FR-XXX (new) |
| TB-02 | <edge case> | <test file:test name> | US-XX edge cases |
```

---

## Annotation Format for Prior Sections

When adding test validation markers to prior sections, use ONLY inline additions:

**For validated FRs** (FR text already exists in Section 4):
```
- **FR-001**: The system SHALL create a user with valid credentials.
  [INFERRED: HIGH] Source: services/user.ts:45-60
  [TEST VALIDATED: tests/user.test.ts:"creates user with valid email"]
```

**For unvalidated FRs** (no test found):
```
- **FR-003**: The system SHALL rate-limit login attempts.
  [INFERRED: MEDIUM] Source: middleware/auth.ts:12
  [NO TEST COVERAGE]
```

**For test-discovered behaviors** (new FR added):
```
- **FR-025**: The system SHALL reject passwords shorter than 8 characters.
  [INFERRED: HIGH] Source: tests/auth.test.ts:"rejects short passwords"
  [TEST DISCOVERED: this FR was inferred from test assertions, not production code]
```
