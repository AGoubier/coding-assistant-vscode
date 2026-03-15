---
lane: planned
---

# WP09 - Org Practice Bundles (P2)

> **Spec**: `specs/001-awesome-coding-assistants.spec.md`
> **Status**: Not Started
> **Priority**: P2
> **Goal**: Org leads can define named collections of customizations ("practice bundles") in source repos, and users can install all items in a bundle with one click.
> **Independent Test**: Create a `bundles/team-onboarding.json` file in a source repo listing 5 items. Configure the source. Verify the bundle appears in the tree under a "Bundles" category with "5 items" badge. Click "Install Bundle" and verify all 5 items are installed to the correct directories.
> **Depends on**: WP01, WP02, WP03, WP05
> **Parallelisable**: Yes (can be worked after WP05, independent of WP06-WP08)
> **Prompt**: `plans/WP09-bundles.md`

## Objective

Implement practice bundle support: parse bundle manifests from source repos, display bundles in the tree view, and enable one-click installation of all items in a bundle. This delivers US-07 (Org Practice Bundles) and enables the "deploy practices to new teams" goal from the original vision.

## Spec References

- Section 5 US-07 (Org Practice Bundles)
- Section 7.7 Bundle Manifest (`bundles/{name}.json`)
- Section 7.8 BundleItem
- Section 14 Open Questions Q2 (cross-source bundle references - RESOLVED: Yes)
- Section 3 Org Lead persona

## Tasks

### T09-01 - Bundle manifest parser

- **Description**: Implement parsing and validation of bundle manifest files (`bundles/{name}.json`) from source repos.
- **Spec refs**: Section 7.7 (Bundle Manifest schema), Section 7.8 (BundleItem schema)
- **Parallel**: No
- **Acceptance criteria**:
  - [ ] `parseBundle(content: string): Bundle` parses JSON and validates against schema
  - [ ] Bundle schema validated: `name` (required, 1-100 chars), `description` (optional, 0-500 chars), `items` (required, min 1)
  - [ ] BundleItem schema validated: `path` (required), `sourceUrl` (optional), `tool` (required, enum), `category` (required), `required` (optional, default true)
  - [ ] Cross-source references: if `sourceUrl` is specified on a BundleItem, it overrides the parent bundle's source
  - [ ] Invalid bundle JSON returns a descriptive error with the bundle name and validation issue
  - [ ] Types `Bundle` and `BundleItem` added to `src/models/types.ts`
- **Test requirements**: unit (valid bundles, invalid bundles, edge cases)
- **Depends on**: WP02 T02-01 (types)
- **Implementation Guidance**:
  - Schema: `{ name: string, description?: string, items: BundleItem[] }`
  - BundleItem: `{ path: string, sourceUrl?: string, tool: 'copilot' | 'claude-code', category: string, required?: boolean }`
  - Validate with runtime checks (not JSON Schema library) to keep dependencies minimal
  - Cross-source: when `sourceUrl` is present on a BundleItem, resolve it against the configured sources to find the matching SourceConfig

### T09-02 - Bundle discovery in tree view

- **Description**: Extend CatalogTreeProvider to discover and display bundles from the `bundles/` directory in source repos.
- **Spec refs**: US-07 Scenario 1 (bundle appears under Bundles category with count badge)
- **Parallel**: No (depends on T09-01)
- **Acceptance criteria**:
  - [ ] When loading a source's tree structure, check for a `bundles/` directory
  - [ ] Parse each `.json` file in `bundles/` as a bundle manifest
  - [ ] Display a "Bundles" category node under each source that has bundles
  - [ ] Each bundle shows as a tree item under "Bundles" with the bundle name
  - [ ] Bundle tree items show a count badge: `description = '5 items'` (count of items in the bundle)
  - [ ] Bundle tree items are expandable to show individual items (as child nodes)
  - [ ] If no bundles exist in a source, the "Bundles" category is not shown
  - [ ] Bundle items show their tool badge (from T08-05 if available, or plain text)
- **Test requirements**: unit (mock tree with bundles, verify hierarchy)
- **Depends on**: T09-01, WP03 (CatalogTreeProvider)
- **Implementation Guidance**:
  - In `getChildren(source)`, after loading regular categories, check if repo tree contains `bundles/` with `.json` files
  - Fetch and parse each bundle JSON via GitHubClient
  - Bundle category node: `new TreeItem('Bundles', TreeItemCollapsibleState.Collapsed)`
  - Individual bundle node: `new TreeItem(bundle.name, TreeItemCollapsibleState.Collapsed)` with `description = \`${bundle.items.length} items\``

### T09-03 - Install Bundle command

