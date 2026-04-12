---
lane: done
depends_on: []
review_status: approved
docs_completed: true
docs_scope: [architecture, api-reference, developer-guide, changelog, inline-code]
target_language: TypeScript
target_framework: VS Code Extension API
coverage_code: 80
coverage_branch: 90
---

# WP15 - Folder Detection, Path Utilities, and Type Extensions

| Field | Value |
|-------|-------|
| Spec | `.sdd/specs/003-folder-segregation-and-onboarding.spec.md` |
| Priority | P1 |
| Depends on | none |
| Goal | Detect first-level folders in source repos, format folder names, strip folder prefixes from paths, and unify templates/ handling |
| Status | Not Started |
| Independent Test | Create a mock GitHub tree with entries under `frontend-team/.github/agents/` and `backend-team/.claude/commands/`. Run `detectFolders()` and verify it returns `{"frontend-team", "backend-team"}`. Run `formatFolderName("frontend-team")` and verify "Frontend Team". Run `stripFolderPrefix("frontend-team/.github/agents/x.md", folders)` and verify `.github/agents/x.md`. |
| Parallelisable | Yes (with WP19, WP20) |
| Prompt | `plans/WP15-folder-detection.md` |

## Objective

This work package lays the foundation for per-folder segregation by implementing folder detection from the GitHub tree API response, folder name formatting for display, folder prefix stripping for installation paths, and removing the special-case `templates/` handling from `classifyItem()`. These are pure functions with no UI, operating on in-memory data structures. All subsequent folder-related WPs depend on the types and utilities created here.

## Spec References

- FR-001, FR-002, FR-003 (Section 4.1 - Folder Discovery)
- FR-008, FR-009 (Section 4.3 - Folder Name Formatting)
- FR-016 (Section 4.7 - Empty Folder Handling)
- FR-017, FR-018 (Section 4.8 - templates/ Prefix Unification)
- US-01 (Auto-Discover Folders in Source Repository)
- Section 7.1-7.3 (Data Model - FolderDetectionResult, FolderItem)
- Section 8.1, 8.2, 8.3 (API/Interface - IFolderDetector, IFolderDisplay, IItemClassifier)
- NFR-001, NFR-002, NFR-004 (Performance)
- NFR-014 (Observability - folder detection logging)
- Companion artifacts: data-schemas.ts, interfaces.ts, api-contracts.ts

## Tasks

### T15-01 - Add folder-related type definitions

- **Description**: Add new types to `src/models/types.ts`: `FolderDetectionResult` interface (with `folderName: string` and `entries: GitHubTreeEntry[]` fields), `FolderItem` interface as a new discriminated union member (with `kind: 'folder'`, `source: SourceConfig`, `folderName: string`, `displayName: string`, `isDefault: boolean`), and update the `CatalogItem` union type to include `FolderItem`. The type definitions must match the companion artifact `data-schemas.ts` exactly.
- **Spec refs**: FR-001, FR-004, Section 7.1-7.3
- **Parallel**: No (other tasks depend on these types)
- **Acceptance criteria**:
  - [x] `FolderDetectionResult` interface has `folderName: string` and `entries: GitHubTreeEntry[]` fields matching companion artifact `data-schemas.ts`
  - [x] `FolderItem` interface has `kind: 'folder'`, `source: SourceConfig`, `folderName: string`, `displayName: string`, `isDefault: boolean` fields
  - [x] `CatalogItem` union type includes `FolderItem` as a member: `SourceItem | CategoryItem | CatalogFileItem | FolderItem`
  - [x] TypeScript compilation succeeds with no type errors after additions
- **Test requirements**: unit
- **Depends on**: none
- **Implementation Guidance**:
  - Files to modify: `src/models/types.ts`
  - Add `FolderDetectionResult` interface after the existing `CatalogItem` union
  - Add `FolderItem` interface following the same pattern as `SourceItem`, `CategoryItem`, `CatalogFileItem`
  - Update `CatalogItem` union: `export type CatalogItem = SourceItem | CategoryItem | CatalogFileItem | FolderItem;`
  - Ensure field names and types exactly match the companion artifact `data-schemas.ts`

