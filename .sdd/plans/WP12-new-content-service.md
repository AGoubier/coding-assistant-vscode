---
lane: done
---

# WP12 - NewContentDetector Service and Data Model

> **Spec**: `specs/002-new-content-notifications.spec.md`
> **Status**: Complete
> **Priority**: P1 (core domain - enables all new-content features)
> **Goal**: Implement the `NewContentDetector` service that performs tree snapshot diffing to detect new items in upstream sources, with full unit test coverage.
> **Independent Test**: Create a mock globalState and tree response. Call `checkForNewContent()` twice with different trees. Verify the second call correctly identifies new paths. Verify `markCategorySeen()` removes paths. Verify `getTotalNewCount()` returns correct sum.
> **Depends on**: none (service is standalone; integration with tree UI is WP13)
> **Parallelisable**: Yes (with WP11 - no shared code changes)
> **Prompt**: `plans/WP12-new-content-service.md`

## Objective

This work package creates the `NewContentDetector` service -- the core domain logic for tree snapshot diffing. It also extends the data model (`types.ts`) with the `NewContentResult` interface and `CatalogFileItem` extensions, adds the `newContentDetection` configuration setting, and delivers comprehensive unit tests. The service is fully functional and testable in isolation before any UI integration in WP13.

## Spec References

- FR-001 through FR-006 (Section 4.1 - New Content Detection)
- FR-029 (Section 4.9 - newContentDetection kill switch)
- Section 4.10 (NewContentDetector Service Contract)
- Section 4.11 (NewContentResult Interface)
- Section 7.1 (NewContentResult data model)
- Section 7.2 (GlobalState key patterns)
- Section 7.3, 7.4 (CatalogFileItem extensions)
- Section 10.5 (Observability - logging requirements)
- Section 11.1 (Unit test requirements for NewContentDetector)
- Edge cases: first activation baseline, truncated tree, globalState failures

## Tasks

### T12-01 - Add NewContentResult interface and CatalogFileItem extensions to types.ts

- **Description**: Add the `NewContentResult` interface and extend `CatalogFileItem` with optional `isNew` and `isRemoved` fields in `src/models/types.ts`.
- **Spec refs**: Section 4.11, Section 7.1, Section 7.3, Section 7.4
- **Parallel**: Yes
- **Acceptance criteria**:
  - [x] `NewContentResult` interface exists with fields: `newPaths: string[]`, `removedPaths: string[]`, `sourceUrl: string`
  - [x] `CatalogFileItem` interface has optional field `isNew?: boolean`
  - [x] `CatalogFileItem` interface has optional field `isRemoved?: boolean`
  - [x] No existing code breaks (fields are optional with implicit `false` default)
  - [x] TypeScript compiles without errors
- **Test requirements**: none (type-only change, verified by compilation)
- **Depends on**: none
- **Implementation Guidance**:
  - **File**: `src/models/types.ts`
  - **Location**: Add `NewContentResult` after the `UpdateCheckResult` interface (around line 120). Add `isNew?` and `isRemoved?` to `CatalogFileItem` after the `description` field (around line 100).
  - **Exact interface**:
    ```typescript
    export interface NewContentResult {
      newPaths: string[];
      removedPaths: string[];
      sourceUrl: string;
    }
    ```
  - **CatalogFileItem additions**:
    ```typescript
    isNew?: boolean;
    isRemoved?: boolean;
    ```
  - **Known pitfall**: Do NOT change existing field types or make any existing optional field required. The `isNew` and `isRemoved` fields default to `undefined` (falsy) so all existing code that constructs `CatalogFileItem` objects continues to work.

### T12-02 - Add newContentDetection configuration setting to package.json

- **Description**: Add the `awesome-coding-assistants.newContentDetection` boolean setting (default: `true`) to `package.json` configuration schema.
- **Spec refs**: FR-029, Section 8.5
- **Parallel**: Yes
- **Acceptance criteria**:
  - [x] FR-029: Configuration setting `awesome-coding-assistants.newContentDetection` exists as boolean with default `true`
  - [x] Description reads: "Detect new and removed items in source repositories. Disable to only check for updates to installed items."
  - [x] Setting appears in VS Code settings UI under the extension's section
  - [x] `npm run build` passes after the change
- **Test requirements**: none (JSON schema change, verified by build)
- **Depends on**: none
- **Implementation Guidance**:
  - **File**: `package.json`, inside `contributes.configuration.properties`
  - **Add after the `autoCheckIntervalMinutes` property**:
    ```json
    "awesome-coding-assistants.newContentDetection": {
      "type": "boolean",
      "default": true,
      "description": "Detect new and removed items in source repositories. Disable to only check for updates to installed items."
    }
    ```

