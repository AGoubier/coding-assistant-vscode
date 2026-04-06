---
name: spec-test-strategy
description: "Produces test requirements with BDD scenarios mapped to acceptance criteria"
argument-hint: "Invoked by Spec Architect Coordinator - do not call directly"
---

# spec-test-strategy - Test Strategy Skill

This skill is invoked by the Spec Architect Coordinator as a subagent. It produces Section 11 (Test Requirements) of the specification with BDD scenarios mapped 1:1 to acceptance criteria, unit/integration/E2E/performance/security test requirements, and coverage thresholds.

## Input Contract

This skill receives the following inputs via the coordinator's subagent prompt:

| # | Input | Description |
|---|-------|-------------|
| 1 | `skill_path` | Path to this SKILL.md file |
| 2 | `accumulator_path` | Path to the spec file being built |
| 3 | `artifacts_dir` | Path to the companion artifacts directory |
| 4 | `brief_path` | Path to the source ideation brief |
| 5 | `research_summary` | Key findings from the research phase |
| 6 | `section_numbers` | `11` |
| 7 | `patterns` | Active spec-domain patterns to avoid |
| 8 | `target_language` | Programming language for artifacts (not used by this skill) |

## Execution Sequence

1. **Read this SKILL.md** to load instructions and guidelines
2. **Read the accumulator** at `accumulator_path` to understand sections 1-10.2 (the full spec so far)
3. **Read the brief** at `brief_path` for context
4. **Write Section 11** to the accumulator by APPENDING after existing content
5. **Produce artifacts** - N/A (this skill produces no companion artifacts)

## Constraints

