---
lane: for_review
---

# WP11 - Bug Fixes: Update Badge Visibility and Installed Cache Race

> **Spec**: `specs/002-new-content-notifications.spec.md`
> **Status**: Not Started
> **Priority**: P1 (bug fix - prerequisite for correct badge behavior)
> **Goal**: Fix the literal `$(cloud-download)` text in update descriptions and eliminate the race condition where installed/update badges disappear during async cache refresh.
> **Independent Test**: Install an item, trigger an update check, verify description shows "update available" (plain text, no codicon syntax) and the cloud-download icon renders correctly. Call `refresh()` and verify `installedIds` is never empty during the async repopulation.
> **Depends on**: none
> **Parallelisable**: Yes (no dependency on WP12-WP14)
> **Prompt**: `plans/WP11-bug-fixes.md`

## Objective

This work package fixes two existing bugs that affect tree badge rendering. These must be fixed before WP13 integrates the TreeView.badge, because the badge count depends on accurate update detection (`hasUpdate`) and installed state (`installedIds`). Both fixes are small, targeted changes to `catalogTree.ts` with corresponding test updates.

## Spec References

- FR-024, FR-025 (Section 4.7 - Update Badge Visibility Fix)
- FR-026, FR-027 (Section 4.8 - Installed Cache Race Condition Fix)
- US-04 (Section 5 - Fix update badge)
- US-05 (Section 5 - Fix installed cache race)
- Section 8.3 (Modified createFileTreeItem)
- Section 8.4 (Modified refreshInstalledCache)

## Tasks

### T11-01 - Fix codicon literal text in update description

- **Description**: In `createFileTreeItem()` (src/providers/catalogTree.ts line ~642), change the `description` from `'$(cloud-download) update available'` to `'update available'`. The `$(cloud-download)` codicon syntax is NOT rendered in TreeItem descriptions -- it appears as literal text. The icon is already correctly set via `treeItem.iconPath = new vscode.ThemeIcon('cloud-download')`.
- **Spec refs**: FR-024, FR-025, US-04, Section 8.3
- **Parallel**: Yes
- **Acceptance criteria**:
  - [ ] FR-024: `createFileTreeItem()` SHALL NOT use codicon syntax `$(icon-name)` in the `description` field when `item.updateAvailable` is true
  - [ ] FR-025: The update visual indicator SHALL rely solely on `treeItem.iconPath = new vscode.ThemeIcon('cloud-download')`
  - [ ] The `description` for update-available items is exactly the string `'update available'`
  - [ ] The `iconPath` remains `new vscode.ThemeIcon('cloud-download')` (unchanged)
  - [ ] No other `description` fields in `createFileTreeItem()` are modified
- **Test requirements**: unit - extend catalogTree.test.ts
- **Depends on**: none
- **Implementation Guidance**:
  - **File**: `src/providers/catalogTree.ts`, line ~642
  - **Change**: Single string replacement: `'$(cloud-download) update available'` to `'update available'`
  - **Official docs**: VS Code icons-in-labels reference - https://code.visualstudio.com/api/references/icons-in-labels - confirms codicons only render in `label` (via `TreeItemLabel`), not in `description`
  - **Known pitfall**: Ensure the `iconPath` assignment on line ~643 is NOT removed -- it is the correct way to show the icon
  - **Spec validation**: Verify no other codicon `$(...)` patterns exist in any `description` assignment in the file

### T11-02 - Fix installed cache race condition with atomic swap

- **Description**: In `refreshInstalledCache()` (src/providers/catalogTree.ts lines ~170-190), the current code calls `this.installedIds.clear()` before the async manifest reads complete, leaving a window where `installedIds` is empty. Change to build a new `Set<string>` locally and atomically swap it into `this.installedIds` after all promises resolve.
- **Spec refs**: FR-026, FR-027, US-05, Section 8.4
- **Parallel**: Yes
- **Acceptance criteria**:
  - [ ] FR-026: `refreshInstalledCache()` SHALL NOT clear `installedIds` before the async manifest read completes. Instead, it SHALL build a new `Set<string>` and then atomically swap it into `this.installedIds` once all manifests have been read.
  - [ ] FR-027: The `_onDidChangeTreeData.fire(undefined)` call SHALL fire only after the atomic swap, not before.
  - [ ] During the async loading window, `this.installedIds` retains the previous (stale) data rather than being empty.
  - [ ] After the promise resolves, `this.installedIds` reflects the current manifest state.
- **Test requirements**: unit - extend catalogTree.test.ts
- **Depends on**: none
- **Implementation Guidance**:
  - **File**: `src/providers/catalogTree.ts`, method `refreshInstalledCache()`
  - **Before** (current code):
    ```typescript
    this.installedIds.clear();
    Promise.all(folders.map(async (f) => {
      const m = await this.manifestMgr!.readManifest(f);
      for (const entry of m.installations) {
        this.installedIds.add(entry.id);
      }
    })).then(() => {
      this._onDidChangeTreeData.fire(undefined);
    });
    ```
  - **After** (fixed code):
    ```typescript
    const newIds = new Set<string>();
    Promise.all(folders.map(async (f) => {
      try {
        const m = await this.manifestMgr!.readManifest(f);
        for (const entry of m.installations) {
          newIds.add(entry.id);
        }
      } catch {
        // ignore - same as before
      }
    })).then(() => {
      this.installedIds = newIds;  // atomic swap
      this._onDidChangeTreeData.fire(undefined);
    });
    ```
  - **Known pitfall**: Do NOT remove the `try/catch` around each manifest read -- it protects against corrupt manifests. The existing code already has this pattern.
  - **Concurrency note**: JavaScript is single-threaded. The assignment `this.installedIds = newIds` is atomic from the perspective of any tree rendering code that reads it, since no code can interleave between the assignment and the `.fire()` call in the same microtask.

