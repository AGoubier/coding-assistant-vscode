---
skill: review-performance
wp: WP19-index-url-migration
spec: .sdd/specs/003-folder-segregation-and-onboarding.spec.md
reviewed_at: 2026-04-12T12:00:00Z
status: completed
finding_counts:
  pass: 3
  warn: 1
  fail: 0
  na: 3
files_reviewed:
  - src/services/sourceRegistry.ts
  - test/suite/multiIndex.test.ts
---

# review-performance Findings for WP19-index-url-migration

## Summary

Evaluated all 7 performance categories for WP19. Three categories are applicable (blocking in async, inefficient data structures, missing caching). All three pass. One WARN for NFR-009 test threshold mismatch. Three categories are N/A (no database queries, no database indexes, no unbounded data fetching).

## Findings

### PERF-001 [PASS]
- **Checklist item**: Blocking in Async Contexts
- **Requirement**: FR-044 category 3, NFR-003
- **File**: src/services/sourceRegistry.ts#L198-L200
- **Description**: `Promise.allSettled()` used for parallel async fetches. No synchronous I/O calls inside async functions. URL validation (`new URL()`, `protocol` check) is synchronous but O(1) and appropriate.

### PERF-002 [PASS]
- **Checklist item**: Inefficient Data Structures
- **Requirement**: FR-044 category 6
- **File**: src/services/sourceRegistry.ts#L203-L204
- **Description**: Uses `Set<string>` for dedup membership testing, providing O(1) lookups. Array used for ordered result accumulation which is correct for the first-seen-wins ordering requirement.

### PERF-003 [PASS]
- **Checklist item**: Missing Caching
- **Requirement**: FR-044 category 7
- **File**: src/services/sourceRegistry.ts#L62-L63
- **Description**: `cachedMasterIndex` caches the merged result. Cache is invalidated on setting change via `onDidChangeConfiguration` listener (FR-027). No unnecessary repeated fetches.

### PERF-004 [WARN]
- **Checklist item**: NFR threshold compliance
- **Requirement**: NFR-009
- **File**: test/suite/multiIndex.test.ts#L297-L298
- **Description**: NFR-009 specifies merge of 1000 entries completes in under 200ms. The test asserts `elapsed < 5000` (5 seconds), which is 25x looser than the spec threshold. The implementation uses Set-based O(n) dedup which should easily meet 200ms, but the test does not verify the NFR threshold.

### PERF-005 [N/A]
- **Checklist item**: N+1 Query Patterns
- **Justification**: No database access in this WP.

### PERF-006 [N/A]
- **Checklist item**: Missing Database Indexes
- **Justification**: No database access in this WP.

### PERF-007 [N/A]
- **Checklist item**: Unbounded Data Fetching
- **Justification**: Fetch count is bounded by URL array length. NFR-008 specifies up to 10 URLs.