- **Description**: Implement `awesome-coding-assistants.installBundle` command that installs all items in a bundle sequentially with progress feedback.
- **Spec refs**: US-07 Scenario 2 (install bundle, all items installed with progress)
- **Parallel**: No (depends on T09-02, WP05 installer)
- **Acceptance criteria**:
  - [ ] Command `awesome-coding-assistants.installBundle` registered in `package.json`
  - [ ] Accepts a Bundle tree item as argument
  - [ ] Prompts for workspace folder (same logic as single-item install)
  - [ ] Installs each item in the bundle sequentially using the existing Installer service
  - [ ] Progress notification: "Installing bundle '{name}': {current}/{total}"
  - [ ] For cross-source items (with `sourceUrl`): resolves the source config from configured sources
  - [ ] If a cross-source reference cannot be resolved: warns user, skips that item, continues with others
  - [ ] For optional items (`required: false`): installs but does not fail the bundle if individual install fails
  - [ ] For required items: failure aborts the remaining installs and shows error
  - [ ] After completion: shows summary notification: "Installed {N}/{total} items from bundle '{name}'"
  - [ ] All manifest entries are created per item (not per bundle)
- **Test requirements**: unit (mock installer, verify sequencing), integration
- **Depends on**: T09-02, WP05 T05-07 (install command)
- **Implementation Guidance**:
  - Use `vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: \`Installing bundle '${bundle.name}'...\`, cancellable: true })`
  - For each item, call the existing `Installer.installFile()` or `Installer.installDirectory()` with `report.increment(100 / total)`
  - Cross-source resolution: find source in `SourceRegistry.getSources()` where `source.url === item.sourceUrl`
  - Handle cancellation: check `token.isCancellationRequested` between items

### T09-04 - Bundle menu contributions

- **Description**: Add "Install Bundle" action to bundle tree items in `package.json`.
- **Spec refs**: Section 8.1 (commands)
- **Parallel**: Yes (can be done early)
- **Acceptance criteria**:
  - [ ] `awesome-coding-assistants.installBundle` command in `contributes.commands` with title "Install Bundle" and icon `$(package)`
  - [ ] `view/item/context` menu: "Install Bundle" visible when `viewItem == bundleItem`
  - [ ] Bundle tree items have `contextValue = 'bundleItem'`
- **Test requirements**: none (declarative JSON)
- **Depends on**: WP01 (package.json)
- **Implementation Guidance**:
  - Menu entry: `{ "command": "awesome-coding-assistants.installBundle", "when": "viewItem == bundleItem", "group": "inline" }`

### T09-05 - Unit and integration tests for bundles

- **Description**: Test bundle parsing, tree display, and installation flow.
- **Spec refs**: US-07 Scenarios 1-2
- **Parallel**: No (depends on all T09 tasks)
- **Acceptance criteria**:
  - [ ] Test: valid bundle JSON parses correctly with all fields
  - [ ] Test: bundle with missing required field `name` -> validation error
  - [ ] Test: bundle with empty items array -> validation error
  - [ ] Test: cross-source item with valid sourceUrl -> resolves correctly
  - [ ] Test: cross-source item with unknown sourceUrl -> warning logged, item skipped
  - [ ] Test: bundle appears in tree under "Bundles" category
  - [ ] Test: bundle count badge shows correct item count
  - [ ] Test: install bundle installs all items to correct paths
  - [ ] Test: install bundle with one failure (required item) -> aborts remaining
  - [ ] Test: install bundle with one failure (optional item) -> continues
  - [ ] All tests pass with `npm test`
- **Test requirements**: This IS the test deliverable
- **Depends on**: T09-01 through T09-04
- **Implementation Guidance**:
  - Fixture bundles: `src/test/fixtures/bundles/team-onboarding.json` with 5 items
  - Mock Installer to track which items were installed
  - For failure testing: mock Installer to throw on a specific item path

## Implementation Notes

- Bundles are stored in source repos, not locally - they are a curation mechanism for org leads
- Cross-source references (Q2 resolution) mean a bundle can mix items from different repos - this requires all referenced sources to be configured
- Bundle installation reuses the existing Installer service - no new file system logic needed
- Manifest entries are per-item (not per-bundle) so individual items can be updated/uninstalled independently

## Parallel Opportunities

- T09-01 (parser) and T09-04 (menu) can be done in parallel
- T09-02 depends on T09-01
- T09-03 depends on T09-02

## Risks & Mitigations

- **Cross-source resolution failures**: A bundle may reference a source not configured by the user. Mitigation: clear error message listing the missing source URL, suggest adding it.
- **Large bundles**: A bundle with 20+ items could be slow to install. Mitigation: progress bar with cancellation, sequential installation to avoid API rate limits.
- **Bundle format evolution**: Future bundle features may need schema versioning. Mitigation: include format version checking in parser (reserve `version` field).

## Activity Log

- 2026-03-15T00:00:00Z - planner - lane=planned - Work package created