### T11-03 - Unit tests for update badge fix

- **Description**: Add unit tests in `test/suite/catalogTree.test.ts` that assert the update-available tree item has `description === 'update available'` (no codicon syntax) and `iconPath` is a `ThemeIcon` with id `'cloud-download'`.
- **Spec refs**: FR-024, FR-025, US-04 Scenario 1, Section 11.1
- **Parallel**: No (depends on T11-01)
- **Acceptance criteria**:
  - [ ] Test case: given `CatalogFileItem` with `updateAvailable = true`, `createFileTreeItem()` returns item with `description === 'update available'`
  - [ ] Test case: given `CatalogFileItem` with `updateAvailable = true`, `description` does NOT contain the substring `$(cloud-download)`
  - [ ] Test case: given `CatalogFileItem` with `updateAvailable = true`, `iconPath` is `ThemeIcon('cloud-download')`
  - [ ] All existing catalogTree tests continue to pass
- **Test requirements**: unit
- **Depends on**: T11-01
- **Implementation Guidance**:
  - **File**: `test/suite/catalogTree.test.ts`
  - **Pattern**: Follow existing `describe('getTreeItem', ...)` block. Create mock `CatalogFileItem` with `installed: true, updateAvailable: true`, call `provider.getTreeItem(item)`, assert on the returned `vscode.TreeItem`.
  - **Mock setup**: Use existing `createMockGitHubClient()` and `createMockSourceRegistry()` helpers. Set up lifecycle mock with `hasUpdate()` returning true.
  - **Assertion patterns**: `assert.strictEqual(treeItem.description, 'update available')` and `assert.ok(!String(treeItem.description).includes('$('))`.

### T11-04 - Unit tests for installed cache atomic swap

- **Description**: Add unit tests that verify `installedIds` is never observed as empty during `refreshInstalledCache()` async execution. Verify that after the promise resolves, the set contains the expected IDs and `_onDidChangeTreeData` fires exactly once after the swap.
- **Spec refs**: FR-026, FR-027, US-05 Scenarios 1-2, Section 11.1
- **Parallel**: No (depends on T11-02)
- **Acceptance criteria**:
  - [ ] Test case: after calling `refresh()`, reading `installedIds` (via `getFileNodes` which checks it) never returns empty when items were previously installed
  - [ ] Test case: after the async refresh promise resolves, `installedIds` contains the manifested IDs
  - [ ] Test case: `_onDidChangeTreeData` fires after the swap, not during the clear phase (because there is no clear phase now)
  - [ ] All existing catalogTree tests continue to pass
- **Test requirements**: unit
- **Depends on**: T11-02
- **Implementation Guidance**:
  - **File**: `test/suite/catalogTree.test.ts`
  - **Strategy**: Inject a mock ManifestManager that returns known installations. Call `refresh()`. Immediately check that `getFileNodes()` for a category still shows items as installed (stale data). Then await a microtask (`await new Promise(r => setTimeout(r, 0))`) and verify updated data.
  - **Known pitfall**: The `refreshInstalledCache()` method is private. Test through the public API: call `refresh()`, then `getChildren()` for a category, check `installed` field on returned items.

### T11-05 - Build and lint verification

- **Description**: Run `npm run lint` and `npm run build` to verify no regressions. Run `npm test` to confirm all tests pass including the new ones.
- **Spec refs**: General quality gate
- **Parallel**: No (depends on T11-01 through T11-04)
- **Acceptance criteria**:
  - [ ] `npm run lint` passes with zero errors
  - [ ] `npm run build` succeeds with zero errors
  - [ ] `npm test` passes with all tests green including the new T11-03 and T11-04 tests
- **Test requirements**: none (this is the verification step)
- **Depends on**: T11-01, T11-02, T11-03, T11-04
- **Implementation Guidance**:
  - Run commands in sequence: `npm run lint`, `npm run build`, `npm test`
  - If lint errors: fix them in the files modified by T11-01/T11-02
  - If test failures: debug and fix before marking complete

## Implementation Notes

- Both bug fixes modify the same file (`src/providers/catalogTree.ts`) but different methods, so they can be implemented in parallel.
- The update badge fix (T11-01) is a single-line string change.
- The race fix (T11-02) requires restructuring approximately 10 lines of code.
- Tests should be added in a new `describe` block: `describe('Bug fixes (WP11)', () => { ... })` within the existing `catalogTree.test.ts`.

## Parallel Opportunities

- T11-01 and T11-02 can be worked concurrently (different methods in the same file).
- T11-03 depends on T11-01; T11-04 depends on T11-02.
- T11-05 is the final verification gate.

## Risks & Mitigations

- **Risk**: Changing `refreshInstalledCache()` could break the timing of `_onDidChangeTreeData` events.
  - **Mitigation**: The atomic swap preserves the exact same event firing pattern -- `.fire()` still happens in the `.then()` callback. The only change is that stale data is served instead of empty data during the async window.
- **Risk**: The `description` field change could affect existing tests that assert on the old string.
  - **Mitigation**: Search for `'$(cloud-download) update available'` in test files and update any matching assertions.

## Activity Log

- 2026-03-17T00:00:00Z - planner - lane=planned - Work package created
- 2026-03-18T00:00:00Z - coder - lane=doing - Starting implementation
- 2026-03-18T00:01:00Z - coder - lane=for_review - All tasks complete, submitted for review
