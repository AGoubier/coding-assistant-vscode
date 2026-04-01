---
lane: done
---

# WP14 - Removed Content Rendering and Dismiss

> **Spec**: `specs/002-new-content-notifications.spec.md`
> **Status**: Complete
> **Priority**: P2 (incremental - US-06 removed items are less critical than new items)
> **Goal**: Render items removed from upstream sources as synthetic tree items with "removed upstream" markers, handle the installed vs. not-installed distinction, and ensure "Mark All as Seen" dismisses removed items.
> **Independent Test**: Remove a file from a test source tree fixture. Run the new-content check. Verify the removed item appears in the correct category with "removed upstream" description and warning icon. If installed, verify `contextValue` is `catalogItem.removedInstalled` and the uninstall action is available. Run "Mark All as Seen" and verify the removed item disappears.
> **Depends on**: WP12 (NewContentDetector stores removed paths), WP13 (tree UI integration and badge)
> **Parallelisable**: No (depends on WP13 for tree wiring)
> **Prompt**: `plans/WP14-removed-content.md`

## Objective

This work package extends the tree UI to render items that have been removed from upstream source repositories. Removed items are synthesized from the `newContent:removed:{sourceUrl}` list and merged into the relevant category's file nodes. The rendering distinguishes between installed and not-installed removed items, since installed items need an uninstall action while not-installed items are informational only. This is a P2 increment that builds on the P1 new-content infrastructure from WP12 and WP13.

## Spec References

- FR-007 through FR-010 (Section 4.2 - Removed Content Detection)
- FR-018, FR-019, FR-020 (Section 4.5 - Per-Item "Removed" Markers)
- FR-022 (Section 4.6 - markAllSeen clears removed keys)
- US-06 (Section 5 - See removed items in catalog)
- Section 6 (User Flows 1, 3 - removed items appear after auto-check, cleared by markAllSeen)
- Section 7.3 (CatalogFileItem `isRemoved` field)
- Section 9.1 (Architecture - tree provider merges removed items)
- Section 10.4 (Accessibility - "removed upstream" suffix)
- Section 10.5 (Observability - logging)
- Section 11.1, 11.2 (Test requirements for removed items)

## Tasks

### T14-01 - Merge removed items into getFileNodes()

- **Description**: In `getFileNodes()`, after constructing the list of items from the current tree, fetch `newContentDetector.getRemovedItems(sourceUrl)` and synthesize `CatalogFileItem` objects for removed paths that belong to the current category. Merge these into the returned array. Use `classifyItem()` to derive category/tool and `extractItemName()` for display name.
- **Spec refs**: FR-009, Section 7.3, Section 9.1
- **Parallel**: No
- **Acceptance criteria**:
  - [ ] FR-009: Removed items from `newContent:removed:{sourceUrl}` are merged into `getFileNodes()` output for their respective category
  - [ ] Each synthetic removed item has: `isRemoved: true`, `kind: 'item'`, correct `source`, `path`, `name` (from `extractItemName()`), `tool` and `category` (from `classifyItem()`)
  - [ ] Removed items only appear in the category matching their classified category (not duplicated across categories)
  - [ ] If no removed items exist for the source/category, no synthetic items are added
  - [ ] Current (non-removed) items are unaffected -- their properties remain unchanged
  - [ ] The merged list is sorted so removed items appear at the end of the category (after regular items)
