# New Content Notifications - Specification

> **Source brief**: `.sdd/ideas/002-new-content-notifications.md`
> **Feature branch**: `002-new-content-notifications`
> **Status**: Validated
> **Version**: 1.0

---

## 1. Overview

This feature adds new-content detection and unified badge notifications to the Awesome Coding Assistants VS Code extension. When items (agents, skills, prompts, instructions, hooks, modes, rules, commands) are added to or removed from upstream source repositories, the extension SHALL detect these changes via tree snapshot diffing and surface them through the VS Code `TreeView.badge` API, per-item "new" markers, and per-item "removed" markers. The feature also fixes an existing bug where the `$(cloud-download)` codicon renders as literal text in update badge descriptions.

---

## 2. Goals & Success Criteria

- **SC-001**: New items added upstream appear with a "new" marker in the tree within one auto-check cycle (default 60 min) without user action.
- **SC-002**: Items removed upstream appear with a "removed" marker in the tree within one auto-check cycle.
- **SC-003**: The TreeView title badge displays a combined count (new items + items with updates) that is always accurate and in sync with tree contents.
- **SC-004**: The `$(cloud-download)` literal text bug in update badge descriptions is eliminated - description shows plain text "update available" alongside the cloud-download ThemeIcon.
- **SC-005**: Zero additional GitHub API calls per check cycle beyond what the existing tree fetch (with ETag caching) already performs.
- **SC-006**: "New" markers auto-dismiss when the user expands the parent category node.
- **SC-007**: Users can bulk-dismiss all "new" markers via a dedicated command.

---

## 3. Users & Roles

- **Extension User**: Any VS Code user with the extension installed. Can browse the catalog, install items, expand categories, dismiss new markers. No role-based access control; all features available to all users.
- **Source Maintainer**: (External actor) Adds, modifies, or removes items in upstream repositories. Not a direct user of the extension; their actions trigger detection.

---

## 4. Functional Requirements

### 4.1 New Content Detection

- **FR-001**: System SHALL store a baseline set of classified file paths per source URL in extension `globalState` under key `newContent:seen:{sourceUrl}`. The stored value SHALL be a JSON-serialized array of strings (file paths from `GitHubTreeResponse.tree`).
- **FR-002**: On each auto-check cycle (piggybacking on the existing `checkForUpdates()` timer), the system SHALL compare the current `getRepoTree()` result against the stored baseline for each source.
- **FR-003**: Paths present in the current tree but absent from the stored baseline SHALL be classified as "new" items.
- **FR-004**: On first activation (no stored baseline exists for a source), the system SHALL treat the entire current tree as the baseline - no items marked as "new". This prevents a flood of false positives.
- **FR-005**: On detection of new items, the system SHALL store the new items' paths in `globalState` under key `newContent:new:{sourceUrl}` as a JSON-serialized array of strings.
- **FR-006**: After computing new items, the system SHALL update the stored baseline to the current tree snapshot (union of old baseline + current tree), so that the same items are not flagged as "new" again on the next cycle.

### 4.2 Removed Content Detection

- **FR-007**: Paths present in the stored baseline but absent from the current tree SHALL be classified as "removed" items.
- **FR-008**: On detection of removed items, the system SHALL store the removed items' paths in `globalState` under key `newContent:removed:{sourceUrl}` as a JSON-serialized array of strings.
- **FR-009**: Removed items SHALL remain in the tree with a "removed upstream" marker until the user performs a "dismiss" action or the next full refresh cycle. Implementation: `getFileNodes()` SHALL merge the current tree entries with any paths from `newContent:removed:{sourceUrl}` that belong to the same category. For each removed path, a synthetic `CatalogFileItem` SHALL be constructed with `isRemoved: true`, using `classifyItem()` to derive category and tool from the path, and `extractItemName()` for the display name.
- **FR-010**: After computing removed items, the stored baseline SHALL be updated to the current tree paths (removing paths that no longer exist), so that already-dismissed removed items do not reappear. However, the `newContent:removed:{sourceUrl}` list retains the removed paths until the user dismisses them (FR-022) or the next auto-check cycle runs and they are no longer in the removed list.

### 4.3 Tree Badge (TreeView.badge API)

- **FR-011**: The system SHALL set `TreeView.badge` on both `awesomeCodingAssistants.catalog` and `awesomeCodingAssistants.explorerCatalog` tree views to show a combined count of: (number of new items) + (number of items with updates available).
- **FR-012**: The badge `tooltip` SHALL read `"{N} new, {M} updates"` when both new items and updates exist, `"{N} new items"` when only new items exist, or `"{M} updates available"` when only updates exist.
- **FR-013**: When the combined count is zero, the system SHALL set `TreeView.badge` to `undefined` to hide the badge entirely.
- **FR-014**: The badge count SHALL be recalculated and updated after every operation that changes new-item or update state: auto-check completion, manual "Check for Updates", category expand (marks items as seen), "Mark All as Seen" command, install, update, uninstall.

### 4.4 Per-Item "New" Markers

- **FR-015**: Tree items classified as "new" SHALL display with `description: "new"` and `iconPath: new vscode.ThemeIcon('sparkle')`.
- **FR-016**: The "new" marker SHALL take lower priority than "update available" and "installed" states. Priority order for `contextValue` and visual treatment: `updateAvailable` > `installed` > `new` > default.
- **FR-017**: The "new" `contextValue` SHALL be `'catalogItem.new'` to allow future menu contributions if needed.

### 4.5 Per-Item "Removed" Markers

- **FR-018**: Tree items classified as "removed upstream" SHALL display with `description: "removed upstream"` and `iconPath: new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'))`.
- **FR-019**: If a removed item was installed locally, the system SHALL show `description: "removed upstream - installed"` and `contextValue: 'catalogItem.removedInstalled'` so the user can still uninstall.
- **FR-020**: If a removed item was NOT installed locally, the `contextValue` SHALL be `'catalogItem.removed'` -- no install action available since the upstream file no longer exists.

