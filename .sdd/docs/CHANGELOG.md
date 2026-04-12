# Changelog

All notable changes to this project are documented in this file. Entries are ordered newest first.

---

## [WP20] - Onboarding Walkthrough and Enterprise Configuration (2026-04-12)

### Added

- Get Started walkthrough that auto-opens on first extension install, guiding new users through two steps: configuring an index URL source and browsing the catalog (FR-028, FR-029, FR-030, FR-031)
- Walkthrough step completion events: Step 1 completes when the `indexUrl` setting is changed, Step 2 completes when the catalog view is opened (FR-030)
- Walkthrough media markdown files: `resources/walkthrough/configure-source.md` and `resources/walkthrough/browse-catalog.md` with clear, concise guidance for first-time users (FR-031)
- "Get Started" command (`awesome-coding-assistants.openWalkthrough`) for re-accessing the walkthrough from the Command Palette at any time (FR-032, FR-033)
- Error handling for the openWalkthrough command: catches failures, logs at error level with `WALKTHROUGH_NOT_FOUND` code, and shows an informational message to the user (FR-032)
- `WALKTHROUGH_NOT_FOUND` error code in `errors.ts` for structured walkthrough error logging
- Enterprise pre-configuration support: machine-level `indexUrl` settings (configured via Intune, GPO, or image provisioning) are respected by standard VS Code settings resolution -- no custom code required (FR-034, FR-035)
- 11 unit tests in `walkthrough.test.ts` covering command registration, correct walkthrough ID, error handling, and enterprise configuration code paths (T20-07)

---

## [WP19] - Index URL Migration and Multi-Index Merge (2026-04-12)

### Added

- Multiple index URL support: the `indexUrl` setting now accepts an array of strings, enabling users and enterprises to combine sources from multiple catalogs (FR-021, FR-024)
- `normalizeIndexUrls()` function in `sourceRegistry.ts` for backward-compatible runtime coercion of the `indexUrl` setting: single strings are coerced to `[string]`, undefined falls back to defaults, invalid types log a warning and use defaults (FR-022, FR-023)
- `loadMultipleIndexes()` function in `sourceRegistry.ts` for parallel multi-URL fetch using `Promise.allSettled()` with union merge and dedup by `sourceKey()` (`url@branch`, first-seen-wins) (FR-024, FR-025, FR-026)
- `MergedSourceList` and `IndexFetchResult` types in `types.ts` for representing multi-index fetch results (Section 7.9)
- `IndexErrorCodes` in `errors.ts`: `INDEX_FETCH_FAILED`, `INDEX_SCHEMA_INVALID`, `INVALID_INDEX_URL_TYPE` for structured logging
- HTTPS-only validation for index URLs: non-HTTPS URLs are rejected with a logged warning (NFR-006)
- Partial failure handling: if one index URL fails, remaining URLs continue and their sources are still merged (FR-024)
- Total failure handling: if all index URLs fail, falls back to user-configured sources and default source (FR-024)
- Per-URL fetch result logging at info/warn level (NFR-015)
- 31 unit tests in `multiIndex.test.ts` covering normalizeIndexUrls coercion, multi-index fetch, dedup, partial/total failure, HTTPS rejection, schema validation, cache invalidation, and backward compatibility (T19-08)

### Changed

- `indexUrl` setting schema in `package.json` changed from `"type": "string"` to `"type": "array"` with `"items": { "type": "string" }` (FR-021)
- Default `indexUrl` value changed from a single string to a single-element array (FR-021)
- `loadMasterIndex()` reads raw `indexUrl` setting without type parameter, coerces via `normalizeIndexUrls()`, and dispatches to single-fetch or `loadMultipleIndexes()` based on URL count (FR-024, FR-027)
- Settings UI renders `indexUrl` as an editable list of strings

---

## [WP18] - Search Across Folders (2026-04-12)

### Added

- Folder-level search filtering: when a search query is active, folder nodes with zero matching items are hidden from the tree (FR-019, FR-020)
- `hasFolderSearchMatch()` helper in `CatalogTreeProvider` to check whether any items within a folder match the current search query
- Category-level search within folders: categories inside a folder that have zero matching items are hidden during search, with `filteredCount` reflecting matches scoped to the folder (FR-019, FR-020)
- Folder-aware `hasAnySearchMatch()`: updated to iterate entries within each folder, stripping folder prefixes before classification and search matching (FR-019)
- Search hierarchy preservation: search results maintain the Source > Folder > Category > Item tree path (FR-020)
- "Default" folder is hidden during search if none of its items match the query (FR-020)
- `SearchEmptyItem` returned when all folders across all sources have zero search matches
- 13 unit tests in `search.test.ts` covering folder search scenarios: multi-folder matches, zero-match folder hiding, Default folder hiding, search clearing, empty state, category filtering, and `filteredCount` accuracy (US-08)

### Changed

- `getSourceChildren()` now filters folder nodes through `hasFolderSearchMatch()` when a search query is active
- `hasAnySearchMatch()` now accounts for folder-prefixed entries by stripping prefixes before calling `classifyItem()` and `matchesSearch()`

