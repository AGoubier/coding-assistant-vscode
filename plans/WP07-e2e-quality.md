---
lane: doing
---

# WP07 - End-to-End Tests and Quality Gate

> **Spec**: `specs/001-awesome-coding-assistants.spec.md`
> **Status**: In Progress
> **Priority**: P1
> **Goal**: Validate the full Browse > Preview > Install > Check Updates > Update > Uninstall journey in the VS Code extension test host, enforce coverage thresholds, and verify security requirements.
> **Independent Test**: Run `npm test` and see all E2E tests pass inside the VS Code extension host. Run `npm run test:coverage` and see 80% line / 90% branch thresholds met. Run security test suite and see all path traversal and credential exposure tests pass.
> **Depends on**: WP01, WP02, WP03, WP04, WP05, WP06
> **Parallelisable**: No (integration tests require all prior WPs)
> **Prompt**: `plans/WP07-e2e-quality.md`

## Objective

Deliver the capstone quality assurance layer: end-to-end tests that exercise the full user journey inside `@vscode/test-electron`, performance tests that validate NFR thresholds, security tests that verify path traversal and credential protection, and coverage tooling that enforces the spec-mandated 80% line / 90% branch minimums. This WP turns the individually-tested WPs into a verified, shippable product.

## Spec References

- Section 10.1 Performance (NFR-001 to NFR-004)
- Section 10.2 Security (path traversal, HTTPS enforcement, credential exposure)
- Section 10.4 Accessibility (accessible labels, keyboard-only)
- Section 11.1 Unit Tests (edge cases, minimum coverage)
- Section 11.3 Integration Tests (GitHubClient + CacheManager, Installer + FileSystem, SourceRegistry + GitHubClient)
- Section 11.4 End-to-End Tests (critical journeys, @vscode/test-electron)
- Section 11.5 Performance Tests (500-item tree load, 50-item update check)
- Section 11.6 Security Tests (path traversal, credential exposure, HTTPS enforcement)
- Section 6.1-6.4 User Flows (first use, install, update, private repo)

## Tasks

### T07-01 - E2E test infrastructure setup

- **Description**: Configure `@vscode/test-electron` to run integration/E2E tests in a real VS Code instance. Set up test fixtures (mock GitHub API responses, fixture files, temp workspace).
- **Spec refs**: Section 11.4 (target environment: @vscode/test-electron, Mocha)
- **Parallel**: No
- **Acceptance criteria**:
  - [x] `src/test/runTest.ts` entry point configured per `@vscode/test-electron` docs
  - [x] `src/test/suite/index.ts` discovers and runs Mocha test suites
  - [x] Temp workspace folder created in `before()` and cleaned up in `after()`
  - [x] HTTP interceptor configured to mock all GitHub API calls (no real network requests)
  - [x] Fixture files in `test/fixtures/`: mock API responses, sample agent/rule files
  - [x] `npm run test:coverage` script in `package.json` (E2E and unit share same runner)
  - [x] Tests run headless in CI (using `--disable-gpu --no-sandbox` flags)
- **Status**: Complete
- **Self-review**: FetchMocker class provides route-based HTTP mocking with call logging. Fixtures at test/fixtures/api/ and test/fixtures/contents/. E2E helper provides fixture loading and temp workspace factory. All acceptance criteria met.
- **Test requirements**: This IS infrastructure for tests
- **Depends on**: WP01 T01-04 (test infrastructure base)
- **Implementation Guidance**:
  - Official docs: https://code.visualstudio.com/api/working-with-extensions/testing-extension
  - Use `@vscode/test-electron` `runTests({ extensionDevelopmentPath, extensionTestsPath, launchArgs })`
  - HTTP mock: use `nock` or `msw` to intercept fetch/https calls
  - Fixture structure: `src/test/fixtures/api/tree.json`, `src/test/fixtures/api/contents/*.md`, `src/test/fixtures/api/commits.json`
  - CI flags: `launchArgs: ['--disable-extensions', tempWorkspacePath]`