- **Test requirements**: unit (T14-05)
- **Depends on**: WP13 T13-03 (detector injected), WP12 T12-03 (getRemovedItems API)
- **Implementation Guidance**:
  - **File**: `src/providers/catalogTree.ts`, method `getFileNodes()`
  - **After** constructing the regular items array and before returning:
    ```typescript
    // Merge removed items (FR-009)
    if (this.newContentDetector) {
      const removedPaths = this.newContentDetector.getRemovedItems(categoryItem.source.url);
      for (const removedPath of removedPaths) {
        const classification = classifyItem(removedPath);
        if (classification.category === categoryItem.category) {
          const name = extractItemName(removedPath);
          const isInstalled = this.installedIds.has(
            `${categoryItem.source.url}#${removedPath}`
          );
          items.push({
            kind: 'item' as const,
            source: categoryItem.source,
            path: removedPath,
            name,
            tool: classification.tool,
            category: classification.category,
            installed: isInstalled,
            updateAvailable: false,
            isRemoved: true,
          });
        }
      }
    }
    ```
  - **Known pitfall**: The `classifyItem()` function is used elsewhere in the tree provider. Verify it accepts a raw path string and returns `{ category, tool }`. If it expects a different shape, adapt the call.
  - **Known pitfall**: Make sure the `installedIds` lookup for removed items uses the same ID format as regular items: `{sourceUrl}#{path}`.

### T14-02 - Render "removed upstream" markers in createFileTreeItem()

- **Description**: Extend `createFileTreeItem()` to handle `item.isRemoved`. This branch must distinguish between installed and not-installed removed items (FR-019, FR-020). The removed state has the lowest priority: `updateAvailable` > `installed` > `new` > `removed` > default.
- **Spec refs**: FR-018, FR-019, FR-020, Section 10.4 (Accessibility)
- **Parallel**: No (depends on T14-01 for the `isRemoved` flag)
- **Acceptance criteria**:
  - [ ] FR-018: Items with `isRemoved === true` and NOT installed display `description: 'removed upstream'` and `iconPath: new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'))`
  - [ ] FR-019: Items with `isRemoved === true` AND `installed === true` display `description: 'removed upstream - installed'` and `contextValue: 'catalogItem.removedInstalled'`
  - [ ] FR-020: Items with `isRemoved === true` AND NOT installed display `contextValue: 'catalogItem.removed'` -- no install action available
  - [ ] Priority order maintained: `updateAvailable` > `installed` (non-removed) > `isNew` > `isRemoved` > default
  - [ ] Removed + installed items get the warning icon (not the check icon), since the "removed" state is more important to surface
  - [ ] Section 10.4: `accessibilityInformation.label` includes `, removed upstream` when `isRemoved` is true
  - [ ] Removed items are NOT clickable (no command) since the upstream file no longer exists; set `collapsibleState: None` and no `command`
- **Test requirements**: unit (T14-05)
- **Depends on**: T14-01, WP13 T13-04 (for the priority chain)
- **Implementation Guidance**:
  - **File**: `src/providers/catalogTree.ts`, method `createFileTreeItem()`
  - **Add after the `isNew` branch** and before the default else:
    ```typescript
    } else if (item.isRemoved) {
      if (item.installed) {
        treeItem.contextValue = 'catalogItem.removedInstalled';
        treeItem.description = 'removed upstream - installed';
      } else {
        treeItem.contextValue = 'catalogItem.removed';
        treeItem.description = 'removed upstream';
      }
      treeItem.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
    } else {
    ```
  - **Accessibility**: Update the status variable:
    ```typescript
    const status = item.updateAvailable ? ', update available'
      : item.installed && !item.isRemoved ? ', installed'
      : item.isNew ? ', new'
      : item.isRemoved ? ', removed upstream'
      : '';
    ```
  - **Note on priority**: An item can be both `isRemoved` and `installed`. In this case, FR-019 says show "removed upstream - installed" (the removed branch handles it, not the installed branch). This means the `installed` branch in the if/else chain should NOT match removed-installed items. Add `&& !item.isRemoved` to the installed condition:
    ```typescript
    } else if (item.installed && !item.isRemoved) {
    ```
  - **Disable click**: For removed items, do NOT set `treeItem.command` (the default browse/preview command). The upstream file does not exist:
    ```typescript
    if (item.isRemoved && !item.installed) {
      treeItem.command = undefined;
    }
    ```
  - **Icon override**: Extend the condition from T13-04 to also exclude removed items:
    ```typescript
    if (!item.updateAvailable && !item.isNew && !item.isRemoved) {
      treeItem.iconPath = this.getToolIcon(item.tool);
    }
    ```

### T14-03 - Include removed count in TreeView badge tooltip

