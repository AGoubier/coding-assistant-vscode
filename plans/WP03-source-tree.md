---
lane: planned
---

# WP03 - Source Registry and Tree View

> **Spec**: `specs/001-awesome-coding-assistants.spec.md`
> **Status**: Not Started
> **Priority**: P1
> **Goal**: Users can configure source repositories and browse their contents in a hierarchical tree view (Source > Category > Item) with tool badges and descriptions.
> **Independent Test**: Configure a source repo in settings, open the sidebar, expand the source node, see category nodes, expand a category, see customization items with Copilot/Claude Code badges. With no sources: see the welcome message.
> **Depends on**: WP01, WP02
> **Parallelisable**: No (WP04-WP06 depend on browsable tree)
> **Prompt**: `plans/WP03-source-tree.md`

## Objective

Implement the SourceRegistry service (reads/validates configured sources from settings and master index), the tool classifier (determines Copilot vs Claude Code from file paths), and the CatalogTreeProvider (the main tree view that users interact with). This WP delivers the core US-01 (Browse Community Customizations) experience.

## Spec References

- Section 4.1 Source Registry Management (FR-001 to FR-005)
- Section 4.2 Repository Browsing and Tree View (FR-006 to FR-011)
- Section 4.3 Tool Format Detection (FR-012, FR-015 - classification and badges only; FR-013/014 deferred to WP08)
- Section 5 US-01 (Browse Community Customizations)
- Section 6.1 First Use Flow
- Section 7.1-7.3 Data Models (MasterIndex, SourceEntry, SourceConfig)
- Section 8.2 Settings (sources, indexUrl)

## Tasks

### T03-01 - SourceRegistry service

- **Description**: Implement `src/services/sourceRegistry.ts` that reads source configurations from VS Code settings and the master index URL. Provides CRUD operations and validation for sources.
- **Spec refs**: FR-001 (read master index), FR-002 (add/remove/reorder sources), FR-003 (public/private), FR-004 (validate URLs), FR-005 (default source)
- **Parallel**: Yes (independent of T03-02)
- **Acceptance criteria**:
  - [ ] `SourceRegistry` class accepts `GitHubClient` and `LogOutputChannel` in constructor
  - [ ] `getSources(): SourceConfig[]` reads from `awesome-coding-assistants.sources` setting, merging with sources from master index (fetched via `indexUrl` setting)
  - [ ] `addSource(source: SourceConfig): Promise<void>` validates via `GitHubClient.validateRepo()`, then appends to settings array using `workspace.getConfiguration().update()`
  - [ ] `removeSource(url: string): Promise<void>` filters the source from settings array
  - [ ] `validateSource(source: SourceConfig): Promise<ValidationResult>` delegates to `GitHubClient.validateRepo()`
  - [ ] On `addSource` validation failure, throws `SourceUnreachableError` with the URL
  - [ ] Master index: if `indexUrl` is set and reachable, fetches and parses the JSON, merges `sources` array with user-configured sources (user sources take priority on conflicts by URL)
  - [ ] If `indexUrl` is unreachable or empty, silently falls back to user-configured sources only (no error)
  - [ ] Default source URL `https://github.com/jlacube/awesome-coding-assistants` is included if settings array is empty and no index is configured
  - [ ] Listens to `vscode.workspace.onDidChangeConfiguration` for source setting changes and fires a change event
- **Test requirements**: unit
- **Depends on**: WP02 (GitHubClient, types)
- **Implementation Guidance**:
  - Settings API: `vscode.workspace.getConfiguration('awesome-coding-assistants').get<SourceConfig[]>('sources', [])`
  - Update settings: `vscode.workspace.getConfiguration('awesome-coding-assistants').update('sources', newArray, vscode.ConfigurationTarget.Global)`
  - Master index fetch: `GitHubClient.getFileContent()` with the indexUrl, parse as JSON, validate against MasterIndex type
  - Merge strategy: create a Map keyed by URL, index entries first, then user entries (user wins on collision)
  - Config change listener: `vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration('awesome-coding-assistants.sources')) { ... } })`

### T03-02 - Tool classifier