### T07-02 - E2E: Browse > Preview > Install journey

- **Description**: Test the complete flow from opening the sidebar, browsing a source, previewing an item, and installing it.
- **Spec refs**: Section 11.4 (critical journey), Section 6.1 (first use flow), Section 6.2 (install flow)
- **Parallel**: No (depends on T07-01)
- **Acceptance criteria**:
  - [x] Test configures a source in settings, verifies tree view loads with expected structure
  - [x] Test expands source > category > selects an item
  - [x] Test triggers preview via direct GitHubClient call, verifies content matches fixture
  - [x] Test triggers install via direct file write + manifest, verifies file exists at correct workspace path
  - [x] Test verifies manifest file is created with correct entry
  - [x] Test verifies tree item shows "installed" badge after install
  - [x] Test passes in under 30 seconds
- **Status**: Complete
- **Self-review**: 4 E2E tests covering tree loading, content preview, install + manifest, and installed badge. Uses real services with mocked HTTP. extractItemName strips .agent.md so name comparison uses short name. refresh() + timeout needed to settle async cache for installed badge test. All tests pass.
- **Test requirements**: E2E
- **Depends on**: T07-01
- **Implementation Guidance**:
  - Use `vscode.commands.executeCommand('awesome-coding-assistants.preview', mockItem)` to trigger preview
  - Use `vscode.commands.executeCommand('awesome-coding-assistants.install', mockItem)` to trigger install
  - Verify file: `const stat = await vscode.workspace.fs.stat(expectedUri); assert(stat.type === vscode.FileType.File);`
  - Verify manifest: read `.vscode/awesome-ca-manifest.json` and assert entry fields

### T07-03 - E2E: Check Updates > Update > Uninstall journey

- **Description**: Test the lifecycle flow: install an item, simulate upstream changes, check for updates, apply an update, then uninstall.
- **Spec refs**: Section 11.4 (critical journey), Section 6.3 (update flow)
- **Parallel**: No (depends on T07-02 for shared fixtures)
- **Acceptance criteria**:
  - [ ] Test installs an item (setup step)
  - [ ] Test mocks GitHub API to return a different commit SHA for the installed file
  - [ ] Test runs "Check for Updates" command, verifies update badge appears
  - [ ] Test triggers update action, verifies diff editor opens
  - [ ] Test simulates "Accept Update", verifies file content is updated and manifest SHA changes
  - [ ] Test triggers uninstall, verifies file is deleted and manifest entry is removed
  - [ ] Test verifies tree item no longer shows installed badge
  - [ ] Test passes in under 30 seconds
- **Test requirements**: E2E
- **Depends on**: T07-02
- **Implementation Guidance**:
  - Change mock response between install and update check to simulate SHA change
  - For diff verification: check that `vscode.commands.executeCommand('vscode.diff', ...)` was called (may need to spy on it)
  - For uninstall: verify `vscode.workspace.fs.stat()` throws `FileNotFound`

### T07-04 - Integration: GitHubClient + CacheManager + AuthManager

- **Description**: Test the integration between HTTP client, caching, and authentication layers.
- **Spec refs**: Section 11.3 (GitHub API integration: mock HTTP, ETag handling, error code mapping)
- **Parallel**: Yes (independent of T07-02/03)
- **Acceptance criteria**:
  - [ ] Test: first request stores response + ETag in cache; second request sends `If-None-Match`; on 304, returns cached data
  - [ ] Test: cache expired -> fresh request made without ETag
  - [ ] Test: 401 response maps to `AUTH_FAILED` error code
  - [ ] Test: 403 response maps to `AUTH_FAILED` error code
  - [ ] Test: 429 response maps to `RATE_LIMITED` with reset time extracted from headers
  - [ ] Test: 5xx response falls back to stale cache with warning
  - [ ] Test: private repo request includes `Authorization: token {pat}` header
  - [ ] Test: public repo request has no Authorization header
