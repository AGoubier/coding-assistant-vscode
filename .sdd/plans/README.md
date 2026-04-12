# Plan Index - Awesome Coding Assistants

> **Spec**: `specs/001-awesome-coding-assistants.spec.md`
> **Generated**: 2025-07-18

## Work Packages

| ID | Title | Priority | Status | Depends On | Parallelisable |
|----|-------|----------|--------|------------|----------------|
| [WP01](WP01-foundation.md) | Foundation and Project Scaffolding | P0 | Complete | none | - |
| [WP02](WP02-infrastructure.md) | Infrastructure Services | P0 | Complete | WP01 | No |
| [WP03](WP03-source-tree.md) | Source Registry and Tree View | P1 | Complete | WP01, WP02 | No |
| [WP04](WP04-preview.md) | Preview | P1 | Complete | WP01, WP02, WP03 | Yes (with WP05) |
| [WP05](WP05-installation.md) | Installation and Manifest | P1 | Complete | WP01, WP02, WP03 | Yes (with WP04) |
| [WP06](WP06-lifecycle.md) | Lifecycle Management | P1 | Complete | WP01-WP05 | No |
| [WP07](WP07-e2e-quality.md) | E2E Tests and Quality Gate | P1 | Done | WP01-WP06 | No |
| [WP08](WP08-tool-detection.md) | Smart Tool Detection | P2 | Complete | WP01, WP02, WP03 | Yes |
| [WP09](WP09-bundles.md) | Org Practice Bundles | P2 | Complete | WP01, WP02, WP03, WP05 | Yes |
| [WP10](WP10-search.md) | Search and Filter | P2 | Complete | WP01, WP02, WP03 | Yes |

## MVP Scope

The following work packages constitute the minimum releasable increment: **WP01, WP02, WP03, WP04, WP05, WP06, WP07**.

MVP delivers: browsing community customizations (US-01), previewing items (US-02), installing to workspace (US-03), private repo support (US-04), and lifecycle management with updates/uninstall (US-05).

All P2 work packages (WP08, WP09, WP10) are post-MVP enhancements. They are fully specified and planned to ensure no features are lost, but may be deferred.

## Dependency and Execution Summary

- **Sequence**: WP01 -> WP02 -> WP03 -> (WP04 || WP05) -> WP06 -> WP07
- **Post-MVP parallel track**: WP08, WP09, WP10 can begin after WP03 completes (WP09 also needs WP05)
- **Critical path**: WP01 -> WP02 -> WP03 -> WP05 -> WP06 -> WP07

## Sequencing Notes

**Phase 1 - Foundation (WP01-WP02)**: Project scaffolding, type definitions, shared services (GitHub client, cache, auth, path utils). No user-visible functionality yet.

**Phase 2 - Core Browse (WP03)**: Tree view with source registry. First user-visible feature: browsing catalog items.

**Phase 3 - Preview + Install (WP04 || WP05)**: These two work packages are independent and can be developed in parallel. WP04 delivers preview; WP05 delivers installation with manifest tracking.

**Phase 4 - Lifecycle (WP06)**: Depends on both WP04 (preview scheme for diff views) and WP05 (manifest for tracking). Delivers update detection, diff-based updates, and uninstall.

**Phase 5 - Quality Gate (WP07)**: E2E tests, performance validation, security tests, and coverage enforcement. Validates the full MVP journey.

**Phase 6 - P2 Enhancements (WP08, WP09, WP10)**: Independent features that can be worked in any order after their dependencies are met. Tool detection (WP08) and search (WP10) only need WP03. Bundles (WP09) needs WP05 for installation.

## Consistency Notes

The following cross-WP inconsistencies were identified and corrected during the consistency audit:

