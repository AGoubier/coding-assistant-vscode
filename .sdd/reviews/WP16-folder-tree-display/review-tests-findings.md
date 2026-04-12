---
skill: review-tests
wp: WP16
spec: .sdd/specs/003-folder-segregation-and-onboarding.spec.md
reviewed_at: 2026-04-12T17:00:00Z
status: completed
finding_counts:
  pass: 5
  warn: 1
  fail: 0
  na: 0
files_reviewed:
  - test/suite/catalogTree.test.ts
  - src/providers/catalogTree.ts
---

# review-tests Findings for WP16

## Summary

Evaluated 6 test quality dimensions for 19 folder tree display tests. 5 pass; 1 WARN for a test named as an error fallback test that does not actually test the error path. Overall test coverage is strong with good BDD scenario coverage.

## Findings

### TEST-001 [PASS]
- **Checklist item**: Dimension 1 - Test Validity
- **File**: test/suite/catalogTree.test.ts#L1206-L1710
- **Description**: All 19 test functions contain meaningful assertions (strictEqual, ok, includes). No vacuous assertions, no empty test bodies, no tests that mock the subject under test.

### TEST-002 [PASS]
- **Checklist item**: Dimension 2 - Coverage Thresholds
- **File**: test/suite/catalogTree.test.ts
- **Description**: WP16 frontmatter specifies `coverage_code: 80` and `coverage_branch: 90`. All 507 tests pass. Coverage tooling is configured (`scripts/coverage-report.js`, `coverage/lcov.info`). The extensive test matrix covers FR-004 through FR-007, FR-016, NFR-007, NFR-010, NFR-011, and error scenarios.

### TEST-003 [PASS]
- **Checklist item**: Dimension 3 - BDD Scenario Matching
- **File**: test/suite/catalogTree.test.ts#L1264-L1660
- **Description**: Tests map to spec scenarios: US-02.1 (browse with folders) covered by FR-004 tests, US-02.2 (no folders flat) covered by FR-005 tests, US-03.1 (Default + real folders) covered by FR-006/FR-007 tests. Test describe blocks reference spec FR numbers directly.

### TEST-004 [WARN]
- **Checklist item**: Dimension 4 - Edge Case Coverage
- **File**: test/suite/catalogTree.test.ts#L1635-L1650
- **Description**: Test "should fall back to flat hierarchy when detectFolders throws" (line ~1635) uses `NO_FOLDER_TREE` which has no folders -- it exercises the normal FR-005 path (no folders detected), not the error catch path in `getSourceChildren()`. The `detectFolders()` function will simply return an empty array, never throwing. The test name is misleading and the error fallback code path at `catalogTree.ts:432` (the inner catch block in `getSourceChildren()`) is not exercised.
- **Expected**: To test the error fallback, mock `detectFolders` to throw an error while providing a tree with entries that would normally trigger folder detection. Verify `getCategoryNodes()` is called as fallback and categories appear (not folder nodes).

### TEST-005 [PASS]
- **Checklist item**: Dimension 5 - Test Structure
- **File**: test/suite/catalogTree.test.ts#L1206-L1710
- **Description**: Tests follow Arrange/Act/Assert pattern. describe blocks are organized by FR number. Test fixtures (FOLDER_TREE, FOLDER_ONLY_TREE, NO_FOLDER_TREE, EMPTY_FOLDER_TREE) are well-named with clear comments. Each test is isolated with proper setup/teardown (dispose calls).

### TEST-006 [PASS]
- **Checklist item**: Dimension 6 - Error Path Testing
- **File**: test/suite/catalogTree.test.ts#L1645-L1657
- **Description**: Test "should show error node when folder children rendering fails" properly tests the `getFolderChildren()` error path by making `getRepoTree` throw a Network error. Verifies error node is returned with correct kind and message. This exercises the outer error handling path correctly.