### 4.6 "Seen" State Management

- **FR-021**: When the user expands a category node in the tree (triggers `getChildren(categoryItem)`), ALL "new" items in that category SHALL be marked as "seen" by removing their paths from `newContent:new:{sourceUrl}`.
- **FR-022**: A new command `awesome-coding-assistants.markAllSeen` ("Mark All as Seen") SHALL clear all `newContent:new:{sourceUrl}` keys for all sources, and clear all `newContent:removed:{sourceUrl}` keys. This is a bulk dismiss.
- **FR-023**: After marking items as seen (by expansion or command), the TreeView badge SHALL be immediately recalculated (FR-014).

### 4.7 Update Badge Visibility Fix

- **FR-024**: The `createFileTreeItem()` method SHALL NOT use codicon syntax `$(icon-name)` in the `description` field. The TreeItem `description` property renders codicons as literal text.
  - **Before** (bug): `treeItem.description = '$(cloud-download) update available'`
  - **After** (fix): `treeItem.description = 'update available'`
- **FR-025**: The update visual indicator SHALL rely solely on `treeItem.iconPath = new vscode.ThemeIcon('cloud-download')` which correctly renders the codicon as an icon.

### 4.8 Installed Cache Race Condition Fix

- **FR-026**: The `refreshInstalledCache()` method SHALL NOT clear `installedIds` before the async manifest read completes. Instead, it SHALL build a new `Set<string>` and then atomically swap it into `this.installedIds` once all manifests have been read. This eliminates the window where `installedIds` is empty during async loading.
- **FR-027**: The `_onDidChangeTreeData.fire(undefined)` call in `refreshInstalledCache()` SHALL fire only after the atomic swap, not before.

### 4.9 Configuration

- **FR-028**: No new configuration settings are required. The feature piggybacks on existing `autoCheckUpdates` and `autoCheckIntervalMinutes` settings.
- **FR-029**: A new hidden configuration setting `awesome-coding-assistants.newContentDetection` (boolean, default: `true`) SHALL control whether new/removed content detection runs. When `false`, only update detection runs (current behavior). This provides a kill switch.

### Implementation Contracts

#### 4.10 NewContentDetector Service Contract

```
Class: NewContentDetector

Constructor:
  Parameters:
    - globalState: vscode.Memento
    - log: vscode.LogOutputChannel

Method: checkForNewContent(sourceUrl: string, currentTree: GitHubTreeEntry[])
  Parameters:
    - sourceUrl: string - the source URL used as storage key
    - currentTree: GitHubTreeEntry[] - current tree from getRepoTree()
  Returns: NewContentResult
  Behavior:
    1. Load baseline from globalState key "newContent:seen:{sourceUrl}"
    2. If no baseline: store current tree paths as baseline, return empty result
    3. Classify current tree paths, compute diff against baseline
    4. New paths = currentPaths - baselinePaths (only blob entries)
    5. Removed paths = baselinePaths - currentPaths
    6. Store new paths under "newContent:new:{sourceUrl}"
    7. Store removed paths under "newContent:removed:{sourceUrl}"
    8. Update baseline to current tree paths
    9. Return { newPaths: string[], removedPaths: string[], sourceUrl: string }
  Errors:
    - If globalState read fails: log warning, treat as no baseline (FR-004)
    - If globalState write fails: log error, return computed result anyway

Method: getNewItems(sourceUrl: string)
  Returns: string[] - paths flagged as new for the given source
  Behavior: Read "newContent:new:{sourceUrl}" from globalState, return parsed array or []

Method: getRemovedItems(sourceUrl: string)
  Returns: string[] - paths flagged as removed for the given source
  Behavior: Read "newContent:removed:{sourceUrl}" from globalState, return parsed array or []

Method: markCategorySeen(sourceUrl: string, categoryPaths: string[])
  Parameters:
    - sourceUrl: string
    - categoryPaths: string[] - paths of items in the expanded category
  Returns: void
  Behavior:
    1. Load "newContent:new:{sourceUrl}"
    2. Remove all categoryPaths from the set
    3. Write updated set back to globalState

Method: markAllSeen()
  Returns: void
  Behavior:
    1. Enumerate all globalState keys matching "newContent:new:*"
    2. Set each to undefined (delete)
    3. Enumerate all globalState keys matching "newContent:removed:*"
    4. Set each to undefined (delete)

Method: getTotalNewCount()
  Returns: number
  Behavior: Sum lengths of all "newContent:new:{sourceUrl}" arrays across all sources

Method: getTotalRemovedCount()
  Returns: number
  Behavior: Sum lengths of all "newContent:removed:{sourceUrl}" arrays across all sources
```

#### 4.11 NewContentResult Interface

```
Interface: NewContentResult
  Fields:
    - newPaths: string[] - paths that are new since last check
    - removedPaths: string[] - paths that were removed since last check
    - sourceUrl: string - the source these changes belong to
```

#### 4.12 TreeView Badge Update Contract

```
Function: updateTreeBadge(
  treeView: vscode.TreeView<TreeElement>,
  newCount: number,
  updateCount: number
)
  Behavior:
    - total = newCount + updateCount
    - If total === 0: treeView.badge = undefined
    - If newCount > 0 AND updateCount > 0:
        treeView.badge = { value: total, tooltip: `${newCount} new, ${updateCount} updates` }
    - If newCount > 0 AND updateCount === 0:
        treeView.badge = { value: newCount, tooltip: `${newCount} new item${newCount > 1 ? 's' : ''}` }
    - If newCount === 0 AND updateCount > 0:
        treeView.badge = { value: updateCount, tooltip: `${updateCount} update${updateCount > 1 ? 's' : ''} available` }
```

---

## 5. User Stories

### US-01 - See new items in catalog (Priority: P1) MVP