### T15-02 - Implement detectFolders() function

- **Description**: Implement `detectFolders(entries: GitHubTreeEntry[]): FolderDetectionResult[]` in `src/services/toolDetector.ts`. The function SHALL scan the flat array of tree entries and identify first-level directories that contain `.github/` or `.claude/` subdirectories. Detection is case-sensitive for directory names but case-insensitive for `.github` and `.claude` markers. Only single-level depth (first path segment) qualifies (FR-002). The function SHALL NOT issue additional API calls (FR-003). Empty entries array returns empty results.
- **Spec refs**: FR-001, FR-002, FR-003, Section 8.1
- **Parallel**: No (depends on T15-01 types)
- **Acceptance criteria**:
  - [x] FR-001: A first-level directory SHALL be detected as a folder when at least one entry has path `<directory>/.github/<subpath>` or `<directory>/.claude/<subpath>`
  - [x] FR-002: Only single-level depth is detected; nested dirs within a folder SHALL NOT create additional folders
  - [x] FR-003: Detection uses only the in-memory `GitHubTreeEntry[]` array with no additional API calls
  - [x] Detection is case-sensitive for directory names but case-insensitive for `.github` and `.claude` markers
  - [x] Empty `entries` array returns empty `FolderDetectionResult[]`
  - [x] Entries with no qualifying structural markers return empty results
  - [x] Given entries `["a/b/.github/agents/x.md"]`, only `a` qualifies as a folder (first segment)
- **Test requirements**: unit
- **Depends on**: T15-01
- **Implementation Guidance**:
  - File to modify: `src/services/toolDetector.ts`
  - Add `detectFolders()` as a named export alongside existing `classifyItem()` and `detectWorkspaceTools()`
  - Algorithm: single pass over entries, for each entry split path by `/`, check if `segments[1]` (case-insensitive) is `.github` or `.claude`, collect `segments[0]` into a Set
  - Build `FolderDetectionResult[]` by iterating the Set and filtering entries per folder
  - Performance: O(n) over entries, well within NFR-002 50ms budget

### T15-03 - Implement groupByFolder() function

- **Description**: Implement `groupByFolder(entries: GitHubTreeEntry[], folders: Set<string>): Map<string, GitHubTreeEntry[]>` in `src/services/toolDetector.ts`. The function SHALL partition tree entries into groups keyed by folder name. Entries whose first path segment matches a folder name are grouped under that folder. Root-level entries (those not belonging to any folder) are grouped under the key `""` (empty string). The function operates as a pure function over the entry array.
- **Spec refs**: FR-001, FR-004, FR-006, Section 8.1
- **Parallel**: Yes (after T15-01)
- **Acceptance criteria**:
  - [x] FR-001, FR-004: Entries whose first path segment matches a folder name are grouped under that folder key
  - [x] FR-006: Root-level entries (first segment is `.github` or `.claude`) are grouped under the empty string key `""`
  - [x] Entries not matching any folder and not root-level are excluded from all groups
  - [x] The function is a pure function with no side effects
- **Test requirements**: unit
- **Depends on**: T15-01
- **Implementation Guidance**:
  - File to modify: `src/services/toolDetector.ts`
  - Add `groupByFolder()` as a named export
  - Algorithm: iterate entries, for each entry check if first segment is in `folders` Set -> add to that folder's group; else if first segment is `.github`/`.claude` -> add to `""` group
  - Return `Map<string, GitHubTreeEntry[]>` where keys are folder names or `""` for root

### T15-04 - Implement formatFolderName() function