- **Description**: Update `updateTreeBadge()` in `extension.ts` to factor removed items into the badge. The spec says badge = newCount + removedCount + updateCount. Update the tooltip to mention removed items when present.
- **Spec refs**: FR-011, FR-012, FR-013, Section 4.12
- **Parallel**: Yes (can be done in parallel with T14-01/T14-02 since it modifies a different file)
- **Acceptance criteria**:
  - [ ] FR-011: Badge value includes removed count: `total = newCount + removedCount + updateCount`
  - [ ] FR-012: Badge tooltip includes removed count when present: e.g., "2 new, 1 removed, 3 updates"
  - [ ] FR-013: Badge hidden when all counts are 0
  - [ ] When only removed items exist: tooltip is "{N} removed item{s}"
  - [ ] Tooltip segments appear in order: new, removed, updates
- **Test requirements**: unit (T14-05)
- **Depends on**: WP13 T13-02 (updateTreeBadge function exists)
- **Implementation Guidance**:
  - **File**: `src/extension.ts`, function `updateTreeBadge()`
  - **Modify the badge calculation**:
    ```typescript
    const newCount = newContentDetector.getTotalNewCount();
    const removedCount = newContentDetector.getTotalRemovedCount();
    const total = newCount + removedCount + lastUpdateCount;

    if (total === 0) {
      treeView.badge = undefined;
      explorerTreeView.badge = undefined;
    } else {
      const parts: string[] = [];
      if (newCount > 0) parts.push(`${newCount} new`);
      if (removedCount > 0) parts.push(`${removedCount} removed`);
      if (lastUpdateCount > 0) parts.push(`${lastUpdateCount} update${lastUpdateCount > 1 ? 's' : ''}`);
      const tooltip = parts.join(', ');
      const badge = { value: total, tooltip };
      treeView.badge = badge;
      explorerTreeView.badge = badge;
    }
    vscode.commands.executeCommand('setContext', 'awesome-coding-assistants.hasNewContent', (newCount + removedCount) > 0);
    ```
  - **Note**: The `hasNewContent` context key should reflect both new AND removed items so the "Mark All as Seen" button shows for removed-only states too.

### T14-04 - Include removed items in auto-check notification message

- **Description**: Update the information message in the auto-check callback to mention removed items when detected.
- **Spec refs**: FR-007, Section 6 (Flow 1, step 9)
- **Parallel**: Yes (can be done in parallel with T14-01/T14-02)
- **Acceptance criteria**:
  - [ ] Notification message includes removed count: e.g., "3 new items, 1 removed, 2 updates available"
  - [ ] When only removed items exist: message says "N item{s} removed upstream."
  - [ ] When no changes at all: no notification shown (existing behavior)
- **Test requirements**: integration (T14-06)
- **Depends on**: WP13 T13-07 (auto-check integration)
- **Implementation Guidance**:
  - **File**: `src/extension.ts`, auto-check callback
  - **Modify the notification message construction** (after the WP13 changes):
    ```typescript
    let removedContentCount = 0;
    // ... inside the new-content detection loop:
    removedContentCount += result.removedPaths.length;

    // ... notification:
    const parts: string[] = [];
    if (newContentCount > 0) parts.push(`${newContentCount} new item${newContentCount > 1 ? 's' : ''}`);
    if (removedContentCount > 0) parts.push(`${removedContentCount} removed`);
    if (updateCount > 0) parts.push(`${updateCount} update${updateCount > 1 ? 's' : ''} available`);
    if (parts.length > 0) {
      vscode.window.showInformationMessage(parts.join(', ') + '.');
    }
    ```

### T14-05 - Unit tests for removed content rendering

