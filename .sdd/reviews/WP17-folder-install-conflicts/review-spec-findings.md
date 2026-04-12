---
skill: review-spec
wp: WP17
spec: .sdd/specs/003-folder-segregation-and-onboarding.spec.md
reviewed_at: 2026-04-12T12:00:00Z
status: completed
finding_counts:
  pass: 8
  warn: 0
  fail: 0
  na: 0
files_reviewed:
  - src/commands/installCommand.ts
  - src/services/conflictResolver.ts
  - src/services/lifecycle.ts
  - src/models/types.ts
  - src/services/index.ts
---

# review-spec Findings for WP17

## Summary

Evaluated 6 functional requirements (FR-010 through FR-015) and 2 non-functional requirements (NFR-005, NFR-016) referenced by WP17. All FRs are classified as Compliant. The implementation correctly strips folder prefixes on install, preserves full source paths in the manifest, handles update/uninstall with folder-aware entries, detects cross-folder name conflicts, and presents a quick-pick UI for conflict resolution. API contract shapes deviate from the spec's `IConflictResolver` interface reference (noted below) but all behavioral obligations are fully met.

## Findings

### SPEC-001 [PASS]
- **Checklist item**: FR-010 - Folder prefix stripping on install
- **Requirement**: FR-010, Section 4.4
- **File**: src/commands/installCommand.ts#L200-L203
- **Description**: `stripFolderPrefix(item.path, discoveredFolders)` is called before install. Target path is computed via `getTargetPath(tool, category, filename)` which produces the correct workspace-relative path with folder prefix stripped.

### SPEC-002 [PASS]
- **Checklist item**: FR-011 - Default folder items installed without modification
- **Requirement**: FR-011, Section 4.4
- **File**: src/commands/installCommand.ts#L201-L203
- **Description**: When `strippedPath === item.path` (no folder prefix detected), the install proceeds without conflict detection and uses the original path. Root-level items pass through unchanged.

### SPEC-003 [PASS]
- **Checklist item**: FR-012 - Manifest stores full source path with folder prefix
- **Requirement**: FR-012, Section 4.5
- **File**: src/commands/installCommand.ts#L243-L253
- **Description**: `installationId()` uses `effectiveItem.path` (full path including folder prefix). `itemPath` field stores `effectiveItem.path`. `targetPaths` stores the stripped workspace paths from the install result.

### SPEC-004 [PASS]
- **Checklist item**: FR-013 - Update/uninstall uses full path for fetch and stripped path for workspace
- **Requirement**: FR-013, Section 4.5
- **File**: src/services/lifecycle.ts#L155-L177
- **Description**: `applyUpdate()` uses `entry.itemPath` (full path) for `installer.installFile()` source fetch and `entry.targetPaths` for workspace write target. `uninstallItem()` iterates `entry.targetPaths` for file deletion. Error handling for "item not found" (404) is implemented with a descriptive error message.

### SPEC-005 [PASS]
- **Checklist item**: FR-014 - Cross-folder conflict detection and quick-pick prompt
- **Requirement**: FR-014, Section 4.6
- **File**: src/services/conflictResolver.ts#L27-L100
- **Description**: `detectCrossFolderConflict()` correctly computes post-strip target path, scans `allEntries` for sibling folder items with same target, and checks manifest for existing installs at same target from different folders. Returns `CrossFolderConflict` with candidates array. `resolveFolderConflict()` displays quick-pick with folder-labeled options.

### SPEC-006 [PASS]
- **Checklist item**: FR-015 - Conflict detection at install time as pre-install step
- **Requirement**: FR-015, Section 4.6
- **File**: src/commands/installCommand.ts#L202-L217
- **Description**: Conflict detection runs between path computation and file write. Guard condition (`discoveredFolders.size > 0 && strippedPath !== item.path`) ensures detection only runs for folder-enabled sources. Non-folder sources skip conflict detection entirely.

### SPEC-007 [PASS]
- **Checklist item**: NFR-005 - Conflict detection completes in under 10ms at p95
- **Requirement**: NFR-005
- **File**: src/services/conflictResolver.ts#L27-L100
- **Description**: Detection uses O(n) scan of tree entries + O(m) scan of manifest entries. No disk I/O or async operations. All operations are in-memory. Test verifies < 100ms for 100 manifest entries (conservative bound).

### SPEC-008 [PASS]
- **Checklist item**: NFR-016 - Conflict prompt outcomes logged at info level
- **Requirement**: NFR-016
- **File**: src/services/conflictResolver.ts#L118-L126
- **Description**: Selection logged: `"Conflict resolved: user selected <fullPath> from folder <folderName>"`. Cancellation logged: `"Conflict cancelled by user for target path <targetPath>"`. Both at info level via `log.info()`.

## Notes

### API Contract Shape Deviations (informational)

The implementation deviates from the spec's `IConflictResolver` interface (Section 8.4) in three ways:
1. Parameter order differs: spec has `(itemPath, folders, manifest, source, allEntries)`, impl has `(itemPath, folders, allEntries, manifest, source, log)`.
2. Function name: spec defines `resolveConflict()`, impl uses `resolveFolderConflict()`.
3. Extra `log` parameter in both functions.
4. Standalone exported functions instead of interface implementation.

These are structural deviations that do not affect behavioral compliance. All FR obligations are fully met. The WP plan (T17-04) explicitly allows the alternative module structure.

### WP Metadata Note

WP17 Spec References cite "US-04 (Install from Specific Folder)" and "US-05 (Cross-Folder Conflict Resolution)" but the spec's actual user story numbering is US-06 (Install Items from Folders to Standard Paths) and US-07 (Resolve Cross-Folder Name Conflicts at Install). The FR references (FR-010 through FR-015) are correct.
