---
skill: review-performance
wp: WP16
spec: .sdd/specs/003-folder-segregation-and-onboarding.spec.md
reviewed_at: 2026-04-12T17:00:00Z
status: completed
finding_counts:
  pass: 2
  warn: 1
  fail: 0
  na: 4
files_reviewed:
  - src/providers/catalogTree.ts
---

# review-performance Findings for WP16

## Summary

Evaluated 7 performance categories. 4 are N/A (no database, no blocking I/O, no unbounded fetches, no data structure misuse). 2 pass. 1 WARN for missing caching of folder detection results, causing redundant O(n) computation on each folder/category expansion.

## Findings

### PERF-001 [N/A]
- **Checklist item**: Category 1 - N+1 Query Patterns
- **Justification**: No database queries in WP16. All data comes from cached in-memory tree responses.

### PERF-002 [N/A]
- **Checklist item**: Category 2 - Missing Database Indexes
- **Justification**: No database operations in WP16.

### PERF-003 [N/A]
- **Checklist item**: Category 3 - Blocking in Async Contexts
- **Justification**: `getFolderNodes()` is synchronous and only called from within already-async methods that have awaited the tree fetch. `detectFolders()` and `groupByFolder()` are pure CPU operations over in-memory arrays, not blocking I/O.

### PERF-004 [N/A]
- **Checklist item**: Category 4 - Unbounded Data Fetching
- **Justification**: Tree data is already fetched and bounded by the GitHub Tree API. No new data fetching in folder display.

### PERF-005 [WARN]
- **Checklist item**: Category 5 - Unnecessary Computation in Hot Paths
- **File**: src/providers/catalogTree.ts#L450-L475, src/providers/catalogTree.ts#L660-L690
- **Description**: `detectFolders()` and `groupByFolder()` are called on every folder expansion (`getFolderChildren`) and every category expansion within a folder (`getFileNodes`). For a source with 20 folders each containing 3 categories, this means 20 + 60 = 80 redundant O(n) scans of the tree array. While each call is fast (tree is in memory), the results are identical for the same source and could be cached alongside `treeCache`.
- **Expected**: Cache `detectFolders()` and `groupByFolder()` results per source (keyed by `sourceKey(source)`) and invalidate on `refresh()`.

### PERF-006 [PASS]
- **Checklist item**: Category 6 - Inefficient Data Structures
- **File**: src/providers/catalogTree.ts#L310-L340
- **Description**: Uses `Set<string>` for folder name lookups (O(1) membership test) and `Map<string, GitHubTreeEntry[]>` for grouped entries. Data structures are well-matched to access patterns.

### PERF-007 [PASS]
- **Checklist item**: Category 7 - Missing Caching
- **File**: src/providers/catalogTree.ts#L780-L800
- **Description**: Tree responses are properly cached via `treeCache` (existing pattern). The folder detection caching gap is already captured in PERF-005.
