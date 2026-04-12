# Changelog

All notable changes to this project are documented in this file. Entries are ordered newest first.

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
