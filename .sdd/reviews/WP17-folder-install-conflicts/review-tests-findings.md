---
skill: review-tests
wp: WP17
spec: .sdd/specs/003-folder-segregation-and-onboarding.spec.md
reviewed_at: 2026-04-12T12:00:00Z
status: completed
finding_counts:
  pass: 4
  warn: 3
  fail: 2
  na: 0
files_reviewed:
  - test/suite/folderInstall.test.ts
  - src/services/conflictResolver.ts
  - src/services/lifecycle.ts
  - coverage/lcov.info
---

# review-tests Findings for WP17

## Summary

Reviewed test/suite/folderInstall.test.ts containing 31 tests organized across 7 describe blocks. Core conflict detection tests are solid with good edge case coverage. Two FAIL findings: (1) T17-05 tests for `resolveFolderConflict` are vacuous -- they test values the test itself produces rather than exercising the function, and (2) FR-013 error handling added to lifecycle.ts has no test coverage. Three WARN findings for missing BDD scenario coverage, missing integration tests, and stale coverage report.

## Findings

### TEST-001 [FAIL]
- **Checklist item**: Test Validity - Vacuous test
- **Requirement**: FR-040 dimension 1
- **File**: test/suite/folderInstall.test.ts#L335-L358
- **Description**: T17-05 tests for `resolveFolderConflict` do not call the function at all. They manually write log messages (`log.info('Conflict resolved: ...')`) and then assert the log contains those messages. The assertions cannot fail because the test itself produces the values being asserted. Three acceptance criteria marked [x] in the WP (quick-pick shows candidates, selection returns candidate, dismiss returns undefined) have zero test coverage.
- **Expected**: Mock `vscode.window.showQuickPick` (as spec Section 11.4 prescribes: "Cross-folder conflict integration tests SHALL mock vscode.window.showQuickPick() to simulate both user selection and cancellation paths") and call `resolveFolderConflict()` to verify return values and actual logging behavior.
- **Evidence**: The test creates a mock log, calls `log.info(...)` directly, then asserts the message exists. The `resolveFolderConflict` function is never invoked.

### TEST-002 [FAIL]
- **Checklist item**: Coverage - New code without tests
- **Requirement**: FR-040 dimension 2
- **File**: src/services/lifecycle.ts#L165-L172
- **Description**: WP17 commit a60f450 adds FR-013 "item not found" error handling to `applyUpdate()` in lifecycle.ts. This new code path (404 detection and descriptive error throw) has no test in folderInstall.test.ts and lifecycle.test.ts was not modified by WP17.
- **Expected**: A test exercising the `applyUpdate()` path where the source item returns a 404, verifying the "Item not found in source" error message is thrown.
- **Evidence**: `git diff-tree --no-commit-id -r --name-only a60f450` shows lifecycle.ts was modified. No test exercises the new error handling code path.

### TEST-003 [WARN]
- **Checklist item**: BDD Scenario Matching - Missing scenarios
- **Requirement**: FR-040 dimension 3
- **Description**: Spec Section 11.2 defines BDD scenarios for US-06 (Scenarios 4-7: update from full path, uninstall via targetPaths, overwrite confirmation for folder items, "item not found" on update). These scenarios lack corresponding tests. The folderInstall.test.ts only covers structural assertions (installationId format, manifest entry fields) rather than behavioral tests through LifecycleManager.
- **Expected**: Tests exercising update and uninstall flows with folder-prefixed manifest entries.

### TEST-004 [WARN]
- **Checklist item**: Coverage Thresholds - Unable to verify
- **Requirement**: FR-040 dimension 2
- **File**: coverage/lcov.info
- **Description**: Coverage report (lcov.info) does not include an entry for `src/services/conflictResolver.ts`. The report may be stale (generated before WP17 implementation). Cannot verify the 80% code coverage threshold for conflict detection/resolution code.
- **Expected**: Re-run tests with coverage to generate fresh lcov.info including conflictResolver.ts.

### TEST-005 [WARN]
- **Checklist item**: Test Structure - Missing integration test
- **Requirement**: FR-040 dimension 5
- **Description**: WP17 T17-06 acceptance criteria specify "integration" test requirements for the full conflict detection integration into the install flow. Only unit-level tests for `detectCrossFolderConflict` exist. No integration test wires the install command handler with conflict detection, manifest writes, and file operations.
- **Expected**: An integration test that exercises `installCommand()` with a conflict-producing scenario end-to-end.

### TEST-006 [PASS]
- **Checklist item**: Test Validity - Conflict detection tests
- **Requirement**: FR-040 dimension 1
- **File**: test/suite/folderInstall.test.ts#L109-L310
- **Description**: T17-04 tests for `detectCrossFolderConflict` are thorough with 10+ test cases: two-folder conflict, manifest-only conflict, no conflict, empty folders, root-level items, same-folder items, tree vs blob filtering, 3+ candidates, deduplication, and NFR-005 performance test with 100 entries.

### TEST-007 [PASS]
- **Checklist item**: Edge Case Coverage
- **Requirement**: FR-040 dimension 4
- **File**: test/suite/folderInstall.test.ts#L380-L490
- **Description**: Edge cases tested: empty manifest with no conflicts, manifest-only conflict (no tree entries), no duplicate candidates when item appears in both entries and manifest, folderDisplayName formatting, directory items, .claude paths.

### TEST-008 [PASS]
- **Checklist item**: Test Validity - Folder prefix stripping tests
- **Requirement**: FR-040 dimension 1
- **File**: test/suite/folderInstall.test.ts#L63-L95
- **Description**: T17-01 strip tests verify: known folder stripping, root-level unchanged, unknown folder unchanged, empty folders set, full path structure preserved. All use real `stripFolderPrefix` function with meaningful assertions.

### TEST-009 [PASS]
- **Checklist item**: Test Validity - Installation ID tests
- **Requirement**: FR-040 dimension 1
- **File**: test/suite/folderInstall.test.ts#L101-L130
- **Description**: T17-02 tests verify installationId includes full folder-prefixed path, root-level path works, and different folders produce different IDs. Meaningful assertions using real `installationId` function.