**As a** extension user, **I want** to see which items in the catalog are new since my last visit, **so that** I can discover new agents, skills, and prompts without manually scanning every category.

**Why P1**: Core value proposition - without this, the entire feature has no purpose.

**Independent Test**: Add a new file to a test source repo tree fixture. Run the new-content check. Verify the item shows with a "new" marker in the tree.

**Acceptance Scenarios**:
1. **Given** a source with a stored baseline of 10 items, **When** the auto-check detects 12 items in the current tree, **Then** 2 items appear with "new" description and sparkle icon.
2. **Given** no stored baseline exists (fresh install), **When** the first auto-check runs, **Then** no items are marked as "new" (baseline is established silently).
3. **Given** 3 items are marked as "new", **When** the user expands the category containing those items, **Then** the "new" markers are cleared and the items render normally.

---

### US-02 - TreeView badge shows combined count (Priority: P1) MVP

**As a** extension user, **I want** to see a badge on the tree view title showing how many new items and updates are available, **so that** I know at a glance whether there is anything to review.

**Why P1**: The badge is the primary notification mechanism - without it, users must expand the tree to discover changes.

**Independent Test**: Set up mock state with 2 new items and 1 update. Verify the TreeView badge shows "3" with tooltip "2 new, 1 updates".

**Acceptance Scenarios**:
1. **Given** 2 new items and 3 updates detected, **When** the tree renders, **Then** the TreeView badge shows "5" with tooltip "2 new, 3 updates".
2. **Given** 0 new items and 0 updates, **When** the tree renders, **Then** the TreeView badge is hidden (undefined).
3. **Given** 5 new items and 0 updates, **When** the tree renders, **Then** the TreeView badge shows "5" with tooltip "5 new items".

---

### US-03 - Mark All as Seen command (Priority: P1) MVP

**As a** extension user, **I want** to dismiss all "new" and "removed" markers at once, **so that** I can reset the state after I have reviewed the catalog.

**Why P1**: Without bulk dismiss, users with many sources would need to expand every category to clear markers.

**Independent Test**: Set up 5 new items across 2 sources. Run the "Mark All as Seen" command. Verify all "new" markers are gone and the badge is recalculated.

**Acceptance Scenarios**:
1. **Given** 3 new items in source A and 2 new items in source B, **When** user runs "Mark All as Seen", **Then** all "new" markers disappear and the badge updates to show only pending updates (if any).
2. **Given** 1 removed item in source A, **When** user runs "Mark All as Seen", **Then** the removed item disappears from the tree and the badge updates.

---

### US-04 - Fix update badge showing literal $(cloud-download) text (Priority: P1) Bug Fix

**As a** extension user, **I want** update badges to show the cloud-download icon correctly, **so that** I see a visual icon instead of the literal string "$(cloud-download) update available".

**Why P1**: This is a live bug affecting all users with installed items that have updates.

**Independent Test**: Create a tree item with `updateAvailable = true`. Verify `description` is `"update available"` (no codicon syntax) and `iconPath` is `ThemeIcon('cloud-download')`.

**Acceptance Scenarios**:
1. **Given** an installed item has an update available, **When** the tree renders, **Then** the item description shows "update available" (plain text) with a cloud-download icon from `iconPath`.
2. **Given** an installed item has no update, **When** the tree renders, **Then** no cloud-download text or icon appears in the description.

---

### US-05 - Fix installed cache race condition (Priority: P1) Bug Fix

**As a** extension user, **I want** installed and update badges to appear reliably on first render, **so that** I do not see incorrect states (items briefly appearing as not installed).

**Why P1**: The race condition causes intermittent badge disappearance visible to users.

**Independent Test**: Call `refresh()`, immediately call `getFileNodes()`, verify `installedIds` is populated (not empty).

**Acceptance Scenarios**:
1. **Given** items are installed and `refresh()` is called, **When** the tree re-renders during the async cache refresh, **Then** `installedIds` is never observed as empty mid-refresh (stale data is served until new data is ready).
2. **Given** `refresh()` completes and the installed cache is repopulated, **When** `_onDidChangeTreeData` fires, **Then** items show correct installed/update status.

---

### US-06 - See removed items in catalog (Priority: P2)

**As a** extension user, **I want** to see which items have been removed from upstream sources, **so that** I know when customizations I have installed or considered are no longer maintained.

**Why P2**: Valuable but less critical than new-item detection. Affects fewer users.

**Independent Test**: Remove a file from a test source tree fixture. Run the new-content check. Verify the item shows with a "removed upstream" marker.

**Acceptance Scenarios**:
1. **Given** a source baseline contains `agents/code-review.agent.md`, **When** the next check finds that path missing from the tree, **Then** the item appears with "removed upstream" description and warning icon.
2. **Given** a removed item was installed locally, **When** the tree renders, **Then** the item shows "removed upstream - installed" and the uninstall action is available.
3. **Given** a removed item was NOT installed locally, **When** user runs "Mark All as Seen", **Then** the item disappears from the tree entirely.

---

### US-07 - Disable new content detection (Priority: P3)

**As a** extension user, **I want** to disable new content detection without disabling update checks, **so that** I can reduce noise if I only care about updates to installed items.

**Why P3**: Niche use case for power users who find new-content markers distracting.

**Independent Test**: Set `newContentDetection` to `false`. Run auto-check. Verify no new or removed items are detected, but update checks still run.

**Acceptance Scenarios**:
1. **Given** `newContentDetection` is `false`, **When** auto-check runs, **Then** only `checkForUpdates()` executes; no snapshot diffing occurs; no "new" or "removed" markers appear.
2. **Given** `newContentDetection` is `false`, **When** user enables it later, **Then** the current tree becomes the baseline on next check (no false positives).

---

### Edge Cases

