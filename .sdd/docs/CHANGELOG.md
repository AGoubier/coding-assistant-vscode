# Changelog

All notable changes to this project are documented in this file. Entries are ordered newest first.

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