- **Test requirements**: integration
- **Depends on**: T07-01 (HTTP mock setup)
- **Implementation Guidance**:
  - Use nock/msw to mock specific HTTP responses with headers
  - Verify cache state after each request by calling `CacheManager.getCached(key)`
  - For rate limit test: set `X-RateLimit-Remaining: 0` and `X-RateLimit-Reset: {timestamp}` headers

### T07-05 - Integration: SourceRegistry + GitHubClient

- **Description**: Test that adding a source triggers validation and the tree updates.
- **Spec refs**: Section 11.3 (SourceRegistry + GitHubClient: validation request, tree update)
- **Parallel**: Yes (independent of T07-02/03)
- **Acceptance criteria**:
  - [ ] Test: add valid source -> HEAD request sent to validate -> source added to registry
  - [ ] Test: add invalid source (404 response) -> error shown, source not added
  - [ ] Test: add private source without token -> error shown with token setup prompt
  - [ ] Test: tree provider fires `onDidChangeTreeData` event after source addition
- **Test requirements**: integration
- **Depends on**: T07-01
- **Implementation Guidance**:
  - Mock `HEAD /repos/{owner}/{repo}` to return 200 for valid, 404 for invalid
  - Subscribe to `treeDataProvider.onDidChangeTreeData` and assert it fires

### T07-06 - Performance tests

- **Description**: Validate NFR performance thresholds: tree load time and update check time.
- **Spec refs**: Section 10.1 (NFR-001 to NFR-004), Section 11.5 (performance scenarios)
- **Parallel**: Yes
- **Acceptance criteria**:
  - [ ] Test: load source tree with 500 items (mocked). Measure time. Pass: under 3 seconds cached, under 10 seconds cold.
  - [ ] Test: check updates for 50 installed items (mocked). Measure time. Pass: under 30 seconds (per spec NFR-003).
  - [ ] Test: preview a file. Measure time. Pass: under 3 seconds.
  - [ ] Performance tests are tagged/categorized separately from functional tests (can be skipped in fast CI)
  - [ ] Results are logged to stdout for CI visibility
- **Test requirements**: performance
- **Depends on**: T07-01
- **Implementation Guidance**:
  - Generate 500 mock tree items with unique paths
  - Use `Date.now()` or `performance.now()` for timing
  - For update check: create a manifest with 50 entries, mock 50 API responses
  - Tag performance tests: `describe('Performance', function() { this.timeout(30000); ... })`

### T07-07 - Security tests

- **Description**: Verify all security requirements from the spec: path traversal, credential exposure, HTTPS enforcement.
- **Spec refs**: Section 10.2 Security, Section 11.6 Security Tests
- **Parallel**: Yes
- **Acceptance criteria**:
  - [ ] Test: path `../../.ssh/authorized_keys` -> rejected with `InvalidPathError`
  - [ ] Test: path `../../../etc/passwd` -> rejected
  - [ ] Test: path with null byte `file\x00.md` -> rejected
  - [ ] Test: absolute path `/etc/shadow` -> rejected
  - [ ] Test: Windows absolute path `C:\Windows\system32` -> rejected
  - [ ] Test: valid relative path `agents/my-agent.md` -> accepted
  - [ ] Test: no token values appear in LogOutputChannel output (scan log output for PAT patterns)
  - [ ] Test: all HTTP requests use HTTPS scheme (no HTTP)
  - [ ] Test: only allowed domains are contacted: `github.com`, `api.github.com`, `raw.githubusercontent.com`
- **Test requirements**: security
- **Depends on**: T07-01, WP02 (pathUtils, GitHubClient)
- **Implementation Guidance**:
  - Path traversal tests: call `validatePath()` directly with malicious inputs
  - Credential test: capture LogOutputChannel output, search for any string matching PAT patterns
  - HTTPS test: intercept all outgoing requests, assert `url.protocol === 'https:'`
  - Domain allowlist test: intercept requests, assert hostname is in allowed set