- **Source added to master index**: A brand-new source has no baseline. FR-004 applies - first tree becomes baseline.
- **Source removed from master index**: Source disappears from `getSources()`. Its `newContent:*` keys remain in globalState as orphans. Orphan cleanup runs on "Mark All as Seen" or manual cache clear.
- **Truncated tree**: GitHub API may set `truncated: true` on very large repos. If truncated, the system SHALL log a warning and skip new-content detection for that source to avoid false positives.
- **Network failure**: If `getRepoTree()` fails (returns cached/stale data via ETag), the snapshot diff uses the stale data. No false positives since stale data matches the baseline.
- **Same path, different file**: If a file is deleted and a new file is created at the same path in the same interval, the diff sees no change. This is acceptable behavior - the SHA change would be caught by update detection if installed.

---

## 6. User Flows

### Flow 1: Auto-Check Detects New Items

1. Extension activation starts the 5-second initial delay timer.
2. Timer fires: `checkForUpdates()` runs (existing behavior).
3. Immediately after `checkForUpdates()`, `checkForNewContent()` runs for each source.
4. For each source, `getRepoTree()` result (already cached from step 2 or tree fetch) is diffed against stored baseline.
5. New and removed paths are computed and stored in globalState.
6. `catalogTreeProvider.refresh()` is called.
7. `updateTreeBadge()` recalculates: newCount from `NewContentDetector.getTotalNewCount()`, updateCount from update results.
8. Badge updates on both tree views.
9. If new count > 0 OR update count > 0: `vscode.window.showInformationMessage()` with combined summary.
10. Tree renders with "new" and "removed" markers on affected items.

### Flow 2: User Expands Category with New Items

1. User clicks to expand a category node.
2. `getChildren(categoryItem)` calls `getFileNodes(categoryItem)`.
3. `getFileNodes()` resolves items, checks `newContentDetector.getNewItems(source.url)` to set `isNew` flag.
4. Before returning items, calls `newContentDetector.markCategorySeen(source.url, categoryPaths)`.
5. Items render with normal styling (no "new" marker - they were just marked seen).
6. `updateTreeBadge()` recalculates and updates badge.

**Alternate**: If category was already expanded and tree re-renders (e.g., from auto-check), step 4 still runs - idempotent.

### Flow 3: User Runs "Mark All as Seen"

1. User invokes command `awesome-coding-assistants.markAllSeen`.
2. Command calls `newContentDetector.markAllSeen()`.
3. All `newContent:new:*` and `newContent:removed:*` keys cleared from globalState.
4. `catalogTreeProvider.refresh()` fires.
5. `updateTreeBadge()` recalculates (new count is now 0).
6. Tree re-renders without any "new" or "removed" markers.

### Flow 4: New-Content Detection Disabled

1. User sets `awesome-coding-assistants.newContentDetection` to `false`.
2. On next auto-check cycle, `checkForNewContent()` is skipped.
3. `updateTreeBadge()` only factors in update count (new count is 0).
4. Tree renders without any "new" or "removed" markers.
5. Existing `newContent:*` keys remain in globalState but are not read or displayed.

---

## 7. Data Model

### 7.1 NewContentResult (new interface)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| newPaths | string[] | yes | Paths in current tree absent from baseline |
| removedPaths | string[] | yes | Paths in baseline absent from current tree |
| sourceUrl | string | yes | Source this result belongs to |

### 7.2 GlobalState Keys (new entries)

| Key Pattern | Value Type | Description |
|-------------|------------|-------------|
| `newContent:seen:{sourceUrl}` | string (JSON array of strings) | Baseline snapshot - all known paths for this source |
| `newContent:new:{sourceUrl}` | string (JSON array of strings) | Paths flagged as new since last baseline |
| `newContent:removed:{sourceUrl}` | string (JSON array of strings) | Paths flagged as removed since last baseline |

**Validation rules**:
- `sourceUrl` is the raw `SourceConfig.url` string - no normalization applied (matches existing pattern used in `installedIds`).
- Arrays contain only blob-type paths (no tree/directory entries).
- Maximum expected size: ~500 paths per source (typical repo), ~5 KB per key.
- Empty arrays are stored as `"[]"` rather than deleting the key, to distinguish "checked but nothing new" from "never checked".

### 7.3 CatalogFileItem Extension (modified interface)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| isNew | boolean | no | false | Set when path is in `newContent:new:{sourceUrl}` |
| isRemoved | boolean | no | false | Set when path is in `newContent:removed:{sourceUrl}` |

These fields extend the existing `CatalogFileItem` interface. They do NOT affect `contextValue` if `updateAvailable` or `installed` takes priority (FR-016).

### 7.4 Existing Interface Changes

**CatalogFileItem** - add optional fields:
```
  isNew?: boolean;       // true when item path is in newContent:new list
  isRemoved?: boolean;   // true when item path is in newContent:removed list
```

No other data model changes required.

---

## 8. API / Interface Design

### 8.1 New Command: Mark All as Seen

- **Command ID**: `awesome-coding-assistants.markAllSeen`
- **Title**: "Mark All as Seen"
- **Category**: "Awesome Coding Assistants"
- **Icon**: `$(check-all)`
- **Menu location**: `view/title` for both tree views, shown when `awesome-coding-assistants.hasNewContent` context key is true
- **Behavior**: Calls `newContentDetector.markAllSeen()`, then `catalogTreeProvider.refresh()`, then `updateTreeBadge()`
- **Errors**: None expected - globalState operations are fire-and-forget with logging

### 8.2 New Context Key

- **Key**: `awesome-coding-assistants.hasNewContent`
- **Type**: boolean
- **Set when**: `getTotalNewCount() + getTotalRemovedCount() > 0`
- **Cleared when**: count drops to 0 after mark-seen or auto-check
- **Purpose**: Controls visibility of "Mark All as Seen" button in view/title

### 8.3 Modified createFileTreeItem() (Bug Fix)