- **Description**: Implement tool classification logic in `src/services/toolDetector.ts` (partial - just the `classifyItem` function for this WP; workspace detection deferred to WP08). Determines whether a file path belongs to Copilot or Claude Code based on path patterns.
- **Spec refs**: FR-012 (tool detection by path patterns), FR-015 (tool compatibility badge)
- **Parallel**: Yes (independent of T03-01)
- **Acceptance criteria**:
  - [ ] `classifyItem(path: string): ToolClassification` returns `{ tool: 'copilot', category }` for Copilot patterns
  - [ ] `classifyItem(path: string): ToolClassification` returns `{ tool: 'claude-code', category }` for Claude Code patterns
  - [ ] `classifyItem(path: string): ToolClassification` returns `{ tool: 'unknown', category: 'unknown' }` for unrecognized patterns
  - [ ] Copilot patterns detected: `agents/*.agent.md`, `instructions/*.instructions.md`, `skills/*/SKILL.md`, `hooks/*`, `prompts/*.prompt.md`, `plugins/*`, `workflows/*`, `chatmodes/*`
  - [ ] Claude Code patterns detected: `.claude/agents/*.md`, `.claude/rules/*.md`, `CLAUDE.md`, `.claude/commands/*.md`
  - [ ] Category is correctly extracted from path (e.g., `agents/foo.agent.md` -> category `agents`)
  - [ ] Unit tests cover all pattern matches and edge cases
- **Test requirements**: unit (exhaustive pattern matching)
- **Depends on**: T02-01 (ToolClassification, CategoryType types)
- **Implementation Guidance**:
  - Use simple string matching or minimal regex - no external library needed
  - Pattern matching order: check Claude Code patterns first (they include `.claude/` prefix which is unambiguous), then Copilot patterns
  - Edge case: a file like `agents/README.md` should NOT match `agents/*.agent.md`; be precise about extensions
  - Edge case: `CLAUDE.md` at root level is a Claude Code item, category `rules`
  - This module will be extended in WP08 with `detectWorkspaceTools()` for workspace-level detection

### T03-03 - CatalogTreeProvider implementation