### T12-03 - Implement NewContentDetector service

- **Description**: Create `src/services/newContentDetector.ts` implementing the full service contract from Section 4.10. The service manages tree snapshot baselines in globalState and computes new/removed paths via set diffing.
- **Spec refs**: FR-001 through FR-006, Section 4.10, Section 7.2, Section 10.5
- **Parallel**: No (depends on T12-01 for types)
- **Acceptance criteria**:
  - [x] FR-001: `checkForNewContent()` stores baseline paths under `newContent:seen:{sourceUrl}` as JSON array
  - [x] FR-002: `checkForNewContent()` compares current tree against stored baseline
  - [x] FR-003: New paths = current blob paths minus baseline paths
  - [x] FR-004: First activation (no baseline) establishes baseline silently, returns empty `newPaths` and `removedPaths`
  - [x] FR-005: New paths stored under `newContent:new:{sourceUrl}` as JSON array
  - [x] FR-006: After diff, baseline is updated to current tree paths
  - [x] Only `blob` type entries are included in the baseline and diff (not `tree` type directory entries)
  - [x] Truncated trees (`truncated === true` on the response) are detected: the method SHALL accept a `truncated` boolean parameter and skip diffing when true, logging a warning
  - [x] `getNewItems(sourceUrl)` returns paths from `newContent:new:{sourceUrl}` or `[]`
  - [x] `getRemovedItems(sourceUrl)` returns paths from `newContent:removed:{sourceUrl}` or `[]`
  - [x] `markCategorySeen(sourceUrl, categoryPaths)` removes specified paths from `newContent:new:{sourceUrl}`
  - [x] `markAllSeen()` clears all `newContent:new:*` and `newContent:removed:*` keys
  - [x] `getTotalNewCount()` sums lengths of all `newContent:new:*` arrays
  - [x] `getTotalRemovedCount()` sums lengths of all `newContent:removed:*` arrays
  - [x] Logging follows Section 10.5: info for new content detected, info for baseline established, warn for truncated tree, warn for check failure
- **Test requirements**: unit (T12-04)
- **Depends on**: T12-01
- **Implementation Guidance**:
  - **File**: `src/services/newContentDetector.ts` (new file)
  - **Constructor**: `constructor(private readonly globalState: vscode.Memento, private readonly log: vscode.LogOutputChannel)`
  - **GlobalState key patterns**:
    - Baseline: `newContent:seen:{sourceUrl}`
    - New items: `newContent:new:{sourceUrl}`
    - Removed items: `newContent:removed:{sourceUrl}`
  - **Key implementation detail for `checkForNewContent()`**:
    ```typescript
    async checkForNewContent(sourceUrl: string, currentTree: GitHubTreeEntry[], truncated: boolean): Promise<NewContentResult> {
      if (truncated) {
        this.log.warn(`Truncated tree for ${sourceUrl}, skipping new-content detection`);
        return { newPaths: [], removedPaths: [], sourceUrl };
      }

      const currentPaths = new Set(
        currentTree.filter(e => e.type === 'blob').map(e => e.path)
      );

      const baselineKey = `newContent:seen:${sourceUrl}`;
      const stored = this.globalState.get<string[]>(baselineKey);

      if (!stored) {
        // First activation - establish baseline
        await this.globalState.update(baselineKey, [...currentPaths]);
        this.log.info(`Baseline established for ${sourceUrl}: ${currentPaths.size} items`);
        return { newPaths: [], removedPaths: [], sourceUrl };
      }

      const baselinePaths = new Set(stored);
      const newPaths = [...currentPaths].filter(p => !baselinePaths.has(p));
      const removedPaths = [...baselinePaths].filter(p => !currentPaths.has(p));

      // Store diff results
      await this.globalState.update(`newContent:new:${sourceUrl}`, newPaths);
      await this.globalState.update(`newContent:removed:${sourceUrl}`, removedPaths);
      // Update baseline to current tree
      await this.globalState.update(baselineKey, [...currentPaths]);

      if (newPaths.length > 0 || removedPaths.length > 0) {
        this.log.info(`New content detected: ${newPaths.length} new items, ${removedPaths.length} removed items in ${sourceUrl}`);
      }

      return { newPaths, removedPaths, sourceUrl };
    }
    ```
  - **Key implementation detail for `markAllSeen()`**:
    ```typescript
    async markAllSeen(): Promise<void> {
      const keys = this.globalState.keys();
      let cleared = 0;
      for (const key of keys) {
        if (key.startsWith('newContent:new:') || key.startsWith('newContent:removed:')) {
          await this.globalState.update(key, undefined);
          cleared++;
        }
      }
      this.log.debug(`Mark all seen: cleared ${cleared} keys`);
    }
    ```
  - **Key implementation detail for `getTotalNewCount()`**:
    ```typescript
    getTotalNewCount(): number {
      return this.globalState.keys()
        .filter(k => k.startsWith('newContent:new:'))
        .reduce((sum, k) => sum + (this.globalState.get<string[]>(k)?.length ?? 0), 0);
    }
    ```
  - **Export**: Add to `src/services/index.ts` barrel export
  - **Official docs**: VS Code Memento API - https://code.visualstudio.com/api/references/vscode-api#Memento
  - **Known pitfall**: `globalState.keys()` returns ALL keys including cache keys. Filter strictly by prefix `newContent:`.
  - **Known pitfall**: `globalState.get()` returns `undefined` for missing keys; always use nullish coalescing for array reads.