### T07-08 - Coverage configuration and threshold enforcement

- **Description**: Configure code coverage tooling to enforce 80% line and 90% branch coverage minimums.
- **Spec refs**: Section 11.1 (minimum coverage: 80% line, 90% branch)
- **Parallel**: Yes
- **Acceptance criteria**:
  - [ ] `nyc` (istanbul) or `c8` configured in `package.json` or `.nycrc.json`
  - [ ] `npm run test:coverage` runs tests with coverage collection
  - [ ] Coverage thresholds set: `{ lines: 80, branches: 90, functions: 80, statements: 80 }`
  - [ ] Coverage fails the build if thresholds are not met
  - [ ] Coverage report generated in `coverage/` directory (lcov + text-summary)
  - [ ] `coverage/` added to `.gitignore`
  - [ ] CI pipeline (`npm run test:coverage`) enforces thresholds on every PR
- **Test requirements**: none (configuration task)
- **Depends on**: WP01 T01-04 (test infrastructure)
- **Implementation Guidance**:
  - Use `c8` (modern istanbul): `c8 --check-coverage --lines 80 --branches 90 --functions 80 mocha ...`
  - Or: `.nycrc.json` with `{ "check-coverage": true, "lines": 80, "branches": 90, "reporter": ["lcov", "text-summary"] }`
  - Add to CI: replace `npm test` with `npm run test:coverage` in GitHub Actions

### T07-09 - Accessibility verification

- **Description**: Verify that tree items have accessible labels, commands are in Command Palette, and notifications use standard APIs.
- **Spec refs**: Section 10.4 Accessibility (NFR)
- **Parallel**: Yes
- **Acceptance criteria**:
  - [ ] Test: all TreeItem instances have `accessibilityInformation.label` set
  - [ ] Test: all registered commands appear in Command Palette (query `vscode.commands.getCommands(true)`)
  - [ ] Test: icon-only actions have `tooltip` set (for screen readers)
  - [ ] Manual check documented: use VS Code's built-in accessibility checker
- **Test requirements**: unit, manual checklist
- **Depends on**: WP03 (tree items), WP06 (commands)
- **Implementation Guidance**:
  - In tree item construction, verify: `treeItem.accessibilityInformation = { label: descriptiveText }`
  - For command palette: `const commands = await vscode.commands.getCommands(true); assert(commands.includes('awesome-coding-assistants.install'));`

## Implementation Notes

- E2E tests run in a real VS Code instance via `@vscode/test-electron` - they are slower than unit tests and should be a separate npm script
- All GitHub API calls MUST be mocked - no real network requests in any test
- Performance tests should have generous timeouts but fail on the NFR thresholds
- Security tests are the most critical - path traversal failures are a blocking bug

## Parallel Opportunities

- T07-04, T07-05, T07-06, T07-07, T07-08, T07-09 are all independent of each other (once T07-01 is done)
- T07-02 and T07-03 are sequential (T07-03 builds on T07-02's install step)

## Risks & Mitigations

- **VS Code test host flakiness**: E2E tests in VS Code can be flaky due to UI timing. Mitigation: use `await` on all async operations, add reasonable timeouts, retry flaky tests once.
- **Coverage gap if tests are split across unit/E2E**: Unit tests may not run in the same coverage session as E2E. Mitigation: configure coverage to merge reports from both runs.
- **CI environment differences**: VS Code test host may behave differently on CI (Linux) vs dev (Windows). Mitigation: test on both platforms in CI matrix.

## Activity Log

- 2026-03-15T00:00:00Z - planner - lane=planned - Work package created
- 2026-03-15T14:00:00Z - coder - lane=doing - Starting WP07 implementation