**Before**:
```
if (item.updateAvailable) {
  treeItem.description = '$(cloud-download) update available';
  treeItem.iconPath = new vscode.ThemeIcon('cloud-download');
}
```

**After**:
```
if (item.updateAvailable) {
  treeItem.description = 'update available';
  treeItem.iconPath = new vscode.ThemeIcon('cloud-download');
}
```

### 8.4 Modified refreshInstalledCache() (Race Fix)

**Before**:
```
refreshInstalledCache(): void {
  this.installedIds.clear();
  Promise.all(folders.map(async (f) => {
    const m = await this.manifestMgr!.readManifest(f);
    for (const entry of m.installations) {
      this.installedIds.add(entry.id);
    }
  })).then(() => {
    this._onDidChangeTreeData.fire(undefined);
  });
}
```

**After**:
```
refreshInstalledCache(): void {
  const newIds = new Set<string>();
  Promise.all(folders.map(async (f) => {
    const m = await this.manifestMgr!.readManifest(f);
    for (const entry of m.installations) {
      newIds.add(entry.id);
    }
  })).then(() => {
    this.installedIds = newIds;  // atomic swap
    this._onDidChangeTreeData.fire(undefined);
  });
}
```

### 8.5 Package.json Additions

**New command**:
```json
{
  "command": "awesome-coding-assistants.markAllSeen",
  "title": "Mark All as Seen",
  "category": "Awesome Coding Assistants",
  "icon": "$(check-all)"
}
```

**New menu entry** (view/title):
```json
{
  "command": "awesome-coding-assistants.markAllSeen",
  "when": "view =~ /^awesomeCodingAssistants\\.(catalog|explorerCatalog)$/ && awesome-coding-assistants.hasNewContent",
  "group": "navigation"
}
```

**New configuration**:
```json
"awesome-coding-assistants.newContentDetection": {
  "type": "boolean",
  "default": true,
  "description": "Detect new and removed items in source repositories. Disable to only check for updates to installed items."
}
```

---

## 9. Architecture

### 9.1 System Design

The new-content detection is a thin layer added alongside the existing update detection. Both operate during the same auto-check cycle.

```
Auto-Check Timer
    |
    +--> LifecycleManager.checkForUpdates()    [existing - SHA comparison]
    |       |
    |       +--> Updates updateResults map
    |
    +--> NewContentDetector.checkForNewContent()  [NEW - tree snapshot diff]
    |       |
    |       +--> Uses same getRepoTree() result (cached)
    |       +--> Diffs against globalState baseline
    |       +--> Updates globalState new/removed lists
    |
    +--> CatalogTreeProvider.refresh()
    |       |
    |       +--> getFileNodes() reads new/removed state
    |       +--> createFileTreeItem() applies visual markers
    |
    +--> updateTreeBadge()
            |
            +--> Sets TreeView.badge on both views
```

### 9.2 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| State persistence | `vscode.ExtensionContext.globalState` (Memento) | Already used for cache; survives restarts; not workspace-scoped (new content is repo-level) |
| Tree badge | `vscode.TreeView.badge` API | Native VS Code API since 1.59; non-intrusive persistent indicator |
| Icon rendering | `vscode.ThemeIcon` | Standard codicon icons; `'sparkle'` for new, `'warning'` for removed, `'cloud-download'` for updates |
| Timer | Existing `setInterval` in extension.ts | No new timers; piggybacks on auto-check cycle |

### 9.3 Directory & Module Structure

```
src/
  services/
    newContentDetector.ts    [NEW] - Snapshot diffing and seen-state management
  providers/
    catalogTree.ts           [MODIFIED] - Badge rendering, new/removed markers, race fix
  extension.ts               [MODIFIED] - Wire NewContentDetector, badge updates, new command
  models/
    types.ts                 [MODIFIED] - NewContentResult, CatalogFileItem extensions
```

### 9.4 Key Design Decisions

**Decision 1: Tree Snapshot Diffing over Commit-Based Detection**
- **Rationale**: Zero additional API calls; uses the same `getRepoTree()` response already fetched for tree rendering. ETag caching means no network cost when tree is unchanged.
- **Alternatives considered**: Commit timestamp comparison (requires extra API call per source, complex commit parsing); Index-level metadata (requires source maintainer cooperation).
- **Consequences**: Cannot detect file modifications (only additions/removals). Modifications are handled by the existing SHA-based update detection for installed items.

**Decision 2: globalState over CacheManager for Baseline Storage**
- **Rationale**: The CacheManager uses expiration-based caching (default 24h). Baselines must persist indefinitely (users may not open VS Code daily). Direct globalState avoids key collisions with the HTTP cache prefix `cache:`.
- **Alternatives considered**: Extending CacheManager with non-expiring keys (adds complexity to cache invalidation logic); File-based storage (VS Code extension storage API is simpler and atomic).
- **Consequences**: globalState keys accumulate for removed sources. Cleaned up via "Mark All as Seen" or "Clear Cache" command.

**Decision 3: Combined Badge Count (New + Updates)**
- **Rationale**: VS Code's TreeView.badge API supports only a single numeric value. Combining gives users one glanceable number. The tooltip provides the breakdown.
- **Alternatives considered**: Two separate badges (not possible with the API); Badge for new only (misses updates, which are more actionable).
- **Consequences**: Users must read the tooltip to distinguish new items from updates.

**Decision 4: Atomic Swap for installedIds**
- **Rationale**: The current `clear()` then async `add()` pattern leaves a window where the set is empty, causing items to render without installed/update badges. An atomic swap ensures the set is always either fully old or fully new.
- **Alternatives considered**: Making `refreshInstalledCache()` synchronous (not possible - manifest reads are async); Using a loading state (adds complexity for a simple fix).
- **Consequences**: Stale installed state is briefly shown during refresh (better than empty state).

### 9.5 External Integrations

No new external integrations. The feature operates entirely on data already fetched by `GitHubClient.getRepoTree()`.

