---
name: code-integration-tests
description: "Integration test writing for component boundaries and external dependencies"
argument-hint: "Invoked by Coder Coordinator - do not call directly"
---

# code-integration-tests

> **Phase**: 4 (Integration Tests)
> **Common contract**: `.github/skills/CODER-SKILL-CONTRACT.md`
> **Spec refs**: FR-031, FR-032, FR-033

This skill is dispatched by the Coder Coordinator during Phase 4. It writes integration tests for component boundaries, uses contract schemas to generate mock responses for external dependencies, includes data setup and teardown, and reports results to the coordinator.

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

1. **Read SKILL.md** -- Load this file for integration test writing instructions
2. **Read WP + contracts** -- Read the WP file and contract files to understand component boundaries, API schemas, and data models
3. **Read spec sections** -- Read the spec sections referenced by the WP's tasks for integration requirements
4. **Execute test writing and execution** -- Identify boundaries, write integration tests, run them, report results (Steps 1-5 below)
5. **Report results** -- Report files modified, tasks completed, test results (pass/fail counts), and issues back to the coordinator

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

The coordinator uses `test_results.fail_count` to decide whether to dispatch the debug skill (FR-010). This field MUST be present and accurate.

---

## Step 1 -- Identify Component Boundaries (FR-031.1)

Before writing tests, identify all integration points within the WP's scope.

### 1a. Scan for Boundaries

Read the implementation source files (produced by `code-implementation` in Phase 2) and contract files to identify:

| Boundary Type | What to Look For |
|---------------|-----------------|
| Module-to-module | Function calls across source files or packages |
| Service-to-database | Database connection, query, or ORM usage |
| Service-to-external-API | HTTP client calls, SDK usage, gRPC stubs |
| Service-to-cache | Redis, Memcached, or in-memory cache interactions |
| Service-to-queue | Message publish/subscribe, job enqueue |
| Service-to-filesystem | File read/write for data persistence (not config) |

### 1b. Map Boundaries to Contract Files

For each identified boundary, check if a corresponding contract file exists in `contracts_dir`:

| Contract File | Boundary It Defines |
|---------------|-------------------|
| `api-contracts.<ext>` | External API request/response schemas |
| `data-schemas.<ext>` | Database entity schemas |
| `interfaces.<ext>` | Module-to-module function signatures |
| `error-catalog.<ext>` | Error responses at boundaries |

If a boundary has a contract file, use the contract to define expected inputs/outputs for the integration test. If no contract exists, derive expectations from the spec and implementation.

### 1c. Prioritize Boundaries

Test boundaries in this priority order:
1. Cross-module calls within the WP (most likely to have integration bugs)
2. Database/storage interactions (data integrity)
3. External API integrations (contract compliance)
4. Cache, queue, and filesystem interactions

---

## Step 2 -- Write Integration Tests (FR-031, FR-032)

### 2a. Cross-Module Boundary Tests (FR-031.1)

Write tests that exercise real call paths across module boundaries within the WP's scope:

- Import both modules
- Call the entry point that triggers the cross-module interaction
- Assert on the final output, verifying the modules integrate correctly
- Do NOT mock the internal boundary -- test the real integration

```python
# GOOD: Tests real module integration
def test_order_service_creates_order_and_updates_inventory():
    order_service = OrderService(inventory_repo=real_inventory_repo)
    result = order_service.create_order(order_input)
    assert result.status == "confirmed"
    assert inventory_repo.get_stock(item_id) == original_stock - quantity
```

### 2b. Database/Storage Tests (FR-031.2)

If the WP sets up data persistence, write tests against real database interactions:

- Use a test database or in-memory database (e.g., SQLite for SQL, testcontainers for PostgreSQL)
- Test the full CRUD lifecycle: create, read, update, delete
- Verify data integrity constraints (unique keys, foreign keys, not-null)
- Test concurrent access patterns if the spec mentions them

```python
# GOOD: Tests real database interaction
def test_user_repository_saves_and_retrieves():
    repo = UserRepository(db=test_db)
    user = repo.create(CreateUserInput(email="a@b.com", name="Test"))
    retrieved = repo.get_by_id(user.id)
    assert retrieved.email == "a@b.com"
    assert retrieved.name == "Test"
```

### 2c. External API Mock Tests (FR-031.3, FR-032.1, FR-032.3)

For external dependencies, use contract files to generate mock responses that match exact schemas:

1. **Read the contract file** (`api-contracts.<ext>`) for the external API
2. **Build mock responses** that match the contract's response schema exactly -- same field names, same types, same structure
3. **Configure the mock** to return the contract-conforming response
4. **Verify** the integration point processes the response correctly
5. **Verify** request payloads match the contract's request schema

```python
# GOOD: Mock response matches the contract schema exactly
@responses.activate
def test_payment_service_processes_charge():
    # Response matches api-contracts.py PaymentResponse schema
    responses.add(
        responses.POST,
        "https://api.payment.com/charges",
        json={"id": "ch_123", "status": "succeeded", "amount": 5000},
        status=200,
    )
    result = payment_service.charge(amount=5000, currency="usd")
    assert result.charge_id == "ch_123"
    assert result.status == "succeeded"
```