### T12-04 - Unit tests for NewContentDetector

- **Description**: Create `test/suite/newContentDetector.test.ts` with comprehensive tests for all `NewContentDetector` methods. Minimum coverage: 90% line, 85% branch.
- **Spec refs**: Section 11.1, Section 11.2 BDD Scenarios (New items detected, First activation, Category expand, Mark All as Seen, Detection disabled)
- **Parallel**: No (depends on T12-03)
- **Acceptance criteria**:
  - [x] Test: `checkForNewContent()` with no prior baseline - establishes baseline, returns empty `newPaths` and `removedPaths`
  - [x] Test: `checkForNewContent()` with 2 new blob paths - returns correct `newPaths`, `removedPaths` empty
  - [x] Test: `checkForNewContent()` with 1 removed path - returns correct `removedPaths`
  - [x] Test: `checkForNewContent()` with mixed new and removed - correct computation
  - [x] Test: `checkForNewContent()` ignores `tree`-type entries (only blobs in baseline)
  - [x] Test: `checkForNewContent()` with `truncated = true` - skips detection, returns empty result
  - [x] Test: `getNewItems()` returns stored new paths for a source
  - [x] Test: `getNewItems()` returns `[]` for unknown source
  - [x] Test: `getRemovedItems()` returns stored removed paths for a source
  - [x] Test: `markCategorySeen()` removes specified paths from new list
  - [x] Test: `markCategorySeen()` is idempotent (no error if paths already absent)
  - [x] Test: `markAllSeen()` clears all new and removed keys from all sources
  - [x] Test: `getTotalNewCount()` sums across multiple sources
  - [x] Test: `getTotalRemovedCount()` sums across multiple sources
  - [x] Test: globalState read returning undefined returns empty arrays (error resilience)
  - [x] All tests pass with `npm test`
- **Test requirements**: unit
- **Depends on**: T12-03
- **Implementation Guidance**:
  - **File**: `test/suite/newContentDetector.test.ts` (new file)
  - **Mock setup**: Use `createMockMemento()` from `test/helpers/mocks.ts` for globalState. Use `createMockLogOutputChannel()` for the logger.
  - **Test tree fixture**: Reuse `GitHubTreeEntry` objects with `type: 'blob'` and `type: 'tree'`:
    ```typescript
    const TREE_V1: GitHubTreeEntry[] = [
      { path: '.github/agents/a.agent.md', mode: '100644', type: 'blob', sha: 'a1', url: '' },
      { path: '.github/agents/b.agent.md', mode: '100644', type: 'blob', sha: 'b1', url: '' },
      { path: '.github/agents', mode: '040000', type: 'tree', sha: 'g1', url: '' },
    ];
    const TREE_V2: GitHubTreeEntry[] = [
      ...TREE_V1,
      { path: '.github/agents/c.agent.md', mode: '100644', type: 'blob', sha: 'c1', url: '' },
      { path: '.github/prompts/p.prompt.md', mode: '100644', type: 'blob', sha: 'p1', url: '' },
    ];
    ```
  - **Pattern**: Follow existing test patterns in `test/suite/lifecycle.test.ts` for describe/it structure and assertion style.
  - **Describe blocks**: One `describe('WP12 - NewContentDetector', ...)` with nested describes per method.

### T12-05 - Export and barrel file updates

- **Description**: Export `NewContentDetector` from `src/services/index.ts`. Ensure the new type `NewContentResult` is exported from `src/models/index.ts`.
- **Spec refs**: Section 9.3 (Directory & Module Structure)
- **Parallel**: No (depends on T12-01, T12-03)
- **Acceptance criteria**:
  - [x] `NewContentDetector` is importable via `import { NewContentDetector } from './services'`
  - [x] `NewContentResult` is importable via `import type { NewContentResult } from './models/types'`
  - [x] `npm run build` succeeds