1. **contextValue naming**: Unified to `catalogItem.item`, `catalogItem.installed`, `catalogItem.updateAvailable` across WP01, WP03, WP05, WP06.
2. **ManifestEntry vs InstallationEntry**: The spec defines `InstallationEntry` (Section 7.5) and uses `ManifestEntry` in implementation contracts. Unified WP02 `UpdateCheckResult` to use `InstallationEntry` and added `folder` field.
3. **commitSha field name**: Spec Section 7.5 uses `commitSha`. WP06 incorrectly used `installedSha`. Corrected to `commitSha`.
4. **getLatestCommitSha signature**: WP06 called with `(owner, repo, path)`. WP02 defines `(source, path)`. Corrected WP06 to match WP02.
5. **Performance threshold**: Spec says 30 seconds for 50-item update check. WP06 incorrectly stated 5 seconds. Corrected to 30 seconds.
6. **Concurrency limit**: Spec says max 10 concurrent. WP06 incorrectly stated 5. Corrected to 10.
7. **5xx fallback**: Spec Section 9.5 requires stale cache on 5xx. Added to WP02 T02-06 acceptance criteria.
8. **CategoryType**: Added `workflows` to the union to match FR-012 Copilot patterns.
9. **Bundle types path**: WP09 incorrectly referenced `src/types.ts`. Corrected to `src/models/types.ts`.
10. **Auto-check updates**: Settings `autoCheckUpdates` and `autoCheckIntervalMinutes` were declared in WP01 but had no runtime implementation. Added T06-08 to WP06.
11. **WP06 dependency on WP04**: WP06 T06-05 reuses WP04's preview scheme for diff views. Added WP04 to WP06's dependency list.

## Task Index

| Task ID | Summary | Work Package | Parallel? |
|---------|---------|--------------|-----------|
| T01-01 | package.json manifest | WP01 | No |
| T01-02 | TypeScript and build configuration | WP01 | No |
| T01-03 | Extension entry point | WP01 | No |
| T01-04 | Test infrastructure | WP01 | No |
| T01-05 | Linting and formatting | WP01 | Yes |
| T01-06 | CI/CD pipeline | WP01 | Yes |
| T01-07 | Coverage configuration | WP01 | Yes |
| T01-08 | Scaffold verification test | WP01 | No |
| T02-01 | Shared type definitions | WP02 | No |
| T02-02 | Error class hierarchy | WP02 | Yes |
| T02-03 | Path utilities | WP02 | Yes |
| T02-04 | AuthManager service | WP02 | No |
| T02-05 | CacheManager service | WP02 | No |
| T02-06 | GitHubClient service | WP02 | No |
| T02-07 | Unit tests for infrastructure | WP02 | No |
| T03-01 | Source registry service | WP03 | No |
| T03-02 | Format detection (path-based) | WP03 | No |
| T03-03 | CatalogTreeProvider | WP03 | No |
| T03-04 | Tree view registration and wiring | WP03 | No |
| T03-05 | Welcome view and empty states | WP03 | No |
| T03-06 | Unit tests for source/tree | WP03 | No |
| T04-01 | PreviewContentProvider | WP04 | No |
| T04-02 | Preview command handler | WP04 | No |
| T04-03 | Preview for directory items | WP04 | No |
| T04-04 | Preview menu contribution | WP04 | Yes |
| T04-05 | Unit tests for preview | WP04 | No |
| T05-01 | Target path computation | WP05 | Yes |
| T05-02 | Single file installation | WP05 | No |
| T05-03 | Directory installation | WP05 | No |
| T05-04 | Conflict resolution | WP05 | No |
| T05-05 | Multi-root folder selection | WP05 | Yes |
| T05-06 | Manifest read/write | WP05 | Yes |
| T05-07 | Install command integration | WP05 | No |
| T05-08 | Unit/integration tests for install | WP05 | No |
| T06-01 | LifecycleManager scaffold | WP06 | No |
| T06-02 | Update check logic (SHA comparison) | WP06 | No |
| T06-03 | Installed badge on tree items | WP06 | Yes |
| T06-04 | Check for Updates command | WP06 | No |
| T06-05 | Update action with diff view | WP06 | No |
| T06-06 | Uninstall action | WP06 | Yes |
| T06-07 | Menu contributions | WP06 | Yes |
| T06-08 | Auto-check updates on activation | WP06 | Yes |
| T06-09 | Unit/integration tests for lifecycle | WP06 | No |
| T07-01 | E2E test infrastructure setup | WP07 | No |
| T07-02 | E2E: Browse > Preview > Install | WP07 | No |
| T07-03 | E2E: Check Updates > Update > Uninstall | WP07 | No |
| T07-04 | Integration: GitHubClient + Cache + Auth | WP07 | Yes |
| T07-05 | Integration: SourceRegistry + GitHubClient | WP07 | Yes |
| T07-06 | Performance tests | WP07 | Yes |
| T07-07 | Security tests | WP07 | Yes |
| T07-08 | Coverage threshold enforcement | WP07 | Yes |
| T07-09 | Accessibility verification | WP07 | Yes |
| T08-01 | ToolDetector: workspace scanning | WP08 | No |
| T08-02 | ToolDetector: item classification | WP08 | Yes |
| T08-03 | Tree view filtering by detected tools | WP08 | No |
| T08-04 | Toggle Show All Tools command | WP08 | Yes |
| T08-05 | Tool compatibility badges | WP08 | Yes |
| T08-06 | Unit tests for tool detection | WP08 | No |
| T09-01 | Bundle manifest parser | WP09 | No |
| T09-02 | Bundle discovery in tree view | WP09 | No |
| T09-03 | Install Bundle command | WP09 | No |
| T09-04 | Bundle menu contributions | WP09 | Yes |
| T09-05 | Unit/integration tests for bundles | WP09 | No |
| T10-01 | Search input UI | WP10 | No |
| T10-02 | Search matching logic | WP10 | Yes |
| T10-03 | Filtered tree rendering | WP10 | No |
| T10-04 | Clear search / reset filter | WP10 | Yes |
| T10-05 | Unit tests for search | WP10 | No |

