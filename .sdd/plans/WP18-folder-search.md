---
lane: for_review
depends_on: [WP16]
docs_scope: [api-reference, changelog, inline-code]
target_language: TypeScript
target_framework: VS Code Extension API
coverage_code: 80
coverage_branch: 90
---

# WP18 - Search Across Folders

| Field | Value |
|-------|-------|
| Spec | `.sdd/specs/003-folder-segregation-and-onboarding.spec.md` |
| Priority | P1 |
| Depends on | WP16 |
| Goal | Extend search to span all folders while preserving folder hierarchy in results |
| Status | Not Started |
| Independent Test | Configure a source with two folders each containing agents. Set a search query matching one agent from each folder. Verify both matched items appear under their respective folder nodes, and the non-matching folder is hidden if it has zero matches. Clear search and verify full tree is restored. |
| Parallelisable | Yes (with WP17) |
| Prompt | `plans/WP18-folder-search.md` |

## Objective

This work package extends the existing search functionality to work correctly with the folder tree hierarchy. When a search query is active, matching items from all folders are displayed under their respective folder nodes, while folders with zero matches are hidden. The existing `matchesSearch()` function is reused; the change is in how folder and category nodes are filtered during active search.

## Spec References

- FR-019, FR-020 (Section 4.9 - Search Across Folders)
- US-08 (Search Results Across Folders)
- Section 8.6 (API/Interface - Search)
- NFR-002 (Performance)

## Tasks

### T18-01 - Modify folder-level getChildren() for search filtering

- **Description**: When a search query is active and `getChildren()` is called for a `SourceItem` with discovered folders, the method SHALL: (1) compute folder nodes normally via `getFolderNodes()`, (2) for each folder node, check if any items within that folder match the search query by iterating the folder's entries and applying `matchesSearch()` to each classified item, (3) exclude folder nodes that have zero matching items. If all folder nodes are excluded across all sources, return the `SearchEmptyItem`. The "Default" folder follows the same filtering rules.
- **Spec refs**: FR-019, FR-020
- **Parallel**: No
- **Acceptance criteria**:
  - [x] FR-019: Search matches items from ALL folders and the Default folder
  - [x] FR-020: Folder nodes with zero matching items are hidden during active search
  - [x] FR-020: "Default" folder is hidden if none of its items match the query
  - [x] If ALL folders across ALL sources have zero matches, `SearchEmptyItem` is returned
  - [x] Clearing the search query restores the full folder hierarchy
- **Test requirements**: unit
- **Depends on**: WP16 T16-03 (folder hierarchy in getChildren)
- **Implementation Guidance**:
  - File to modify: `src/providers/catalogTree.ts`, `getChildren()` method
  - In the source-with-folders branch, after computing folder nodes, add a filter step:
    `folderNodes.filter(fn => hasMatchingItemsInFolder(fn, query))`
  - The `hasMatchingItemsInFolder()` helper iterates the folder's entries, strips prefixes, classifies, and checks `matchesSearch()`
  - If filtered list is empty and no other source has matches, return `[SearchEmptyItem]`

### T18-02 - Category-level search within folder context

- **Description**: When a search query is active and `getChildren()` is called for a `FolderItem`, the method SHALL filter category nodes to only show categories that contain at least one matching item. Modify the folder-scoped `getCategoryNodes()` call to apply the existing search-based category filtering logic (already implemented for flat sources in `getCategoryNodes()`) to the folder-scoped entry set. Include the `filteredCount` on category nodes.
- **Spec refs**: FR-019, FR-020
- **Parallel**: Yes (after T18-01)
- **Acceptance criteria**:
  - [x] FR-019: Categories within a folder that have zero matching items are hidden during search
  - [x] FR-020: `filteredCount` on visible category nodes reflects the count of matching items within that folder's scope
  - [x] The existing search filtering logic for flat sources is not broken
- **Test requirements**: unit
- **Depends on**: T18-01
- **Implementation Guidance**:
  - File to modify: `src/providers/catalogTree.ts`
  - In the `FolderItem` branch of `getChildren()`, pass the search query to `getCategoryNodes()` (it already handles search-aware filtering)
  - The existing category filtering logic removes categories with zero matches -- this works unchanged within folder scope
  - Verify `filteredCount` calculation uses the folder-scoped entry count

### T18-03 - Update hasAnySearchMatch() for folder-aware sources

- **Description**: Modify the `hasAnySearchMatch()` method in `CatalogTreeProvider` to account for folder-scoped entries. Currently it iterates all entries directly. For folder-enabled sources, it SHALL iterate entries within each folder (using `groupByFolder()`), strip folder prefixes before classification, and check `matchesSearch()`. This ensures the global "no results" empty state works correctly when folders are present.
- **Spec refs**: FR-019
- **Parallel**: Yes (after T18-01)
- **Acceptance criteria**:
  - [x] `hasAnySearchMatch()` returns true when a match exists in any folder of any source
  - [x] `hasAnySearchMatch()` correctly strips folder prefixes before calling `classifyItem()` and `matchesSearch()`
  - [x] `hasAnySearchMatch()` returns false when no items match across all folders and sources