| Integration | Change |
|-------------|--------|
| GitHub API (getRepoTree) | No change - same API calls, same ETag caching |
| globalState (Memento) | New keys added (`newContent:seen:*`, `newContent:new:*`, `newContent:removed:*`) |

---

## 10. Non-Functional Requirements

### 10.1 Performance

- **NFR-001**: `checkForNewContent()` SHALL complete in under 10ms per source for trees of up to 1000 entries (set operations on string arrays).
- **NFR-002**: globalState read/write for baseline snapshots SHALL not exceed 5ms per operation (VS Code Memento is backed by in-memory map with async persistence).
- **NFR-003**: `updateTreeBadge()` SHALL not cause visible UI flicker - badge update is a single property assignment, no tree refresh needed.
- **NFR-004**: Total additional memory overhead per source SHALL not exceed 50 KB (500 paths x ~100 bytes/path for baseline storage in memory).

### 10.2 Security

- No new external API calls - no change to SSRF surface.
- globalState keys contain source URLs. These URLs are already validated by the existing `parseGitHubUrl()` and `isAllowedDomain()` checks in GitHubClient. No additional validation needed for storage keys.
- No user credentials or tokens stored in the new globalState keys - only file path strings.
- OWASP relevance: No injection vectors (data is not rendered in HTML/webview). No authentication changes. No new network requests.

### 10.3 Scalability & Availability

- Designed for up to 20 sources with up to 1000 items each (typical usage pattern).
- globalState storage limit (VS Code): Approximately 50 MB total. Expected usage: ~100 KB for 20 sources. No concern.
- N/A for availability - extension runs locally.

### 10.4 Accessibility

- "New" marker uses `accessibilityInformation.label` including ", new" suffix for screen readers.
- "Removed" marker uses `accessibilityInformation.label` including ", removed upstream" suffix.
- TreeView badge tooltip provides screen-reader-accessible summary of counts.
- Icon-only indicators always paired with `description` text for non-visual access.

### 10.5 Observability

- **Logging**:
  - `info`: "New content detected: {N} new items, {M} removed items in {source}" (once per check cycle per source, only if changes found)
  - `info`: "Baseline established for {source}: {count} items" (first check only)
  - `debug`: "Mark seen: {count} items in {source}/{category}" (on category expand)
  - `debug`: "Mark all seen: cleared {count} sources" (on bulk dismiss)
  - `warn`: "Truncated tree for {source}, skipping new-content detection"
  - `warn`: "New content check failed for {source}: {error}"
- **No metrics or alerting**: Extension runs locally; VS Code extension telemetry is opt-in and not used by this extension.

---

## 11. Test Requirements

### 11.1 Unit Tests

**Module: NewContentDetector** (new file: `test/suite/newContentDetector.test.ts`)
- Minimum coverage: 90% line, 85% branch
- Test cases:
  - `checkForNewContent()` with no prior baseline - establishes baseline, returns empty result
  - `checkForNewContent()` with 2 new paths - returns correct newPaths
  - `checkForNewContent()` with 1 removed path - returns correct removedPaths
  - `checkForNewContent()` with mixed new and removed - correct computation
  - `checkForNewContent()` ignores tree-type entries (directories)
  - `getNewItems()` returns stored new paths
  - `getRemovedItems()` returns stored removed paths
  - `markCategorySeen()` removes specified paths from new list
  - `markCategorySeen()` is idempotent (no error if paths already absent)
  - `markAllSeen()` clears all new and removed keys
  - `getTotalNewCount()` sums across sources
  - globalState read failure returns empty arrays (error resilience)

**Module: catalogTree.ts** (extend `test/suite/catalogTree.test.ts`)
- `createFileTreeItem()` with `updateAvailable = true`: description is "update available" (no codicon), iconPath is ThemeIcon('cloud-download')
- `createFileTreeItem()` with `isNew = true`: description is "new", iconPath is ThemeIcon('sparkle')
- `createFileTreeItem()` with `isRemoved = true`: description is "removed upstream", iconPath includes warning theme color
- Priority: `updateAvailable` overrides `isNew`; `installed` overrides `isNew`; `isNew` overrides default
- `refreshInstalledCache()` atomic swap: installedIds is never empty during async operation

**Module: extension.ts** (extend `test/suite/extension.test.ts`)
- `updateTreeBadge()`: correct badge value and tooltip for combinations (new only, updates only, both, zero)

### 11.2 BDD / Acceptance Tests