**Total**: 10 work packages, 62 tasks

---

# Plan Index - New Content Notifications (Spec 002)

> **Spec**: `specs/002-new-content-notifications.spec.md`
> **Generated**: 2026-03-17

## Work Packages

| ID | Title | Priority | Status | Depends On | Parallelisable |
|----|-------|----------|--------|-----------|----------------|
| [WP11](WP11-bug-fixes.md) | Bug Fixes: Update Badge Visibility and Installed Cache Race | P1 | Not Started | none | Yes |
| [WP12](WP12-new-content-service.md) | NewContentDetector Service and Data Model | P1 | Complete | none | Yes |
| [WP13](WP13-tree-ui-badges.md) | Tree UI Integration, TreeView Badge, and Commands | P1 | Complete | WP11, WP12 | No |
| [WP14](WP14-removed-content.md) | Removed Content Rendering and Dismiss | P2 | Complete | WP12, WP13 | No |

## MVP Scope (Spec 002)

The following work packages constitute the minimum releasable increment: **WP11, WP12, WP13**.
- WP11 fixes two existing bugs (codicon literal text, cache race) that are prerequisites for correct badge behavior.
- WP12 implements the core NewContentDetector service that performs tree snapshot diffing.
- WP13 wires everything together: TreeView badge, "new" markers, "Mark All as Seen" command, auto-check integration.

**WP14** (removed content rendering) is post-MVP. It adds P2 functionality for surfacing items removed from upstream. It can be deferred without affecting the MVP experience.

## Dependency & Execution Summary (Spec 002)

```
WP11 (Bug Fixes)  ----\
                        +---> WP13 (Tree UI + Badge + Commands) ---> WP14 (Removed Content)
WP12 (Service)    ----/
```

- **Sequence**: WP11 + WP12 (parallel) -> WP13 -> WP14
- **Parallelization**: WP11 and WP12 can be worked concurrently (no shared code changes).
- **Critical path**: WP12 -> WP13 -> WP14 (longest chain). WP11 is a shorter parallel track that must complete before WP13.

## Sequencing Notes (Spec 002)

**Phase 1 - Foundation (WP11 + WP12, parallel)**:
WP11 and WP12 have zero shared dependencies and modify different files. WP11 touches only `catalogTree.ts` (bug fixes). WP12 creates the new `newContentDetector.ts` service and extends `types.ts`. Both add configuration to `package.json` but in non-overlapping sections (WP11: no config changes; WP12: adds `newContentDetection` setting and types).

**Phase 2 - Integration (WP13)**:
WP13 is the largest work package. It wires the NewContentDetector into `extension.ts`, adds badge logic, renders "new" markers in the tree, implements the "Mark All as Seen" command, and adds integration tests. It depends on both WP11 (clean badge rendering) and WP12 (the service itself).

