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
| [WP05](WP05-installation.md) | Installation and Manifest | P1 | Not Started | WP01, WP02, WP03 | Yes (with WP04) |
| [WP06](WP06-lifecycle.md) | Lifecycle Management | P1 | Not Started | WP01-WP05 | No |
| [WP07](WP07-e2e-quality.md) | E2E Tests and Quality Gate | P1 | Not Started | WP01-WP06 | No |
| [WP08](WP08-tool-detection.md) | Smart Tool Detection | P2 | Not Started | WP01, WP02, WP03 | Yes |
| [WP09](WP09-bundles.md) | Org Practice Bundles | P2 | Not Started | WP01, WP02, WP03, WP05 | Yes |
| [WP10](WP10-search.md) | Search and Filter | P2 | Not Started | WP01, WP02, WP03 | Yes |

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