**Contract compliance rule**: Mock responses SHALL NOT use arbitrary test data. Every mock response MUST conform to the schema defined in the contract file. If a contract defines `PaymentResponse { id: string, status: string, amount: int }`, the mock MUST return exactly those fields with correct types.

### 2d. Data Setup and Teardown (FR-031.4)

Every integration test SHALL include explicit data setup and teardown:

**Setup** (before each test):
- Create required test data (users, orders, configs)
- Initialize database state
- Configure mock servers
- Set environment variables if needed

**Teardown** (after each test):
- Remove test data created during the test
- Reset database state
- Clear mock registrations
- Restore environment variables

Use the test framework's built-in mechanisms:

| Language | Setup/Teardown |
|----------|---------------|
| Python (pytest) | `@pytest.fixture` with `yield` for cleanup |
| TypeScript (Jest) | `beforeEach`/`afterEach` or `beforeAll`/`afterAll` |
| Go | `t.Cleanup()` or `TestMain` |
| Rust | Custom `Drop` implementations or test helper functions |

**Isolation rule**: Each integration test SHALL be independent. Test A's data SHALL NOT leak into Test B. Use unique identifiers (UUIDs, timestamps) for test data to prevent collisions.

### 2e. Timeout, Retry, and Error Handling Tests (FR-032.2)

Test failure modes at integration boundaries:

| Failure Mode | Test Scenario |
|-------------|--------------|
| Timeout | Mock an external API to delay beyond the configured timeout. Verify the service handles the timeout gracefully (returns error, does not hang). |
| Connection refused | Mock a service that refuses connections. Verify error handling. |
| HTTP 4xx errors | Return 400, 401, 403, 404 from mocked API. Verify each is handled per spec. |
| HTTP 5xx errors | Return 500, 502, 503 from mocked API. Verify retry logic (if spec requires) or error propagation. |
| Malformed response | Return invalid JSON or missing required fields. Verify the service does not crash. |
| Database constraint violation | Attempt to insert duplicate keys or violate constraints. Verify proper error handling. |

### 2f. Contract Schema Verification (FR-032.3)

Verify that integration points match the API contract schemas:

1. For each API endpoint called by the implementation, verify the request payload matches the contract's request schema
2. For each API response processed, verify the code handles all fields defined in the contract's response schema
3. If the contract defines error responses, verify the code handles each error response type

---

## Step 3 -- Organize Integration Test Files

### 3a. File Placement

Place integration tests in a separate directory from unit tests:

| Language | Convention |
|----------|-----------|
| Python | `tests/integration/test_<boundary>.py` |
| TypeScript | `tests/integration/<boundary>.test.ts` |
| Go | `integration_test.go` with build tag `//go:build integration` |
| Rust | `tests/<boundary>_integration.rs` (top-level `tests/` directory) |

### 3b. Test Naming

Name integration tests to describe the boundary being tested:
- Good: `test_order_service_with_payment_gateway`
- Good: `test_user_repo_postgres_crud_lifecycle`
- Bad: `test_integration_1`
- Bad: `test_it_works_together`

---

## Step 4 -- Run Integration Tests and Report Results (FR-033)

### 4a. Run Integration Tests

Execute integration tests separately from unit tests:

| Language | Command |
|----------|---------|
| Python | `pytest tests/integration/ -v` |
| TypeScript (Jest) | `npx jest --testPathPattern=integration` |
| Go | `go test -tags=integration ./...` |
| Rust | `cargo test --test '*_integration'` |

### 4b. Capture Results

Record from the test output:
- Total integration tests run
- Tests passed (`pass_count`)
- Tests failed (`fail_count`)
- List of failing test names and error messages (if any)

### 4c. Report to Coordinator

Include test results in the output contract:

```
test_results:
  pass_count: <number>
  fail_count: <number>
  coverage_pct: <number or null>
```

If any tests fail:
- Set `fail_count` to the exact number of failing tests
- Include the failing test names and error messages in `issues`
- The coordinator will use `fail_count > 0` to trigger debug skill dispatch

---

## Step 5 -- Handle Missing Prerequisites

Integration tests may require infrastructure that is not available in all environments.

### 5a. Detect Missing Prerequisites

Before running integration tests, check for required infrastructure:

| Prerequisite | Detection |
|-------------|-----------|
| Database | Check for connection string in env vars or config; try connecting |
| External service | Check for API keys/URLs in env vars or config |
| Docker | Check for `docker` command availability |
| Message queue | Check for connection parameters |

### 5b. Report Missing Prerequisites

If a prerequisite is missing:
- Do NOT silently skip the test
- Report the missing prerequisite clearly in `issues`:
  ```
  "Integration test for <boundary> skipped: <prerequisite> not available. 
   Required: <what is needed>. Setup: <how to provide it>."
  ```
- Set `status: success` (missing infrastructure is not a skill failure)
- Mark skipped tests with the framework's skip mechanism (e.g., `pytest.mark.skip`, `it.skip`)
- The coordinator will escalate if needed

---

## Constraints

### SHALL NOT: Arbitrary Mock Data

Mock responses SHALL be derived from contract files, not invented. If `api-contracts.py` defines a `PaymentResponse` with fields `{id, status, amount}`, the mock SHALL return exactly those fields with correct types. Do NOT add fields not in the contract. Do NOT omit required fields.

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