- **Description**: Add unit tests in `test/suite/catalogTree.test.ts` for removed item rendering: synthetic item creation in `getFileNodes()`, marker rendering in `createFileTreeItem()`, installed vs. not-installed distinction, and badge tooltip with removed count.
- **Spec refs**: Section 11.1, US-06 Scenarios 1-3, BDD Scenarios (Removed items detected, Removed installed item)
- **Parallel**: No (depends on T14-01, T14-02, T14-03)
- **Acceptance criteria**:
  - [ ] Test: `getFileNodes()` merges synthetic removed items into the correct category
  - [ ] Test: `getFileNodes()` does NOT add removed items to wrong categories
  - [ ] Test: `createFileTreeItem()` with `isRemoved = true, installed = false` returns description "removed upstream", contextValue "catalogItem.removed", warning icon with `list.warningForeground` color
  - [ ] Test: `createFileTreeItem()` with `isRemoved = true, installed = true` returns description "removed upstream - installed", contextValue "catalogItem.removedInstalled"
  - [ ] Test: `createFileTreeItem()` with `isRemoved = true` sets accessibility label suffix ", removed upstream"
  - [ ] Test: removed not-installed items have no `command` (not clickable)
  - [ ] Test: badge tooltip with removed items: e.g., "2 new, 1 removed, 3 updates"
  - [ ] Test: badge tooltip with only removed items: "1 removed"
  - [ ] All existing tests continue to pass
- **Test requirements**: unit
- **Depends on**: T14-01, T14-02, T14-03
- **Implementation Guidance**:
  - **File**: `test/suite/catalogTree.test.ts`
  - **New describe block**: `describe('Removed content rendering (WP14)', () => { ... })`
  - **Mock setup**: Create a mock `NewContentDetector` with controlled `getRemovedItems()` return values. Inject via `setNewContentDetector()`.
  - **Pattern**: Follow the same test patterns established in T13-08.

### T14-06 - Integration tests for removed content flow

- **Description**: Add integration tests verifying the end-to-end flow: auto-check detects removed items, tree renders them, "Mark All as Seen" clears them.
- **Spec refs**: Section 11.3, Section 11.4, US-06 Scenarios, BDD Scenario (Removed items detected)
- **Parallel**: No (depends on T14-05)
- **Acceptance criteria**:
  - [ ] E2E test: FetchMocker returns tree V1 (with item), then tree V2 (without item), removed item appears in tree with correct marker
  - [ ] E2E test: "Mark All as Seen" clears removed items from tree
  - [ ] E2E test: removed installed item shows `contextValue` "catalogItem.removedInstalled"
  - [ ] All existing E2E tests continue to pass
- **Test requirements**: integration, E2E
- **Depends on**: T14-05
- **Implementation Guidance**:
  - **File**: `test/suite/e2e-browse-install.test.ts`
  - **New describe block**: `describe('Removed content detection (WP14)', ...)`
  - **Pattern**: Follow the E2E pattern established in T13-09. Use FetchMocker to return different tree JSON on sequential calls.

### T14-07 - Build and test verification

- **Description**: Run full lint, build, and test suite.
- **Spec refs**: General quality gate
- **Parallel**: No (final gate)
- **Acceptance criteria**:
  - [ ] `npm run lint` passes with zero errors
  - [ ] `npm run build` succeeds with zero errors
  - [ ] `npm test` passes with all tests green
- **Test requirements**: none
- **Depends on**: T14-01 through T14-06
- **Implementation Guidance**:
  - Run: `npm run lint && npm run build && npm test`

## Implementation Notes

- Removed items are "synthetic" -- they do not exist in the current tree response. They are constructed from paths stored in `newContent:removed:{sourceUrl}` globalState.
- The `classifyItem()` function is used to derive category and tool from a raw path, which determines which category the removed item appears under. This is the same function used for regular items.
- The `extractItemName()` function derives a human-readable name from the path (e.g., `agents/code-review.agent.md` becomes "Code Review").
- Removed items that are installed locally get a special `contextValue` so the context menu can show an "Uninstall" action. The file still exists locally even though the upstream source no longer has it.
- Removed items that are NOT installed have no actionable command -- clicking them does nothing since the upstream file is gone. The item serves as an informational marker only.
- The "Mark All as Seen" command (implemented in WP13) already clears `newContent:removed:*` keys. No additional command logic needed in WP14.