- **Description**: Implement `src/providers/catalogTree.ts` as the main `TreeDataProvider<CatalogItem>`. Provides lazy-loaded hierarchical data: Source nodes > Category nodes > Item nodes. Uses GitHubClient to fetch repo tree data on demand.
- **Spec refs**: FR-007 (tree organization), FR-008 (item display), FR-009 (lazy loading), Section 4.2 Implementation Contract
- **Parallel**: No (depends on T03-01, T03-02)
- **Acceptance criteria**:
  - [ ] `CatalogTreeProvider` implements `vscode.TreeDataProvider<CatalogItem>`
  - [ ] `getChildren(undefined)` returns source nodes from SourceRegistry
  - [ ] `getChildren(sourceNode)` fetches repo tree via GitHubClient, groups files into category nodes (Agents, Instructions, Skills, Prompts, Hooks, Commands, Rules, Modes, Plugins)
  - [ ] `getChildren(categoryNode)` returns item nodes for files in that category
  - [ ] `getTreeItem(element)` returns `TreeItem` with: label (item name), description (from file's first non-heading line, fetched lazily), tooltip, icon, contextValue, collapsibleState
  - [ ] Source nodes: collapsible, icon = source icon, contextValue = `catalogItem.source`
  - [ ] Category nodes: collapsible, icon = category icon, contextValue = `catalogItem.category`
  - [ ] Item nodes: none/leaf, icon = tool badge (Copilot/Claude Code/AI), contextValue = `catalogItem.item` or `catalogItem.installed`
  - [ ] `onDidChangeTreeData` event is exposed for refresh
  - [ ] `refresh()` method fires the change event to reload the tree
  - [ ] Empty categories (no matching files) are not shown
  - [ ] Error state: if a source fails to load, show an error child node with the error message
- **Test requirements**: unit (mock GitHubClient, SourceRegistry)
- **Depends on**: T03-01, T03-02, WP02 (GitHubClient)
- **Implementation Guidance**:
  - Tree View API: https://code.visualstudio.com/api/extension-guides/tree-view
  - Lazy loading: `getChildren(sourceNode)` should cache the repo tree response to avoid re-fetching on every expand
  - For descriptions: fetch file content for the first line asynchronously; use `TreeItem.description` (short text beside the name)
  - Tool badge icons: create simple SVG icons in `resources/icons/` - Copilot icon (light/dark), Claude Code icon (light/dark), generic AI icon. Use `TreeItem.iconPath` with theme-aware `{ light, dark }` paths
  - Category grouping: iterate the flat tree from GitHubClient, classify each item with `classifyItem()`, group by category
  - Error child pattern: return a single `TreeItem` with `label: "Error: {message}"`, no collapsible state, error icon

### T03-04 - Activity Bar view container and welcome view

- **Description**: Register the tree view with VS Code using `vscode.window.createTreeView()`. Ensure the Activity Bar icon, view container, and welcome content are working. Wire the welcome view's "Configure Source" button to open settings.
- **Spec refs**: FR-006 (Activity Bar view container), FR-005 (welcome message), Section 6.1 (First Use Flow)
- **Parallel**: No (depends on T03-03)
- **Acceptance criteria**:
  - [ ] Clicking the Activity Bar icon opens the Awesome Coding Assistants sidebar
  - [ ] When no sources are configured, the welcome view shows: "No sources configured.\n[Configure Source Repository](command:workbench.action.openSettings?%5B%22awesome-coding-assistants.sources%22%5D)"
  - [ ] When sources are configured, the tree view shows source nodes
  - [ ] The tree view uses `createTreeView` (not `registerTreeDataProvider`) to get `TreeView` API access for programmatic operations
  - [ ] The view title bar shows correctly as "Awesome Coding Assistants"
- **Test requirements**: integration (verify view registration in extension host)
- **Depends on**: T03-03
- **Implementation Guidance**:
  - `const treeView = vscode.window.createTreeView('awesomeCodingAssistants.catalog', { treeDataProvider: catalogTreeProvider, showCollapseAll: true });`
  - Push `treeView` to `context.subscriptions` for disposal
  - Welcome content is defined in `package.json` `contributes.viewsWelcome` (done in WP01 T01-01), but the `when` clause needs to evaluate correctly: `when: "awesome-coding-assistants.noSources"` - set this context via `vscode.commands.executeCommand('setContext', 'awesome-coding-assistants.noSources', sources.length === 0)`
  - Update context key whenever sources change

### T03-05 - Tree item rendering with tool badges and installed overlay

- **Description**: Create icon assets for tool badges (Copilot, Claude Code, generic AI) and the "installed" indicator. Implement the badge/overlay rendering in tree items.
- **Spec refs**: FR-008 (tool badge), FR-011 (installed badge), FR-015 (tool compatibility badge)
- **Parallel**: No (depends on T03-03)
- **Acceptance criteria**:
  - [ ] `resources/icons/copilot-light.svg` and `resources/icons/copilot-dark.svg` exist (simple recognizable icons)
  - [ ] `resources/icons/claude-light.svg` and `resources/icons/claude-dark.svg` exist
  - [ ] `resources/icons/ai-light.svg` and `resources/icons/ai-dark.svg` exist (generic fallback)
  - [ ] `resources/icons/installed-light.svg` and `resources/icons/installed-dark.svg` exist (checkmark overlay)
  - [ ] Tree items for Copilot customizations show the Copilot icon
  - [ ] Tree items for Claude Code customizations show the Claude Code icon
  - [ ] Tree items with `tool: 'unknown'` show the generic AI icon
  - [ ] Installed items show a different icon variant or a description suffix "[installed]" to indicate installation status
  - [ ] Icons are theme-aware (light icons for dark themes, dark icons for light themes)
- **Test requirements**: none (visual, verified manually)
- **Depends on**: T03-03
- **Implementation Guidance**:
  - SVG icons should be 16x16 or 24x24, single color (#424242 for light, #C5C5C5 for dark) per VS Code icon guidelines
  - For installed overlay: since VS Code TreeItem doesn't support overlays natively, use a separate icon set for installed items (e.g., `copilot-installed-light.svg` with a checkmark) or use `TreeItem.description = "[installed]"`
  - Simpler approach: use `contextValue` to differentiate (`catalogItem.item` vs `catalogItem.installed`) and show the installed indicator via description text
  - Icon path pattern: `{ light: context.asAbsolutePath('resources/icons/copilot-light.svg'), dark: context.asAbsolutePath('resources/icons/copilot-dark.svg') }`
  - Use Codicons (VS Code built-in) where possible: `$(check)` for installed indicator in description

### T03-06 - Refresh command

- **Description**: Wire the `awesome-coding-assistants.refresh` command to the CatalogTreeProvider's refresh method. Invalidate all caches and reload sources.
- **Spec refs**: FR-010 (Refresh command in view title bar)
- **Parallel**: Yes (once T03-03 and T03-04 are done)
- **Acceptance criteria**:
  - [ ] `awesome-coding-assistants.refresh` command invalidates all caches via `CacheManager.invalidate()`
  - [ ] Command fires `CatalogTreeProvider.refresh()` which triggers `onDidChangeTreeData`
  - [ ] The tree view fully reloads with fresh data from GitHub
  - [ ] The refresh button appears in the view title bar (already configured in `package.json` menus from WP01)
  - [ ] During refresh, a progress indicator is shown (or the tree shows a loading state)
- **Test requirements**: unit
- **Depends on**: T03-03, T03-04
- **Implementation Guidance**:
  - Combine cache invalidation with tree refresh: `await cacheManager.invalidate(); catalogTreeProvider.refresh();`
  - Progress indicator: use `vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Refreshing sources...' }, async () => { ... })` or the built-in tree view loading state
  - The refresh icon in the view title bar is set by the menu contribution in `package.json` with `"group": "navigation"`

### T03-07 - Master index reading

- **Description**: Implement the logic to fetch and parse the master index JSON file from the configured `indexUrl`. Merge index sources with user-configured sources in SourceRegistry.
- **Spec refs**: FR-001 (read master index on startup), Section 7.1 (MasterIndex schema)
- **Parallel**: No (integrated into T03-01's logic, this task is about the fetch/parse/validate specifically)
- **Acceptance criteria**:
  - [ ] On extension activation, if `indexUrl` setting is non-empty, fetch the JSON file via GitHubClient
  - [ ] Parse the JSON and validate it matches the `MasterIndex` interface (version, sources array)
  - [ ] If the `version` field indicates an unsupported format, log a warning and skip
  - [ ] Each `SourceEntry` in the index is converted to a `SourceConfig` and merged into the registry
  - [ ] If the index URL is unreachable (network error, 404), log a warning and continue with user-configured sources only; no error shown to user
  - [ ] If the JSON is malformed, log an error and continue with user-configured sources only
- **Test requirements**: unit (mock fetch responses for valid/invalid/unreachable index)
- **Depends on**: T03-01 (SourceRegistry), WP02 (GitHubClient)
- **Implementation Guidance**:
  - Fetch URL: `awesome-coding-assistants.indexUrl` setting, default `https://raw.githubusercontent.com/jlacube/awesome-coding-assistants/main/index.json`
  - Validation: check `typeof json.version === 'string'` and `Array.isArray(json.sources)` before processing
  - Convert SourceEntry to SourceConfig: map `url`, `name`, `branch`, set `authTokenKey` to undefined (index sources are assumed public unless user overrides)
  - This runs once on activation and again on refresh

### T03-08 - Unit and BDD tests for browsing

- **Description**: Write tests covering all browsing scenarios from US-01 acceptance criteria and the BDD scenarios from spec Section 11.2.
- **Spec refs**: Section 11.2 BDD (Browse Source Repositories feature), US-01 Scenarios 1-3
- **Parallel**: No (depends on all T03 tasks)
- **Acceptance criteria**:
  - [ ] Test: configured source with agents/instructions -> tree shows source > categories > items (US-01 Scenario 1)
  - [ ] Test: no sources configured -> welcome view context key is set to true (US-01 Scenario 2)
  - [ ] Test: unreachable source -> error child node appears (US-01 Scenario 3)
  - [ ] Test: tool badges are correctly assigned based on `classifyItem` results
  - [ ] Test: lazy loading - `getChildren(sourceNode)` fetches repo tree; `getChildren(undefined)` does NOT fetch
  - [ ] Test: refresh command invalidates cache and triggers tree reload
  - [ ] Test: master index parsing and merging with user sources
  - [ ] All tests pass with `npm test`
- **Test requirements**: This IS the test deliverable
- **Depends on**: T03-01 through T03-07
- **Implementation Guidance**:
  - Mock GitHubClient to return fixture tree data (a realistic GitHub API tree response with agent/instruction/skill files)
  - Create fixtures: `test/fixtures/tree-response.json` with sample Copilot and Claude Code file paths
  - For welcome view test: verify that `setContext` is called with `awesome-coding-assistants.noSources = true` when no sources configured

## Implementation Notes

- The tree view is the primary user-facing UI - spend extra time on polish (correct icons, clear labels, good error messages)
- Cache the repo tree response per source to avoid re-fetching on every tree expansion
- File descriptions (from frontmatter or first line) should be fetched lazily and cached - don't block tree rendering on description fetches
- The `contextValue` on tree items is critical for menus - it determines which commands appear in right-click and inline actions

## Parallel Opportunities

- T03-01 (SourceRegistry) and T03-02 (Tool classifier) can be worked in parallel
- T03-03 depends on both T03-01 and T03-02
- T03-04, T03-05, T03-06 depend on T03-03 but are somewhat parallelizable (view registration, icons, refresh)
- T03-08 (tests) depends on all other tasks

## Risks & Mitigations

- **Large repo trees**: If a source repo has thousands of files, the tree may be slow. Mitigation: lazy loading (only fetch when expanded), caching, and consider pagination for very large trees (P2).
- **Missing icons**: If SVG icons are not rendering correctly in all themes, fall back to VS Code Codicons. Mitigation: test in both light and dark themes.
- **Index format evolution**: If the master index format changes, the extension should handle gracefully. Mitigation: version check before parsing.

## Activity Log

- 2026-03-15T00:00:00Z - planner - lane=planned - Work package created
