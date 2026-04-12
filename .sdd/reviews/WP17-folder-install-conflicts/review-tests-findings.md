---
skill: review-tests
wp: WP17
spec: .sdd/specs/003-folder-segregation-and-onboarding.spec.md
reviewed_at: 2026-04-12T14:00:00Z
status: completed
review_round: 2
finding_counts:
  pass: 6
  warn: 3
  fail: 0
  na: 0
files_reviewed:
  - test/suite/folderInstall.test.ts
  - test/suite/lifecycle.test.ts
  - src/services/conflictResolver.ts
  - src/services/lifecycle.ts
---

# review-tests Findings for WP17 (Round 2)

## Summary

Re-review focused on verifying FB-01 and FB-02 fixes. Both previously-FAIL findings are now resolved. T17-05 tests rewritten to exercise resolveFolderConflict() with mocked showQuickPick. FR-013 404 error handling now has test coverage in lifecycle.test.ts. No new issues introduced. Three carried-over WARNs remain from round 1 (BDD scenario gaps, stale coverage report, missing integration test).

## Delta

- **Resolved**: TEST-001 (FB-01), TEST-002 (FB-02)
- **New issues**: 0
- **Regressions**: 0

## Findings

### TEST-001 [PASS] (previously FAIL - resolved)
- **Checklist item**: Test Validity - Vacuous test
- **Requirement**: FR-040 dimension 1
- **File**: test/suite/folderInstall.test.ts#L339-L412
- **Description**: T17-05 tests for resolveFolderConflict have been rewritten. The function is now imported and called in all 4 tests. vscode.window.showQuickPick is mocked via direct replacement with try/finally cleanup. Tests verify: (1) selected candidate return with fullSourcePath/folderName assertions, (2) undefined return on dismiss, (3) actual log output for selection including folder name, (4) actual log output for cancellation including target path.
- **Evidence**: resolveFolderConflict(conflict, log) is invoked in every test. Assertions check real return values and real log messages produced by the function.

### TEST-002 [PASS] (previously FAIL - resolved)
- **Checklist item**: Coverage - New code without tests
- **Requirement**: FR-040 dimension 2
- **File**: test/suite/lifecycle.test.ts#L383-L407
- **Description**: New test exercises applyUpdate() with a getFileContent mock that throws 404 Not Found. Uses assert.rejects with a predicate that verifies: (1) error message includes "Item not found in source", (2) error message includes the item path. Test uses folder-prefixed itemPath matching WP17 scope.
- **Evidence**: Test constructs full LifecycleManager with mocked GitHub client, adds manifest entry, and exercises the error path end-to-end.

### TEST-003 [WARN] (carried over from round 1)
- **Checklist item**: BDD Scenario Matching - Missing scenarios
- **Requirement**: FR-040 dimension 3
- **Description**: Spec Section 11.2 BDD scenarios for US-06 (Scenarios 4-7) lack corresponding tests with full Given/When/Then behavioral flows through LifecycleManager. The new 404 test (TEST-002) partially covers Scenario 7 but as a unit test rather than BDD style.
- **Expected**: Tests exercising update and uninstall flows with folder-prefixed manifest entries as behavioral scenarios.

### TEST-004 [WARN] (carried over from round 1)
- **Checklist item**: Coverage Thresholds - Unable to verify
- **Requirement**: FR-040 dimension 2
- **File**: coverage/lcov.info
- **Description**: Coverage report does not include an entry for src/services/conflictResolver.ts. The report may be stale. Cannot verify the 80% code coverage threshold for conflict detection/resolution code.

### TEST-005 [WARN] (carried over from round 1)
- **Checklist item**: Test Structure - Missing integration test
- **Requirement**: FR-040 dimension 5
- **Description**: WP17 T17-06 acceptance criteria specify integration test requirements. Only unit-level tests for detectCrossFolderConflict and resolveFolderConflict exist.

### TEST-006 [PASS]
- **Checklist item**: Test Validity - Conflict detection tests
- **Requirement**: FR-040 dimension 1
- **File**: test/suite/folderInstall.test.ts#L109-L310
- **Description**: T17-04 tests for detectCrossFolderConflict remain thorough with 10+ test cases.

### TEST-007 [PASS]
- **Checklist item**: Edge Case Coverage
- **Requirement**: FR-040 dimension 4
- **File**: test/suite/folderInstall.test.ts#L480-L560
- **Description**: Edge cases tested: empty manifest, manifest-only conflict, no duplicates, folderDisplayName, directory items, .claude paths.

### TEST-008 [PASS]
- **Checklist item**: Test Validity - Folder prefix stripping tests
- **Requirement**: FR-040 dimension 1
- **File**: test/suite/folderInstall.test.ts#L63-L95
- **Description**: Strip tests verify known folder stripping, root-level unchanged, unknown folder unchanged, empty folders set.

### TEST-009 [PASS]
- **Checklist item**: Test Validity - Installation ID tests
- **Requirement**: FR-040 dimension 1
- **File**: test/suite/folderInstall.test.ts#L101-L130
- **Description**: installationId tests verify full folder-prefixed path, root-level path, different folders produce different IDs.