**Phase 3 - Removed Content (WP14)**:
WP14 adds the P2 removed-content rendering. It builds on WP13's tree UI changes by adding synthetic removed items to `getFileNodes()` and rendering them with warning markers. This can be deferred without impacting the MVP.

## Task Index (Spec 002)

| Task ID | Summary | Work Package | Parallel? |
|---------|---------|--------------|----------|
| T11-01 | Fix codicon literal text in update description | WP11 | Yes |
| T11-02 | Fix installed cache race condition with atomic swap | WP11 | Yes |
| T11-03 | Unit tests for update badge fix | WP11 | No |
| T11-04 | Unit tests for installed cache atomic swap | WP11 | No |
| T11-05 | Build and lint verification | WP11 | No |
| T12-01 | Add NewContentResult interface and CatalogFileItem extensions | WP12 | Yes |
| T12-02 | Add newContentDetection configuration setting | WP12 | Yes |
| T12-03 | Implement NewContentDetector service | WP12 | No |
| T12-04 | Unit tests for NewContentDetector | WP12 | No |
| T12-05 | Export and barrel file updates | WP12 | No |
| T12-06 | Build and test verification | WP12 | No |
| T13-01 | Register markAllSeen command and menu in package.json | WP13 | Yes |
| T13-02 | Wire NewContentDetector in extension.ts activation | WP13 | No |
| T13-03 | Add setNewContentDetector() method to CatalogTreeProvider | WP13 | Yes |
| T13-04 | Render "new" markers in createFileTreeItem() | WP13 | No |
| T13-05 | Set isNew flag in getFileNodes() | WP13 | No |
| T13-06 | Mark category items as seen on expand | WP13 | No |
| T13-07 | Integrate new-content check into auto-check cycle | WP13 | No |
| T13-08 | Unit tests for tree UI integration | WP13 | No |
| T13-09 | Integration and E2E tests | WP13 | No |
| T13-10 | Build and test verification | WP13 | No |
| T14-01 | Merge removed items into getFileNodes() | WP14 | No |
| T14-02 | Render "removed upstream" markers in createFileTreeItem() | WP14 | No |
| T14-03 | Include removed count in TreeView badge tooltip | WP14 | Yes |
| T14-04 | Include removed items in auto-check notification message | WP14 | Yes |
| T14-05 | Unit tests for removed content rendering | WP14 | No |
| T14-06 | Integration tests for removed content flow | WP14 | No |
| T14-07 | Build and test verification | WP14 | No |

**Total (Spec 002)**: 4 work packages, 28 tasks

## Consistency Notes (Spec 002)

**Cross-WP verification performed:**
- `CatalogFileItem.isNew` and `CatalogFileItem.isRemoved` fields defined in WP12 T12-01 (`types.ts`) and consumed by WP13 T13-04/T13-05 and WP14 T14-01/T14-02 -- field names, types, and optionality match across all references.
- `NewContentDetector` API surface: constructor, `checkForNewContent()`, `getNewItems()`, `getRemovedItems()`, `markCategorySeen()`, `markAllSeen()`, `getTotalNewCount()`, `getTotalRemovedCount()` -- all method signatures referenced consistently across WP12, WP13, and WP14.
- `setNewContentDetector()` method defined in WP13 T13-03, used in WP13 T13-02, and relied upon by WP14 for detector availability.
- GlobalState key patterns (`newContent:seen:`, `newContent:new:`, `newContent:removed:`) consistent across WP12 service and all consuming WPs.
- `updateTreeBadge()` badge formula: WP13 defines `newCount + updateCount`; WP14 T14-03 extends to `newCount + removedCount + updateCount`. The WP14 change is additive (modifies the same function).
- `contextValue` strings: `catalogItem.new` (WP13 T13-04), `catalogItem.removed` and `catalogItem.removedInstalled` (WP14 T14-02) -- no conflicts with existing values (`catalogItem.installed`, `catalogItem.updateAvailable`).
- Priority chain in `createFileTreeItem()`: WP11 fixes the update branch, WP13 adds `isNew` branch, WP14 adds `isRemoved` branch. Order: `updateAvailable` > `installed` (non-removed) > `isNew` > `isRemoved` > default -- consistent across all WP files.
- `awesome-coding-assistants.hasNewContent` context key: WP13 sets it based on `newCount > 0`; WP14 extends to `(newCount + removedCount) > 0`. Additive change tracked in WP14 T14-03.
- Configuration setting `newContentDetection`: defined in WP12 T12-02, consumed in WP13 T13-07. Same key name, type, and default value.
- All 29 FRs from spec 002 are assigned to exactly one task across all WPs. No orphan FRs. No duplicate assignments.
- Dependency graph is acyclic: WP11 -> WP13; WP12 -> WP13 -> WP14. No circular dependencies.
- Coverage requirements: 90% line, 85% branch stated in WP12 T12-04 for the NewContentDetector module.