- **Description**: Implement `formatFolderName(rawName: string): string` in `src/utils/pathUtils.ts`. The function SHALL: (1) replace all dash and underscore characters with spaces, (2) convert to title case (first character of each word uppercased, remaining lowercased), (3) trim whitespace. If the result is empty after transformation, return the raw name unchanged. The "Default" virtual folder label SHALL NOT undergo this transformation (handled by the caller, not this function).
- **Spec refs**: FR-008, FR-009, Section 8.2
- **Parallel**: Yes (after T15-01)
- **Acceptance criteria**:
  - [x] FR-008: Dashes and underscores are replaced with spaces: `"frontend-team"` -> `"Frontend Team"`
  - [x] FR-008: Result is title case: `"ALLCAPS"` -> `"Allcaps"`, `"singleword"` -> `"Singleword"`
  - [x] FR-008: Mixed separators work: `"my-cool_project"` -> `"My Cool Project"`
  - [x] FR-008: If result is empty after transformation (e.g., `"---"`), return raw name unchanged
  - [x] FR-009: The "Default" label is NOT processed by this function (handled by caller)
  - [x] NFR-004: Completes in under 1ms per name (simple string transformation)
- **Test requirements**: unit
- **Depends on**: none
- **Implementation Guidance**:
  - File to modify: `src/utils/pathUtils.ts`
  - Add `formatFolderName()` as a named export
  - Implementation per spec computed value: `raw.replace(/[-_]/g, ' ').replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).trim()` with empty-string fallback to raw
  - No I/O, pure string transformation

### T15-05 - Implement stripFolderPrefix() function

- **Description**: Implement `stripFolderPrefix(itemPath: string, folders: Set<string>): string` in `src/utils/pathUtils.ts`. The function SHALL check if the first path segment of `itemPath` is a key in `folders`. If so, remove the first segment and the following `/` separator, returning the remainder. If the first segment is not in `folders`, return the original path unchanged. This function is used by the installer and tree provider to compute workspace-relative paths.
- **Spec refs**: FR-010, FR-011, FR-018, Section 8.3.2
- **Parallel**: Yes (after T15-01)
- **Acceptance criteria**:
  - [x] FR-010: Given `stripFolderPrefix("frontend-team/.github/agents/x.md", {"frontend-team"})`, returns `".github/agents/x.md"`
  - [x] FR-011: Given `stripFolderPrefix(".github/agents/x.md", {"frontend-team"})`, returns `".github/agents/x.md"` unchanged (root-level path)
  - [x] FR-018: Given `stripFolderPrefix("templates/.github/agents/x.md", {"templates"})`, returns `".github/agents/x.md"` (handles templates like any folder)
  - [x] Edge: Given `stripFolderPrefix("a/b/c", new Set())`, returns `"a/b/c"` unchanged
- **Test requirements**: unit
- **Depends on**: none
- **Implementation Guidance**:
  - File to modify: `src/utils/pathUtils.ts`
  - Add `stripFolderPrefix()` as a named export
  - Algorithm: `const slash = itemPath.indexOf('/'); if (slash > 0 && folders.has(itemPath.substring(0, slash))) return itemPath.substring(slash + 1); return itemPath;`
  - Pure function, no I/O

### T15-06 - Remove templates/ prefix stripping from classifyItem()

- **Description**: Remove the special-case `templates/` prefix stripping logic from the `classifyItem()` function in `src/services/toolDetector.ts`. Currently, `classifyItem()` contains a guard clause that shifts the first segment when it equals `templates`. This logic SHALL be removed because all folder prefix handling is now performed by `stripFolderPrefix()` and the folder discovery system. After this change, `classifyItem("templates/.github/agents/x.agent.md")` SHALL return `{ tool: 'unknown', category: 'unknown' }` because `templates` is not a recognized tool directory. The caller is responsible for stripping the folder prefix before calling `classifyItem()`.
- **Spec refs**: FR-017, FR-018, Section 4.8
- **Parallel**: No (must coordinate with T15-07)
- **Acceptance criteria**:
  - [x] FR-018: The `segments.shift()` guard clause for `templates/` at lines ~43-46 of `classifyItem()` is removed
  - [x] FR-017: `templates/` is now treated as a standard folder by the folder detection system, not special-cased in classification
  - [x] After removal, `classifyItem("templates/.github/agents/x.agent.md")` returns `{ tool: 'unknown', category: 'unknown' }`
  - [x] After removal, `classifyItem(".github/agents/x.agent.md")` still returns the correct classification (existing behavior preserved for non-prefixed paths)