---

## [WP17] - Folder-Aware Installation and Conflict Resolution (2026-04-12)

### Added

- Folder-aware installation: items from source subfolders have their folder prefix stripped before writing to the workspace, so `frontend-team/.github/agents/helper.agent.md` installs to `.github/agents/helper.agent.md` (FR-010)
- Cross-folder conflict detection: when items from different folders resolve to the same workspace path, a QuickPick dialog lets the user choose which version to install (FR-014, FR-015)
- `ConflictResolver` service (`conflictResolver.ts`) with `detectCrossFolderConflict()` for conflict scanning and `resolveFolderConflict()` for user-facing resolution via QuickPick
- `CrossFolderConflict` and `ConflictCandidate` types in `types.ts` for modeling detected conflicts
- Manifest entries for folder items preserve the full source path in `itemPath` (for fetching updates) and the stripped workspace path in `targetPaths` (for locating installed files) (FR-012)
- Folder-aware update flow: updates fetch content using the full `itemPath` from the manifest and write to the workspace using `targetPaths` (FR-013)
- Folder-aware uninstall flow: uninstall uses `targetPaths` to locate and delete workspace files (FR-013)
- Conflict detection performance: O(n) scan completing in under 10ms at p95 for manifests with 100 entries (NFR-005)
- Conflict prompt logging at info level for both selection and cancellation outcomes (NFR-016)

### Changed

- Install command handler now calls `stripFolderPrefix()` before writing files for folder-enabled sources, and invokes conflict detection before proceeding with installation
- `LifecycleManager.applyUpdate()` uses full `itemPath` for content fetching and `targetPaths` for workspace writes
- `LifecycleManager.uninstallItem()` uses `targetPaths` for file deletion

---

## [WP16] - Catalog Tree Folder Display (2026-04-12)

### Added

- Folder nodes in the catalog tree: when a source repository contains subfolders with `.github/` or `.claude/` directories, expanding a source now shows folder nodes before category nodes (Source > Folder > Category > Items hierarchy) (FR-004)
- `getFolderNodes()` method in `CatalogTreeProvider` that detects folders, filters empty ones (FR-016), formats display names (FR-008), sorts alphabetically, and prepends a "Default" folder when root-level items coexist with real folders (FR-006)
- `getSourceChildren()` method extracted for source node expansion with folder-or-category dispatch
- `getFolderChildren()` method for expanding folder nodes into scoped category nodes
- `createFolderTreeItem()` for rendering folder tree items with `ThemeIcon('folder')`, formatted labels, and accessibility information (NFR-010, NFR-011)
- `catalogItem.folder` context value for folder nodes
- Error resilience: `detectFolders()` failures fall back to flat hierarchy (FR-005); folder children rendering failures show an error node under the folder (T16-06)

### Changed

- `getChildren()` now delegates to `getSourceChildren()` for source nodes and `getFolderChildren()` for folder nodes
- `getCategoryNodes()` accepts optional `folderEntries` and `folderName` parameters to support folder-scoped category rendering
- `getFileNodes()` uses folder-prefix-stripped paths for classification while retaining full source paths for install and manifest operations (FR-012)
- When no folders are detected in a source, the tree renders identically to pre-folder behavior (FR-005, FR-007)

---

## [WP15] - Folder Detection, Path Utilities, and Type Extensions (2026-04-12)

### Added

- Folder detection for source repositories: first-level directories containing `.github/` or `.claude/` subdirectories are auto-discovered as folders, enabling per-folder grouping in the catalog tree (FR-001, FR-002, FR-003)
- `detectFolders()` function in `toolDetector.ts` to scan GitHub tree entries and identify qualifying folders using a single pass over the entry array with no additional API calls
- `groupByFolder()` function to partition tree entries by detected folder, with root-level entries grouped under an empty-string key for the virtual "Default" folder
- `formatFolderName()` function in `pathUtils.ts` to convert raw directory names to display-friendly title case (e.g., `"frontend-team"` -> `"Frontend Team"`)
- `stripFolderPrefix()` function in `pathUtils.ts` to remove folder prefixes from item paths before classification and installation
- `FolderItem` type added to the `CatalogItem` union for representing folder nodes in the catalog tree
- `FolderDetectionResult` interface for returning folder detection results with associated tree entries

### Changed

- Removed special-case `templates/` prefix stripping from `classifyItem()` -- all folder prefix handling is now performed by `stripFolderPrefix()` at the call site
- Updated `CatalogItem` union type: `SourceItem | CategoryItem | CatalogFileItem | FolderItem`

### Breaking Changes

- `classifyItem()` no longer strips the `templates/` prefix internally. Callers passing `templates/`-prefixed paths must now call `stripFolderPrefix()` before `classifyItem()` to get correct classification results. Without stripping, `classifyItem("templates/.github/agents/x.md")` returns `{ tool: 'unknown', category: 'unknown' }`.