---

# Plan Index - Folder Segregation and Onboarding (Spec 003)

> **Spec**: `specs/003-folder-segregation-and-onboarding.spec.md`
> **Generated**: 2025-07-20

## Work Packages

| ID | Title | Priority | Status | Depends On | Parallelisable |
|----|-------|----------|--------|-----------|----------------|
| [WP15](WP15-folder-detection.md) | Folder Detection, Path Utilities, and Type Extensions | P1 | Done | none | Yes |
| [WP16](WP16-folder-tree-display.md) | Catalog Tree Folder Display | P1 | Not Started | WP15 | No |
| [WP17](WP17-folder-install-conflicts.md) | Folder-Aware Installation and Conflict Resolution | P1 | Not Started | WP15, WP16 | No |
| [WP18](WP18-folder-search.md) | Search Across Folders | P1 | Not Started | WP16 | Yes (with WP17) |
| [WP19](WP19-index-url-migration.md) | Index URL Migration and Multi-Index Merge | P1 | Not Started | none | Yes |
| [WP20](WP20-onboarding-walkthrough.md) | Onboarding Walkthrough and Enterprise Configuration | P1 | Not Started | WP19 | No |

## MVP Scope (Spec 003)

All 6 work packages are P1 MVP. The spec defines all 35 FRs as P1 priority with 12 user stories, all MVP.

- **Folder feature track** (WP15-WP18): Per-folder segregation in source repos -- detection, tree display, installation, search.
- **Onboarding track** (WP19-WP20): Multi-index URL support with backward-compatible migration and interactive onboarding walkthrough.

## Dependency & Execution Summary (Spec 003)

```
WP15 (Folder Detection) ---> WP16 (Tree Display) ---> WP17 (Install + Conflicts)
                                    |                         
                                    +---> WP18 (Search)       

WP19 (Index URL Migration) ---> WP20 (Onboarding Walkthrough)
```

- **Two independent tracks**: Folder track (WP15-WP18) and Onboarding track (WP19-WP20) have no cross-dependencies and can be worked in parallel.
- **Folder track critical path**: WP15 -> WP16 -> WP17. WP18 can run in parallel with WP17 (both depend on WP16, not each other).
- **Onboarding track critical path**: WP19 -> WP20.
- **Parallelization**: WP15 and WP19 can start simultaneously. WP17 and WP18 can run concurrently after WP16 completes.

## Sequencing Notes (Spec 003)

**Track A - Folder Segregation (WP15, WP16, WP17, WP18)**:

**Phase 1 - Foundation (WP15)**: Type extensions (FolderDetectionResult, FolderItem), folder detection (detectFolders, groupByFolder), path utilities (formatFolderName, stripFolderPrefix), and templates/ stripping removal from classifyItem(). No user-visible changes yet.

**Phase 2 - Display (WP16)**: Integrates folder detection into CatalogTreeProvider. Adds FolderItem to TreeElement union, getFolderNodes() method, modified getChildren() for Source > Folder > Category > Item hierarchy, Default virtual folder, empty folder hiding. First user-visible change: folder nodes appear in the tree.

**Phase 3a - Installation (WP17)**: Folder prefix stripping at install time, full-path manifest tracking, folder-aware update/uninstall, cross-folder conflict detection and quick-pick resolution UI.