```gherkin
Feature: New Content Detection

  Scenario: New items detected on auto-check (US-01, Scenario 1)
    Given a source "https://github.com/test/repo" with baseline paths ["agents/a.agent.md", "agents/b.agent.md"]
    And the current tree contains ["agents/a.agent.md", "agents/b.agent.md", "agents/c.agent.md", "prompts/p.prompt.md"]
    When checkForNewContent runs for the source
    Then newPaths contains ["agents/c.agent.md", "prompts/p.prompt.md"]
    And removedPaths is empty
    And the baseline is updated to include all 4 paths

  Scenario: First activation establishes baseline (US-01, Scenario 2)
    Given no baseline exists for source "https://github.com/test/repo"
    And the current tree contains ["agents/a.agent.md"]
    When checkForNewContent runs for the source
    Then newPaths is empty
    And removedPaths is empty
    And the baseline contains ["agents/a.agent.md"]

  Scenario: Category expand marks items as seen (US-01, Scenario 3)
    Given newContent:new for source contains ["agents/c.agent.md"]
    When user expands the "agents" category
    Then newContent:new for source is empty
    And the TreeView badge count decreases by 1

  Scenario: TreeView badge shows combined count (US-02, Scenario 1)
    Given 2 new items detected across sources
    And 3 items with updates available
    When the badge is recalculated
    Then TreeView.badge.value is 5
    And TreeView.badge.tooltip is "2 new, 3 updates"

  Scenario: TreeView badge hidden when no changes (US-02, Scenario 2)
    Given 0 new items and 0 updates
    When the badge is recalculated
    Then TreeView.badge is undefined

  Scenario: Mark All as Seen clears all markers (US-03, Scenario 1)
    Given 3 new items in source A and 2 new items in source B
    When user runs "Mark All as Seen" command
    Then all newContent:new keys are cleared
    And all newContent:removed keys are cleared
    And the TreeView badge shows only update count

  Scenario: Update badge shows plain text (US-04, Scenario 1)
    Given a CatalogFileItem with updateAvailable = true
    When createFileTreeItem renders the item
    Then treeItem.description equals "update available"
    And treeItem.description does not contain "$(cloud-download)"
    And treeItem.iconPath is ThemeIcon("cloud-download")

  Scenario: Installed cache atomic swap (US-05, Scenario 1)
    Given items are installed with IDs ["url#path1", "url#path2"]
    When refresh() is called
    Then installedIds is never observed as an empty Set
    And after async completion installedIds contains ["url#path1", "url#path2"]

  Scenario: Removed items detected (US-06, Scenario 1)
    Given a source baseline contains ["agents/a.agent.md", "agents/b.agent.md"]
    And the current tree contains only ["agents/a.agent.md"]
    When checkForNewContent runs
    Then removedPaths contains ["agents/b.agent.md"]
    And the item renders with "removed upstream" description

  Scenario: Removed installed item retains uninstall action (US-06, Scenario 2)
    Given item "agents/b.agent.md" is removed upstream AND installed locally
    When the tree renders
    Then the item shows contextValue "catalogItem.removedInstalled"
    And the uninstall action is available in the context menu

  Scenario: New content detection disabled (US-07, Scenario 1)
    Given newContentDetection setting is false
    When auto-check runs
    Then checkForNewContent is not called
    And TreeView badge shows only update count
    And no "new" or "removed" markers appear
```

### 11.3 Integration Tests

- **E2E with mocked fetch**: Extend `e2e-browse-install.test.ts` to verify new-content detection end-to-end with FetchMocker providing different tree responses on sequential calls.
- **globalState persistence**: Verify that new-content state survives extension reactivation (mock `globalState` with preloaded data).
- **Multi-source**: Verify detection works independently per source - new items in source A do not affect source B.

### 11.4 End-to-End Tests

- **Critical journey**: Fresh install -> auto-check -> new items appear with badge -> expand category -> markers clear -> badge updates.
- **Tools**: Existing `vscode.test-electron` framework with FetchMocker.

### 11.5 Performance Tests

- Extend existing `performance.test.ts`:
  - `checkForNewContent()` with 500-item baseline and 510-item current tree: completes in under 10ms.
  - `updateTreeBadge()` with 20 sources: completes in under 1ms.

### 11.6 Security Tests

- No new security tests required - no new external API calls, no user input processing, no HTML rendering.
- Existing path traversal and SSRF tests remain unchanged.

---

## 12. Constraints & Assumptions

### Constraints

- **VS Code API**: `TreeView.badge` accepts only `{ value: number; tooltip: string } | undefined`. No support for multiple badges, colors, or icons on the badge itself.
- **globalState size**: VS Code docs do not specify a hard limit, but practical limit is approximately 50 MB. Baseline storage is well under 1 MB for any reasonable number of sources.
- **ETag caching**: The `getRepoTree()` response is cached with ETags. If the GitHub API returns 304 Not Modified, the tree snapshot is identical to the previous check - no new/removed items detected. This is correct behavior.

### Assumptions

- **A-001**: The `GitHubTreeResponse.tree` array provides a complete list of all blob and tree entries in the repository. This is true for repos under the GitHub API limit (~100,000 entries). Validated by the existing `truncated` field check.
- **A-002**: Source URLs are stable identifiers - the same source URL always refers to the same repository. URL normalization (trailing slashes, case) is not applied, matching the existing pattern.
- **A-003**: Tree snapshot diffing operates on file paths only, not SHAs. A file modified in-place (same path, different content) is not detected as "new" - this is correct behavior, as the existing update detection handles content changes for installed items.
- **A-004**: The `sparkle` codicon is available in VS Code 1.60+. The extension's `engines.vscode` minimum version must be verified.

---

## 13. Out of Scope

- **Content quality signals**: No rating, stars, or download counts for items.
- **Breaking change detection**: No mechanism to signal that an update is incompatible with existing configuration.
- **Recommendation engine**: No "you might like this" suggestions based on detected tools or installed items.
- **Push/real-time notifications**: No webhook integration; remains pull-based on timer.
- **Cross-source deduplication**: If two sources add the same agent, both show as new independently.
- **Notification toast for new items**: The brief's Option 1 (toast notifications for new items) is not included. The TreeView badge is the sole notification mechanism for new content. The existing toast for updates remains.

---

## 14. Open Questions

| # | Question | Impact if Unresolved | Owner |
|---|----------|---------------------|-------|
| OQ-1 | ~~What is the minimum VS Code engine version?~~ **Resolved**: Engine is `^1.85.0`, well above 1.59+ (`TreeView.badge`) and 1.60+ (`sparkle` icon). No issue. | N/A | Verified in package.json. |
| OQ-2 | Should the "Mark All as Seen" command also clear update results (lifecycle.clearUpdateCache()), or only new/removed state? | If yes, the badge drops to 0 entirely; if no, only new markers clear. | User confirmed: only new/removed state. Updates cleared by separate "Check for Updates" flow. |

---

## 15. Glossary

