---
skill: review-spec
wp: WP16
spec: .sdd/specs/003-folder-segregation-and-onboarding.spec.md
reviewed_at: 2026-04-12T17:00:00Z
status: completed
finding_counts:
  pass: 11
  warn: 0
  fail: 0
  na: 1
files_reviewed:
  - src/providers/catalogTree.ts
  - src/models/types.ts
  - test/suite/catalogTree.test.ts
---

# review-spec Findings for WP16

## Summary

Evaluated 12 functional requirements and NFRs within WP16 scope (FR-004 through FR-008, FR-012, FR-016, NFR-002, NFR-007, NFR-010, NFR-011). All 11 verifiable requirements are fully compliant. NFR-002 (50ms overhead budget) requires runtime benchmarking and is deferred.

## Findings

### SPEC-001 [PASS]
- **Checklist item**: FR classification - SHALL obligation
- **Requirement**: FR-004 (Source > Folder > Category > Items hierarchy)
- **File**: src/providers/catalogTree.ts#L300-L370
- **Description**: `getFolderNodes()` builds folder items and `getSourceChildren()` returns them when folders exist. `getFolderChildren()` returns scoped category nodes. Full hierarchy verified by tests.

### SPEC-002 [PASS]
- **Checklist item**: FR classification - SHALL obligation
- **Requirement**: FR-005 (Flat hierarchy when no folders)
- **File**: src/providers/catalogTree.ts#L420-L445
- **Description**: `getSourceChildren()` falls through to `getCategoryNodes()` when `getFolderNodes()` returns empty array. Existing behavior preserved.

### SPEC-003 [PASS]
- **Checklist item**: FR classification - SHALL obligation
- **Requirement**: FR-006 (Default folder for root-level items)
- **File**: src/providers/catalogTree.ts#L350-L367
- **Description**: `getFolderNodes()` checks for root-level classifiable entries via `grouped.get('')` and prepends Default folder with `isDefault: true` and display name "Default". Accessibility label follows spec pattern.

### SPEC-004 [PASS]
- **Checklist item**: FR classification - SHALL obligation
- **Requirement**: FR-007 (No Default when no real folders exist)
- **File**: src/providers/catalogTree.ts#L310-L315
- **Description**: `getFolderNodes()` returns empty array when `detectionResults.length === 0`, so no Default appears. Caller falls back to flat hierarchy per FR-005.

### SPEC-005 [PASS]
- **Checklist item**: FR classification - SHALL obligation
- **Requirement**: FR-008 (Folder name formatting)
- **File**: src/providers/catalogTree.ts#L330
- **Description**: `getFolderNodes()` calls `formatFolderName(result.folderName)` for display names. The Default folder uses literal "Default" without formatting (FR-009 compliance).

### SPEC-006 [PASS]
- **Checklist item**: FR classification - SHALL obligation
- **Requirement**: FR-016 (Empty folder hiding)
- **File**: src/providers/catalogTree.ts#L320-L340
- **Description**: Each folder's entries are checked for classifiable items. Folders where all blob entries classify as `tool: 'unknown'` are excluded from output. Verified by test.

### SPEC-007 [PASS]
- **Checklist item**: FR classification - SHALL obligation
- **Requirement**: FR-012 (Full path retained in CatalogFileItem)
- **File**: src/providers/catalogTree.ts#L700-L720
- **Description**: `getFileNodes()` sets `path: entry.path` (full source path including folder prefix) and `installationId()` uses the full path. Classification uses stripped path but the item retains the original.

### SPEC-008 [PASS]
- **Checklist item**: Data model match
- **Requirement**: Section 7.2 (FolderItem)
- **File**: src/models/types.ts#L125-L132
- **Description**: `FolderItem` interface has all required fields: `kind: 'folder'`, `source`, `folderName`, `displayName`, `isDefault`. Added to `CatalogItem` union type.

### SPEC-009 [PASS]
- **Checklist item**: FR classification - error path
- **Requirement**: FR-004 error behavior (render failure shows error node)
- **File**: src/providers/catalogTree.ts#L450-L475
- **Description**: `getSourceChildren()` wraps `getFolderNodes()` in try/catch and falls back to flat hierarchy on error. `getFolderChildren()` catches errors and returns descriptive error node. Errors logged at error level.

### SPEC-010 [PASS]
- **Checklist item**: NFR verification
- **Requirement**: NFR-010, NFR-011 (Accessibility labels)
- **File**: src/providers/catalogTree.ts#L950-L970
- **Description**: `createFolderTreeItem()` sets accessibility labels: `"Folder: <display name>, source: <source name>"` for real folders and `"Default folder (root-level items), source: <source name>"` for Default. Both patterns match spec exactly.

### SPEC-011 [PASS]
- **Checklist item**: NFR verification
- **Requirement**: NFR-007 (Scalability - up to 20 folders)
- **File**: test/suite/catalogTree.test.ts#L1660-L1695
- **Description**: Test creates 20 folder entries and verifies all 20 folder nodes render correctly. Implementation uses O(n) iteration, no algorithmic bottleneck.

### SPEC-012 [N/A]
- **Checklist item**: NFR verification
- **Requirement**: NFR-002 (50ms overhead budget)
- **Justification**: Performance budget verification requires runtime benchmarking, which is outside the scope of static code review. Implementation uses O(n) algorithms over tree entries with no additional API calls. No algorithmic concern.