- **Test requirements**: unit
- **Depends on**: T15-05
- **Implementation Guidance**:
  - File to modify: `src/services/toolDetector.ts`
  - Locate the `if (segments[0] === 'templates') { segments.shift(); }` block around lines 43-46
  - Delete the entire if block (2-3 lines)
  - No replacement logic needed -- `stripFolderPrefix()` handles all folder prefix removal at the call site

### T15-07 - Update existing classifyItem() tests for templates/ change

- **Description**: Update the existing test suite in `test/suite/toolDetector.test.ts` to reflect the removal of `templates/` prefix stripping from `classifyItem()`. The "templates prefix" describe block currently asserts that `classifyItem("templates/.github/agents/code-reviewer.agent.md")` returns `copilot/agents`. After the change, these tests SHALL assert `{ tool: 'unknown', category: 'unknown' }` instead, because the caller is now responsible for stripping the folder prefix before classification. Add new tests that verify the caller pattern: `classifyItem(stripFolderPrefix(path, folders))` produces the correct result.
- **Spec refs**: FR-017, FR-018, C-07
- **Parallel**: No (depends on T15-06)
- **Acceptance criteria**:
  - [x] Existing "templates prefix" tests in `test/suite/toolDetector.test.ts` are updated to expect `{ tool: 'unknown', category: 'unknown' }` for `templates/`-prefixed paths
  - [x] New tests added for the caller pattern: `classifyItem(stripFolderPrefix(path, folders))` produces correct results
  - [x] All existing non-templates tests continue to pass without modification
  - [x] No regressions in the existing test suite
- **Test requirements**: unit
- **Depends on**: T15-06
- **Implementation Guidance**:
  - File to modify: `test/suite/toolDetector.test.ts`
  - Locate the 'templates prefix' describe block (around lines 115-145)
  - Change expected values from `copilot/agents` etc. to `{ tool: 'unknown', category: 'unknown' }`
  - Add a new describe block 'folder prefix stripping + classification' that imports `stripFolderPrefix` and tests the composition

### T15-08 - Unit tests for folder detection, grouping, formatting, and stripping

- **Description**: Write comprehensive unit tests for `detectFolders()`, `groupByFolder()`, `formatFolderName()`, and `stripFolderPrefix()`. Tests SHALL cover: (1) standard detection with multiple folders, (2) nested path exclusion (FR-002), (3) case-insensitive `.github`/`.claude` markers, (4) empty entries, (5) entries with no qualifying folders, (6) formatting edge cases (dashes, underscores, all-caps, separator-only names), (7) strip with matching folder, (8) strip with non-matching first segment, (9) strip with root-level paths (no folder prefix).
- **Spec refs**: FR-001-003, FR-008-009, FR-016-018, US-01
- **Parallel**: No (depends on T15-02 through T15-05)
- **Acceptance criteria**:
  - [x] Tests cover all BDD scenarios from spec Section 11: Scenario US-01.1 (single folder detected), US-01.2 (no folders yields flat list)
  - [x] >= 80% code coverage for `detectFolders()`, `groupByFolder()`, `formatFolderName()`, `stripFolderPrefix()`
  - [x] Edge cases covered: empty entries, no qualifying folders, case sensitivity, single entry, many folders (10+)
  - [x] Test file: `test/suite/folderDetection.test.ts` (new file)
  - [x] All tests pass with `npm test`
- **Test requirements**: unit
- **Depends on**: T15-02, T15-03, T15-04, T15-05
- **Implementation Guidance**:
  - New file: `test/suite/folderDetection.test.ts`
  - Import functions from `src/services/toolDetector.ts` and `src/utils/pathUtils.ts`
  - Use the fixture pattern from existing test files (e.g., `toolDetector.test.ts`)
  - Test data: use realistic GitHub tree entry shapes matching `GitHubTreeEntry` interface
  - Group tests by function in nested `describe()` blocks

