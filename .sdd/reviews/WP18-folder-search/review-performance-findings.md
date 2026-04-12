---
skill: review-performance
wp: WP18-folder-search
spec: .sdd/specs/003-folder-segregation-and-onboarding.spec.md
status: WARN
finding_counts:
  pass: 3
  warn: 1
  fail: 0
  na: 0
files_reviewed:
  - src/providers/catalogTree.ts
---

# review-performance Findings -- WP18-folder-search

### PERF-01 [WARN] Redundant computation in hot path

**File**: `src/providers/catalogTree.ts` lines 443-450 (`getSourceChildren`, search-active branch)

`getSourceChildren()` calls `getFolderNodes()` (which internally calls `detectFolders()` and `groupByFolder()`), then when the search query is active, immediately calls `detectFolders()` and `groupByFolder()` again to build the `grouped` map for `hasFolderSearchMatch()`.

This duplicates two O(n) passes over the tree entries array. While well within the 50ms NFR-002 budget for typical source sizes, refactoring to compute detection/grouping once and pass results to both `getFolderNodes()` and the search filter would eliminate the redundancy.

**Impact**: Low. Theoretical concern for very large repositories (>10k entries), but harmless for typical sizes.

### PERF-02 [PASS] Early termination

`hasFolderSearchMatch()` uses `.some()` for early termination on first match. `hasAnySearchMatch()` returns `true` immediately on first match across sources and folders. Optimal.

### PERF-03 [PASS] No blocking in async context

All new code paths use `await` correctly. No synchronous I/O or CPU-intensive computations blocking the event loop.

### PERF-04 [PASS] Cache utilization

Tree data is fetched via `getOrFetchTree()` which uses `treeCache`. No redundant network calls.