- Do NOT modify sections 1 through 10 (earlier skills' sections)
- If you discover an inconsistency with a prior section, add: `[CROSS-REF ISSUE: <description>]`
- Use plain ASCII only - no em dashes, smart quotes, or curly apostrophes
- Tests derive from SPEC acceptance scenarios, NOT from implementation details

---

## BDD/TDD Principle (FR-052)

ALL tests in this section derive from spec acceptance scenarios (Section 5) and functional requirements (Section 4), NOT from implementation details.

- Test names describe BEHAVIOR, not functions: "User can register with valid email" not "test_create_user_service"
- Test assertions verify SPEC POSTCONDITIONS, not internal state
- Coverage thresholds: 80% code coverage, 90% branch coverage (minimum)
- Write the test an acceptance scenario describes, not the test an implementation suggests

---

## Section 11 - Test Requirements (FR-050)

Write Section 11 with ALL six subsections.

### 11.1 Unit Tests

Identify modules requiring unit test coverage:

```markdown
### 11.1 Unit Tests

**Coverage thresholds**: 80% code coverage, 90% branch coverage (minimum)

**Coverage tool**: <pytest-cov for Python / c8/istanbul for Node.js / equivalent>

| Module | Key Functions to Test | Edge Cases |
|--------|---------------------|------------|
| <module from Section 9.3> | <functions derived from FRs> | <boundary conditions from Section 5 edge cases> |
```

Focus on:
- Pure functions and data transformations
- Validation logic from Section 7 (data model constraints)
- State machine transition logic (if applicable)
- Error handling paths from FR error behaviors

### 11.2 BDD / Acceptance Tests (FR-051)

Write Gherkin scenarios for EVERY acceptance criterion from Section 5 user stories.

**CRITICAL: 1:1 mapping is MANDATORY.** Every acceptance scenario in every US from Section 5 SHALL have exactly one Gherkin scenario here.

```gherkin
Feature: <Feature area from Section 4>

  # Source: US-XX Scenario N
  Scenario: <Acceptance scenario title>
    Given <precondition from the US acceptance scenario>
    When <action from the US acceptance scenario>
    Then <expected result from the US acceptance scenario>
    And <additional assertions>

  # Source: US-XX Scenario N (error path)
  Scenario: <Error scenario title>
    Given <precondition>
    When <action that triggers error>
    Then <error behavior from FR error definition>
```

**Edge case scenarios**: For each edge case listed in Section 5 user stories, write a corresponding Gherkin scenario:

```gherkin
  # Source: US-XX Edge Case 1
  Scenario: <Edge case description>
    Given <edge condition>
    When <action>
    Then <expected handling>
```

### 11.3 Integration Tests

Identify component boundaries that need integration testing:

```markdown
### 11.3 Integration Tests

| Boundary | Components | Mock Strategy | Data Setup |
|----------|-----------|---------------|------------|
| API -> Service | Route handler, business logic | Mock external APIs | Seed test database |
| Service -> Database | Business logic, ORM | Use test database | Migrations + seed data |
| Service -> External API | Business logic, HTTP client | Mock server (nock/responses) | Fixture files |
```

For each boundary:
- Identify what is real vs mocked
- Data setup/teardown strategy (transaction rollback, truncate, fixtures)
- How external dependencies are stubbed

### 11.4 End-to-End Tests

Define critical user journeys for E2E testing:

```markdown
### 11.4 End-to-End Tests

**Target environment**: <staging / Docker Compose / local>
**Tool**: <Playwright / Cypress / httpx / supertest>

| Journey | Steps | Success Criteria |
|---------|-------|-----------------|
| <Primary flow from Section 6> | 1. <step> 2. <step> ... | <observable outcome> |
```

Focus on P1 user flows from Section 6.

### 11.5 Performance Tests

```markdown
### 11.5 Performance Tests

| Scenario | Endpoint/Operation | Target | Tool |
|----------|--------------------|--------|------|
| API response time | GET /resource | < 200ms p95 | k6 / locust |
| Concurrent users | All authenticated endpoints | 100 concurrent | k6 / locust |
| Database query time | Complex queries | < 50ms p95 | Explain analyze |
```

Derive targets from NFRs in Section 10.1.

### 11.6 Security Tests

```markdown
### 11.6 Security Tests

| Test | Category | Verification |
|------|----------|-------------|
| Auth bypass | A01 Broken Access Control | Attempt accessing protected endpoints without token |
| SQL injection | A03 Injection | Send malicious input to all text fields |
| XSS | A03 Injection | Submit script tags in user input fields |
| Token expiry | A07 Auth Failures | Use expired tokens, verify rejection |
| Brute force | A07 Auth Failures | Rapid login attempts, verify rate limiting |
| Sensitive data exposure | A02 Cryptographic Failures | Check API responses for password hashes, tokens |
```

Derive tests from OWASP mitigations in Section 10.2.4.

---

## BDD Mapping Validation (MANDATORY) (FR-051)

After writing Section 11.2, perform this validation:

1. **Count acceptance scenarios in Section 5**: For each US-XX, count every Given/When/Then block
2. **Count Gherkin scenarios in Section 11.2**: Count every `Scenario:` keyword
3. **The counts MUST match**. If Section 5 has more scenarios than Section 11.2, add the missing ones
4. **Count edge cases in Section 5**: Each edge case should have a Gherkin scenario
5. **Verify source references**: Every Gherkin scenario header MUST include `# Source: US-XX Scenario N` or `# Source: US-XX Edge Case N`

If any acceptance scenarios from Section 5 are missing in Section 11.2:
```
[TRACEABILITY GAP: US-XX Scenario N has no Gherkin scenario in Section 11.2]
```

---

## Quality Checklist

1. [ ] All 6 subsections (11.1-11.6) are present
2. [ ] Coverage thresholds stated: 80% code, 90% branch
3. [ ] Every acceptance scenario from Section 5 has a Gherkin scenario in 11.2 (1:1)
4. [ ] Every Gherkin scenario has a `# Source: US-XX` reference
5. [ ] Edge cases from Section 5 have corresponding test scenarios
6. [ ] Integration test boundaries identified with mock strategies
7. [ ] E2E tests cover P1 user flows from Section 6
8. [ ] Performance test targets match NFRs from Section 10.1
9. [ ] Security tests cover OWASP mitigations from Section 10.2.4
10. [ ] Test names describe behavior, not function names
11. [ ] Active patterns from the coordinator prompt have been followed
