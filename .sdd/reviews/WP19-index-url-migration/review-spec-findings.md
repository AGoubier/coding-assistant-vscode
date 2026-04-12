---
skill: review-spec
wp: WP19-index-url-migration
spec: .sdd/specs/003-folder-segregation-and-onboarding.spec.md
reviewed_at: 2026-04-12T12:00:00Z
status: completed
finding_counts:
  pass: 9
  warn: 0
  fail: 0
  na: 0
files_reviewed:
  - src/services/sourceRegistry.ts
  - src/models/types.ts
  - src/models/errors.ts
  - package.json
  - test/suite/multiIndex.test.ts
---

# review-spec Findings for WP19-index-url-migration

## Summary

Evaluated 7 FRs (FR-021 through FR-027) and 2 SCs (SC-004, SC-005) referenced by WP19. All functional requirements are fully implemented as specified. The `normalizeIndexUrls()` function correctly implements the coercion state machine. `loadMultipleIndexes()` uses `Promise.allSettled()` for parallel fetch with union merge and first-seen-wins dedup by `sourceKey()`. Cache invalidation, HTTPS validation, and error handling are all compliant with the specification.

## Findings

### SPEC-001 [PASS]
- **Checklist item**: FR classification - SHALL obligation
- **Requirement**: FR-021
- **File**: package.json#L278-L288
- **Description**: `indexUrl` setting correctly changed to `type: "array"` with `items: { type: "string" }`. Default is a single-element array with the community master index URL. `markdownDescription` explains multiple URLs, dedup behavior, and HTTPS requirement.

### SPEC-002 [PASS]
- **Checklist item**: FR classification - SHALL obligation
- **Requirement**: FR-022
- **File**: src/services/sourceRegistry.ts#L37-L53
- **Description**: `normalizeIndexUrls()` correctly coerces string to single-element array, passes through string arrays unchanged, falls back to defaults for undefined, and logs warnings for invalid types (number, null, object). Mixed arrays (not all strings) correctly fall through to the default case.

### SPEC-003 [PASS]
- **Checklist item**: FR classification - SHALL obligation
- **Requirement**: FR-023
- **File**: src/services/sourceRegistry.ts#L37-L53
- **Description**: Migration is transparent -- runtime coercion handles existing string values without modifying the stored setting. No manual user action required.

### SPEC-004 [PASS]
- **Checklist item**: FR classification - SHALL obligation
- **Requirement**: FR-024
- **File**: src/services/sourceRegistry.ts#L183-L237
- **Description**: `loadMultipleIndexes()` uses `Promise.allSettled()` for parallel fetch. Partial failures are logged and remaining URLs continue processing. Total failure returns empty sources array and `loadMasterIndex()` sets `cachedMasterIndex` to undefined.

### SPEC-005 [PASS]
- **Checklist item**: FR classification - SHALL obligation
- **Requirement**: FR-025
- **File**: src/services/sourceRegistry.ts#L196-L230
- **Description**: Dedup uses `Set<string>` of `sourceKey()` values. Sources from multiple indexes are union-merged with dedup by `url@branch` composite key.

### SPEC-006 [PASS]
- **Checklist item**: FR classification - SHALL obligation
- **Requirement**: FR-026
- **File**: src/services/sourceRegistry.ts#L196-L230
- **Description**: Results are iterated in `validUrls` array order (preserving input URL array order). First-seen-wins: `seenKeys.has(key)` check prevents later duplicates from overwriting earlier entries.

### SPEC-007 [PASS]
- **Checklist item**: FR classification - SHALL obligation
- **Requirement**: FR-027
- **File**: src/services/sourceRegistry.ts#L71-L80
- **Description**: `onDidChangeConfiguration` listener checks `affectsConfiguration('awesome-coding-assistants.indexUrl')` and clears `cachedMasterIndex` on change. VS Code's `affectsConfiguration()` correctly detects changes to array settings.

### SPEC-008 [PASS]
- **Checklist item**: SC verification
- **Requirement**: SC-004
- **File**: package.json#L278-L288, src/services/sourceRegistry.ts#L37-L53
- **Description**: indexUrl accepts array (package.json type:array), auto migration from single-string values (normalizeIndexUrls), Settings UI renders as editable list (VS Code native behavior for array-of-string settings).

### SPEC-009 [PASS]
- **Checklist item**: SC verification
- **Requirement**: SC-005
- **File**: src/services/sourceRegistry.ts#L183-L237
- **Description**: Multiple URLs union-merged with dedup by `url@branch` key. First-seen metadata wins on conflict. Verified by unit tests in multiIndex.test.ts.