**Phase 3b - Search (WP18, parallel with WP17)**: Search filtering respects folder hierarchy. Folders with zero matches are hidden during search. hasAnySearchMatch() updated for folder-prefix-stripped classification.

**Track B - Onboarding (WP19, WP20)**:

**Phase 1 - Migration (WP19)**: indexUrl setting schema change from string to array, normalizeIndexUrls() backward-compatible coercion, loadMultipleIndexes() with parallel fetch and union merge, partial failure handling, cache invalidation.

**Phase 2 - Walkthrough (WP20)**: Walkthrough media files, package.json contributes.walkthroughs declaration, openWalkthrough command handler, error handling, VSIX packaging verification.

## Task Index (Spec 003)

| Task ID | Summary | Work Package | Parallel? |
|---------|---------|--------------|----------|
| T15-01 | Add FolderDetectionResult and FolderItem types | WP15 | No |
| T15-02 | Implement detectFolders() function | WP15 | No |
| T15-03 | Implement groupByFolder() function | WP15 | Yes |
| T15-04 | Implement formatFolderName() function | WP15 | Yes |
| T15-05 | Implement stripFolderPrefix() function | WP15 | Yes |
| T15-06 | Remove templates/ prefix stripping from classifyItem() | WP15 | No |
| T15-07 | Update existing classifyItem() tests for templates/ change | WP15 | No |
| T15-08 | Unit tests for folder detection, grouping, formatting, stripping | WP15 | No |
| T16-01 | Update TreeElement union and getTreeItem() for FolderItem | WP16 | No |
| T16-02 | Implement getFolderNodes() method | WP16 | No |
| T16-03 | Modify getChildren() for folder hierarchy | WP16 | No |
| T16-04 | Update getCategoryNodes() for folder-scoped entries | WP16 | No |
| T16-05 | Update getFileNodes() for folder-scoped classification | WP16 | No |
| T16-06 | Folder rendering error handling | WP16 | Yes |
| T16-07 | Unit tests for folder tree display | WP16 | No |
| T17-01 | Modify install command for folder prefix stripping | WP17 | No |
| T17-02 | Update manifest entry creation with full source path | WP17 | Yes |
| T17-03 | Update lifecycle operations for folder-aware manifest | WP17 | Yes |
| T17-04 | Implement detectCrossFolderConflict() function | WP17 | No |
| T17-05 | Implement resolveConflict() quick-pick UI | WP17 | Yes |
| T17-06 | Integrate conflict detection into install flow | WP17 | No |
| T17-07 | Unit and integration tests for folder-aware installation | WP17 | No |
| T18-01 | Modify folder-level getChildren() for search filtering | WP18 | No |
| T18-02 | Category-level search within folder context | WP18 | Yes |
| T18-03 | Update hasAnySearchMatch() for folder-aware sources | WP18 | Yes |
| T18-04 | Search preserves folder context in results | WP18 | Yes |
| T18-05 | Unit tests for folder search | WP18 | No |
| T19-01 | Change indexUrl setting schema in package.json | WP19 | No |
| T19-02 | Implement normalizeIndexUrls() function | WP19 | No |
| T19-03 | Implement loadMultipleIndexes() function | WP19 | No |
| T19-04 | Modify loadMasterIndex() for multi-URL support | WP19 | No |
| T19-05 | Partial and total failure handling | WP19 | Yes |
| T19-06 | Cache invalidation on indexUrl setting change | WP19 | Yes |
| T19-07 | Add error catalog entries for index operations | WP19 | Yes |
| T19-08 | Unit tests for index URL migration and multi-index merge | WP19 | No |
| T20-01 | Create walkthrough media markdown files | WP20 | Yes |
| T20-02 | Add contributes.walkthroughs to package.json | WP20 | No |
| T20-03 | Register openWalkthrough command in package.json | WP20 | Yes |
| T20-04 | Implement openWalkthrough command handler | WP20 | No |
| T20-05 | Error handling for openWalkthrough command | WP20 | Yes |
| T20-06 | Ensure walkthrough media files are bundled in VSIX | WP20 | Yes |
| T20-07 | Unit tests for openWalkthrough command | WP20 | No |

**Total (Spec 003)**: 6 work packages, 42 tasks