- **Test requirements**: unit
- **Depends on**: T18-01
- **Implementation Guidance**:
  - File to modify: `src/providers/catalogTree.ts`, `hasAnySearchMatch()` method
  - Add folder-awareness: for each source, call `detectFolders()` and `groupByFolder()`, iterate entries per folder, strip prefixes before `classifyItem()`, then check `matchesSearch()`
  - Alternatively, iterate all entries, strip folder prefix if applicable, classify, and check -- same result, simpler code

### T18-04 - Search preserves folder context in results

- **Description**: Verify that search results for items within folders show the folder node as a parent in the tree hierarchy. This is a natural consequence of T18-01 and T18-02: matching items appear under Folder > Category > Item. No additional implementation is needed beyond the folder/category filtering. Validate via manual testing and unit tests that the tree path Source > Folder > Category > Item is maintained during search.
- **Spec refs**: FR-020
- **Parallel**: Yes (after T18-02)
- **Acceptance criteria**:
  - [x] FR-020: Tree path during search is Source > Folder > Category > Item (hierarchy preserved)
  - [x] Items displayed under a folder node during search have correct names and paths
  - [x] No duplicate items appear across folders during search
- **Test requirements**: unit
- **Depends on**: T18-02
- **Implementation Guidance**:
  - This is primarily a verification task -- the hierarchy preservation is a natural consequence of T18-01 and T18-02
  - Write targeted tests that assert the parent chain of matched items during search
  - Verify by expanding a folder node during search that only matching categories/items appear

### T18-05 - Unit tests for folder search

- **Description**: Write unit tests for search across folders: (1) search matches items from multiple folders, (2) folders with zero matches are hidden during search, (3) "Default" folder is hidden when its items do not match, (4) clearing search restores full folder hierarchy, (5) empty search result state when no items match across any folder in any source, (6) search within a folder shows only matching categories, (7) `hasAnySearchMatch()` returns true when a match exists in any folder, (8) `filteredCount` on category nodes within folders is correct during search.
- **Spec refs**: FR-019, FR-020, US-08
- **Parallel**: No (depends on T18-01 through T18-04)
- **Acceptance criteria**:
  - [x] Tests cover BDD scenarios from spec Section 11: US-08.1 (search results span folders)
  - [x] >= 80% code coverage for search-related folder code paths
  - [x] Edge cases: search with only one folder matching, search with zero matches, search with all folders matching
  - [x] Clearing search restores full tree
  - [x] All tests pass with `npm test`
- **Test requirements**: unit
- **Depends on**: T18-01, T18-02, T18-03, T18-04
- **Implementation Guidance**:
  - Extend `test/suite/catalogTree.test.ts` or `test/suite/search.test.ts` with a new `describe('folder search')` block
  - Use mock source data with multiple folders and items with varying names/descriptions for search matching
  - Mock `detectFolders()` and `groupByFolder()` returns for deterministic testing
  - Verify search state management: set query -> check filtered tree -> clear query -> check restored tree

## Implementation Notes

- The existing search infrastructure (`matchesSearch()`, `setSearchQuery()`, `getSearchQuery()`) is reused without modification. The changes are in how `getChildren()` filters folder and category nodes when search is active.
- The `hasAnySearchMatch()` method needs updating because it currently iterates the flat tree entries. With folders, it must account for folder-prefix stripping before classification and search matching.
- Performance: search filtering adds a small overhead to folder-enabled sources (one pass over entries per folder to check for matches). This is within the 50ms budget from NFR-002.

## Research Context

- The existing search implementation in `catalogTree.ts` uses `matchesSearch(item, query)` which checks name, path, tool, category, and description fields against AND-joined query words.
- `getCategoryNodes()` already has search-aware filtering that skips categories with zero matching items and adds `filteredCount`. This logic applies within the folder context.
- `hasAnySearchMatch()` iterates sources and their entries to detect if any match exists globally. It creates synthetic `CatalogFileItem` objects for matching. This must now handle folder-prefix stripping.

## Risks & Mitigations

- **Risk**: Search performance degrades with many folders (up to 20) each requiring entry iteration. **Mitigation**: Detection and grouping are O(n) over entries; the search match check is the same complexity as the current flat implementation.

## Activity Log

- 2025-07-20T00:00:00Z - planner - lane=planned - Work package created
- 2026-04-12T00:00:00Z - coder - lane=doing - Starting implementation
- 2026-04-12T00:01:00Z - coder - T18-01 completed - Added hasFolderSearchMatch() and search filtering in getSourceChildren()
- 2026-04-12T00:02:00Z - coder - T18-02 completed - Verified category-level search works via existing getCategoryNodes() logic
- 2026-04-12T00:03:00Z - coder - T18-03 completed - Updated hasAnySearchMatch() with folder-aware prefix stripping
- 2026-04-12T00:04:00Z - coder - T18-04 completed - Verified Source > Folder > Category > Item hierarchy preserved during search
- 2026-04-12T00:05:00Z - coder - T18-05 completed - Added 13 unit tests in search.test.ts covering all folder search scenarios
- 2026-04-12T00:06:00Z - coder - lane=for_review - All tasks complete, tests passing (555/555)