## Implementation Notes

- All functions in this WP are pure functions with no I/O -- they operate on in-memory arrays and strings
- `detectFolders()` and `groupByFolder()` go in `src/services/toolDetector.ts` alongside existing `classifyItem()` and `detectWorkspaceTools()`
- `formatFolderName()` and `stripFolderPrefix()` go in `src/utils/pathUtils.ts` alongside existing `validatePath()`
- The `FolderItem` type goes in `src/models/types.ts` alongside existing `CatalogItem` union members
- Removing the `templates/` guard from `classifyItem()` is a breaking behavior change for callers that pass `templates/`-prefixed paths; all callers must be updated in WP16

## Research Context

- The `classifyItem()` function currently strips `templates/` prefix at lines 43-46 in `src/services/toolDetector.ts` via `segments.shift()` when `segments[0].toLowerCase() === 'templates'`
- Existing tests in `test/suite/toolDetector.test.ts` have a "templates prefix" describe block (around line 194) with 5 test cases that assert templates-prefixed paths classify correctly - these must be updated
- `pathUtils.ts` currently exports only `validatePath()` -- the new functions extend it
- The `CatalogItem` type in `types.ts` is a union of `SourceItem | CategoryItem | CatalogFileItem` -- `FolderItem` is a new member

## Risks & Mitigations

- **Risk**: Removing `templates/` stripping from `classifyItem()` breaks callers that rely on it. **Mitigation**: T15-07 updates tests; WP16 updates all callers in `catalogTree.ts` to strip folder prefixes before classification.
- **Risk**: Detection misidentifies directories as folders (false positives from directories like `docs/.github/`). **Mitigation**: FR-016 hides folders with zero classifiable items, and structural detection requires `.github/` or `.claude/` subdirectories.

## Review

- [x] FB-01 [FAIL] [spec-adherence] `detectFolders()` marker detection is too permissive -- checks all segments from index 1 onward instead of only `segments[1]`. FR-001 requires pattern `<directory>/.github/<subpath>` where `.github`/`.claude` is directly under the first-level dir. Fix: replace loop at toolDetector.ts:178-184 with single `segments[1]` check. Also fix test "should not create additional folder for nested directory" in folderDetection.test.ts to expect `result.length === 0` for `a/b/.github/agents/x.md`.
- [x] FB-02 [WARN] [code-quality] Unsafe `as unknown as SourceItem` cast at catalogTree.ts:292-293 in the `'folder'` case. Replace with `new vscode.TreeItem(item.displayName, vscode.TreeItemCollapsibleState.Collapsed)` or equivalent safe placeholder.

## Activity Log

- 2025-07-20T00:00:00Z - planner - lane=planned - Work package created
- 2025-07-20T12:00:00Z - coder - lane=doing - Starting implementation
- 2026-04-12T00:00:00Z - code-env-setup - Environment: TypeScript 5.9.3, VS Code Extension API. Deps: node_modules present (npm). Baseline: 431 tests passed, 0 failed. Coverage: c8 configured (80% code / 90% branch).
- 2025-07-20T14:00:00Z - coder - lane=for_review - All tasks complete, 488 tests passing, coverage met
- 2026-04-12T12:00:00Z - reviewer - lane=to_do - Changes Required: FB-01 (FAIL spec-adherence), FB-02 (WARN code-quality)
- 2026-04-12T13:00:00Z - coder - lane=doing - Rework mode: addressing 2 FB items
- 2026-04-12T13:05:00Z - coder - lane=for_review - FB-01 and FB-02 fixed, 488 tests passing
- 2026-04-12T14:00:00Z - reviewer - lane=done - Approved: FB-01 and FB-02 fixes verified, 488 tests passing, no new issues
- 2026-04-12T15:00:00Z - docs-agent - docs-complete - Documentation generated for WP15