| Term | Definition |
|------|-----------|
| **Baseline** | The stored set of file paths from a source's last-known tree snapshot. Used as the reference for diffing. |
| **New item** | A file path present in the current tree but absent from the stored baseline. |
| **Removed item** | A file path present in the stored baseline but absent from the current tree. |
| **Seen** | A "new" item that the user has acknowledged (by expanding its category or running "Mark All as Seen"). Seen items lose their "new" marker. |
| **TreeView badge** | The numeric indicator shown on the tree view title bar, using `vscode.TreeView.badge`. |
| **ETag caching** | HTTP conditional request mechanism using the `ETag` / `If-None-Match` headers. Returns 304 Not Modified when content is unchanged. |
| **Atomic swap** | Replacing a data structure in a single assignment rather than clearing and repopulating, to avoid intermediate empty states. |
| **Auto-check cycle** | The periodic timer that runs `checkForUpdates()` and (with this feature) `checkForNewContent()`. Default interval: 60 minutes. |

---

## 16. Traceability Matrix

| FR ID | Requirement Summary | User Story | Acceptance Scenario | Test Type | Test Section Ref |
|-------|-------------------|------------|--------------------|-----------|-|
| FR-001 | Store baseline paths in globalState | US-01 | Scenario 2 (baseline established) | unit, BDD | 11.1, 11.2 |
| FR-002 | Compare tree against baseline on auto-check | US-01 | Scenario 1 (new items detected) | unit, BDD, integration | 11.1, 11.2, 11.3 |
| FR-003 | Classify new paths (current - baseline) | US-01 | Scenario 1 | unit, BDD | 11.1, 11.2 |
| FR-004 | First activation = baseline, no false positives | US-01 | Scenario 2 | unit, BDD | 11.1, 11.2 |
| FR-005 | Store new paths in globalState | US-01 | Scenario 1 | unit | 11.1 |
| FR-006 | Update baseline after computing diff | US-01 | Scenario 1 | unit, BDD | 11.1, 11.2 |
| FR-007 | Classify removed paths (baseline - current) | US-06 | Scenario 1 | unit, BDD | 11.1, 11.2 |
| FR-008 | Store removed paths in globalState | US-06 | Scenario 1 | unit | 11.1 |
| FR-009 | Removed items render with marker | US-06 | Scenario 1 | unit, BDD | 11.1, 11.2 |
| FR-010 | Baseline updated to current tree after diff | US-01 | Scenario 1 | unit | 11.1 |
| FR-011 | TreeView.badge = new + updates count | US-02 | Scenario 1 | unit, BDD | 11.1, 11.2 |
| FR-012 | Badge tooltip with breakdown | US-02 | Scenario 1, 3 | unit, BDD | 11.1, 11.2 |
| FR-013 | Badge hidden when count = 0 | US-02 | Scenario 2 | unit, BDD | 11.1, 11.2 |
| FR-014 | Badge recalculated after state changes | US-02 | All scenarios | unit, integration | 11.1, 11.3 |
| FR-015 | New items: description="new", icon=sparkle | US-01 | Scenario 1 | unit | 11.1 |
| FR-016 | Priority: updateAvailable > installed > new | US-01 | Edge case | unit | 11.1 |
| FR-017 | contextValue = catalogItem.new | US-01 | Scenario 1 | unit | 11.1 |
| FR-018 | Removed items: description, warning icon | US-06 | Scenario 1 | unit | 11.1 |
| FR-019 | Removed + installed: special contextValue | US-06 | Scenario 2 | unit, BDD | 11.1, 11.2 |
| FR-020 | Removed + not installed: no install action | US-06 | Scenario 3 | unit | 11.1 |
| FR-021 | Category expand marks items as seen | US-01 | Scenario 3 | unit, BDD | 11.1, 11.2 |
| FR-022 | markAllSeen command clears all markers | US-03 | Scenario 1, 2 | unit, BDD | 11.1, 11.2 |
| FR-023 | Badge recalculated after mark-seen | US-03 | Scenario 1 | unit, BDD | 11.1, 11.2 |
| FR-024 | No codicon syntax in description | US-04 | Scenario 1 | unit, BDD | 11.1, 11.2 |
| FR-025 | Update icon via iconPath only | US-04 | Scenario 1 | unit | 11.1 |
| FR-026 | Atomic swap for installedIds | US-05 | Scenario 1 | unit, BDD | 11.1, 11.2 |
| FR-027 | fire() only after atomic swap | US-05 | Scenario 2 | unit | 11.1 |
| FR-028 | No new config for core feature | US-01, US-02 | All | - | - |
| FR-029 | newContentDetection kill switch | US-07 | Scenario 1, 2 | unit, BDD | 11.1, 11.2 |

**Validation**: Every FR maps to at least one US. Every US maps to at least one acceptance scenario. Every scenario maps to at least one test type and section reference. No gaps.

---

## 17. Technical References

### Architecture & Patterns
- VS Code TreeView API, https://code.visualstudio.com/api/extension-guides/tree-view - TreeView.badge, getTreeItem, getChildren patterns
- VS Code Extension API Reference, https://code.visualstudio.com/api/references/vscode-api#TreeView - TreeView.badge property documentation

### Technology Stack
- VS Code ThemeIcon codicons, https://code.visualstudio.com/api/references/icons-in-labels - Clarifies that description field does NOT render codicons (only label with TreeItemLabel does)
- VS Code Memento API, https://code.visualstudio.com/api/references/vscode-api#Memento - globalState persistence API

### Standards & Specifications
- GitHub REST API: Git Trees, https://docs.github.com/en/rest/git/trees - recursive tree endpoint used by getRepoTree()
- GitHub REST API: Conditional Requests, https://docs.github.com/en/rest/using-the-rest-api/best-practices#use-conditional-requests-if-appropriate - ETag caching behavior

---

## 18. Version History

| Version | Date | Author | Summary of Changes |
|---------|------|--------|--------------------|
| 1.0 | 2026-03-17 | Spec Architect | Initial specification |
| 1.0.1 | 2026-03-17 | Spec Architect | Self-review corrections: clarified FR-009 rendering of removed items from baseline data; added truncated tree edge case; added atomic swap rationale; verified all traceability matrix cells complete |