- **Test requirements**: none (verified by compilation)
- **Depends on**: T12-01, T12-03
- **Implementation Guidance**:
  - **File**: `src/services/index.ts` - add `export { NewContentDetector } from './newContentDetector';`
  - **File**: `src/models/index.ts` - verify `NewContentResult` is re-exported (it should be if `types.ts` is already re-exported via `export * from './types'`)

### T12-06 - Build and test verification

- **Description**: Run `npm run lint`, `npm run build`, and `npm test` to confirm all new and existing tests pass.
- **Spec refs**: General quality gate
- **Parallel**: No (depends on all prior tasks)
- **Acceptance criteria**:
  - [x] `npm run lint` passes with zero errors
  - [x] `npm run build` succeeds with zero errors
  - [x] `npm test` passes with all tests green including new T12-04 tests
  - [x] No TypeScript compiler warnings related to new code
- **Test requirements**: none (verification step)
- **Depends on**: T12-01, T12-02, T12-03, T12-04, T12-05
- **Implementation Guidance**:
  - Run: `npm run lint && npm run build && npm test`
  - Fix any issues found before marking complete

## Implementation Notes

- The `NewContentDetector` is a pure service with no UI dependencies. It only requires `vscode.Memento` (globalState) and a log channel.
- The service is designed to be instantiated once in `extension.ts` and injected into the tree provider (done in WP13).
- GlobalState keys use a `newContent:` prefix to avoid collision with the existing `cache:` prefix used by `CacheManager`.
- The `checkForNewContent()` method accepts a `truncated` boolean parameter rather than the full `GitHubTreeResponse` to keep the interface clean. The caller extracts `truncated` from the response.

## Parallel Opportunities

- T12-01 and T12-02 can be done concurrently (different files).
- T12-03 depends on T12-01 (needs the types).
- T12-04 depends on T12-03.
- T12-05 depends on T12-01 and T12-03.

## Risks & Mitigations

- **Risk**: `globalState.keys()` might not be available on older VS Code versions.
  - **Mitigation**: The extension requires `^1.85.0` which has full Memento API including `.keys()`. Verified in OQ-1.
- **Risk**: Large tree snapshots could slow globalState writes.
  - **Mitigation**: NFR-001/NFR-002 set bounds: up to 1000 entries per source, ~5 KB per key. VS Code Memento handles this easily.
- **Risk**: Storing raw source URLs as globalState keys could create very long key strings.
  - **Mitigation**: Source URLs are typically ~60 chars. Combined key `newContent:seen:https://github.com/owner/repo` is ~80 chars. Well within any reasonable key length limit.

## Self-Review

### Spec Compliance
- [x] Every item in the Spec Compliance Checklist is checked off
- [x] Every SHALL obligation from referenced FRs (FR-001 through FR-006, FR-029) has corresponding code
- [x] Every error code from the API contract is returned correctly
- [x] Every validation rule from the data model is enforced in code
- [x] Every acceptance scenario has a corresponding test (19 tests total)

### Correctness
- [x] All acceptance criteria from the spec are met
- [x] All 403 test cases pass (including 19 new NewContentDetector tests)
- [x] Edge cases handled: first activation baseline, truncated tree, unknown source, idempotent markCategorySeen
- [x] Error paths behave as specified

### Code quality
- [x] No unused code, dead imports, or debug artifacts left in
- [x] No hardcoded values that belong in config
- [x] No security issues introduced
- [x] Logic is straightforward set-diffing, understandable without spec

### Scope discipline
- [x] Implementation does not exceed what the task required
- [x] No unasked-for abstractions added

### Encoding
- [x] No em dashes, smart quotes, or curly apostrophes in any created or modified file

### Coverage
- Note: c8 cannot instrument VS Code extension host process (known limitation). All 19 tests exercise every method and branch of NewContentDetector including: first activation, subsequent diffs, truncated tree, empty state, multi-source aggregation, mark seen, mark all seen, idempotent operations, and undefined resilience.

### Documentation
- Docs will be updated in WP13/WP14 when the feature is user-facing.

### Outstanding Issues
- None

## Activity Log

- 2026-03-17T00:00:00Z - planner - lane=planned - Work package created
- 2026-03-18T00:02:00Z - coder - lane=doing - Starting implementation
- 2026-03-18T00:10:00Z - coder - lane=for_review - All tasks complete, submitted for review
- 2026-03-18T00:12:00Z - reviewer - lane=done - Approved, all requirements met