## Parallel Opportunities

- T14-03 (badge tooltip) and T14-04 (notification message) can be done concurrently with T14-01/T14-02 since they modify different files.
- T14-05 depends on T14-01, T14-02, and T14-03.

## Risks & Mitigations

- **Risk**: `classifyItem()` might not correctly classify paths from removed items if the path format has changed between versions.
  - **Mitigation**: Removed paths come from the same repo tree that was originally classified. Path format does not change -- only the tree contents change.
- **Risk**: Synthetic removed items could duplicate regular items if a path was removed and re-added in the same cycle.
  - **Mitigation**: FR-010 states the baseline is updated after diff. If a path is re-added, it will not be in the removed list on the next check. For the same cycle, the `checkForNewContent()` logic produces `removedPaths` as `baselinePaths - currentPaths`, so a re-added item is NOT in the removed list.
- **Risk**: The `installed` check for removed items might not work if the installedIds format differs.
  - **Mitigation**: Use the exact same ID format: `${sourceUrl}#${path}`. This matches existing code in `getFileNodes()`.


## Activity Log

- 2026-03-17T00:00:00Z - planner - lane=planned - Work package created
- 2026-03-18T00:35:00Z - coder - lane=doing - Starting implementation
- 2026-03-18T01:00:00Z - coder - lane=doing - T14-01 and T14-02 implemented (merge removed items, render markers)
- 2026-03-18T01:30:00Z - coder - lane=doing - T14-03 badge tooltip, T14-04 notification, T14-05 unit tests, T14-06 integration tests, T14-07 build/test verified (419 passing)
- 2026-03-18T01:45:00Z - coder - lane=for_review - All tasks complete, submitted for review
- 2026-03-18T01:55:00Z - reviewer - lane=done - Review complete, PASS. All tasks and tests verified

## Review

---
lane: done
---

### Review Verdict: PASS

#### Summary
All WP14 requirements are fully met:
- **T14-01**: Removed items are merged as synthetic entries in `getFileNodes()` for the correct category only, with correct fields and sort order.
- **T14-02**: `createFileTreeItem()` renders removed items with the correct contextValue, description, icon, and accessibility label. Installed/removed distinction is correct. Priority order is respected.
- **T14-03**: Badge tooltip and value include removed count, with correct segment order and context key logic.
- **T14-04**: Auto-check notification message includes removed count, with correct pluralization and segment order.
- **T14-05**: Unit tests cover all acceptance criteria for removed content, including category merging, rendering, accessibility, and badge logic.
- **T14-06**: Integration tests verify end-to-end removed content flow, including markAllSeen and contextValue for installed removed items.
- **T14-07**: Lint, build, and all 419 tests pass. No new lint errors. No unrelated changes.

#### Code Quality
- Code is clear, well-structured, and follows project conventions.
- No scope creep or over-engineering.
- All acceptance criteria and spec references are satisfied.

#### Reviewer Activity Log
- 2026-03-18T01:55:00Z - reviewer - lane=done - Review complete, PASS. All tasks and tests verified.

## Self-Review

### Spec Compliance
- [x] FR-009: Removed items merged into getFileNodes() for correct category
- [x] FR-018: Removed not-installed items show "removed upstream" + warning icon
- [x] FR-019: Removed installed items show "removed upstream - installed" + contextValue removedInstalled
- [x] FR-020: Removed not-installed items contextValue "catalogItem.removed"
- [x] FR-011: Badge value includes removed count
- [x] FR-012: Badge tooltip segments: "N new, N removed, N updates"
- [x] FR-013: Badge hidden when all counts are 0
- [x] FR-007/Section 6: Notification message includes removed count
- [x] Section 10.4: Accessibility label includes ", removed upstream"
- [x] Priority order: updateAvailable > installed (non-removed) > isNew > isRemoved > default

### Correctness
- [x] All 419 tests pass
- [x] Build succeeds
- [x] Lint has zero new errors (pre-existing warnings only)

### Scope Discipline
- [x] No unrelated changes
- [x] No over-engineering
