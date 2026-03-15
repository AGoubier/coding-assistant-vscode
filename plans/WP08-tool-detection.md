---
lane: planned
---

# WP08 - Smart Tool Detection (P2)

> **Spec**: `specs/001-awesome-coding-assistants.spec.md`
> **Status**: Not Started
> **Priority**: P2
> **Goal**: The extension auto-detects which AI tools (Copilot, Claude Code) are in use in the workspace and filters the catalog to show relevant items by default, with a toggle to show all.
> **Independent Test**: Open a workspace with `.github/agents/` present. Verify the tree defaults to showing Copilot-compatible items. Toggle "Show All" and verify all items appear. Open a workspace with both `.github/agents/` and `.claude/`. Verify both tool items show.
> **Depends on**: WP01, WP02, WP03
> **Parallelisable**: Yes (can be worked after WP03, independent of WP04-WP06)
> **Prompt**: `plans/WP08-tool-detection.md`

## Objective

Implement workspace tool detection and catalog filtering. The extension scans the workspace for tool-specific files/directories, classifies catalog items by tool, and defaults the tree view to showing only relevant items. This delivers US-06 (Smart Tool Detection) and implements FR-012 through FR-015.

## Spec References

- Section 4.3 Tool Format Detection (FR-012 to FR-015)
- Section 5 US-06 (Smart Tool Detection)
- Section 8.1 Commands: `awesome-coding-assistants.showAllTools`
- Section 8.2 Settings: `awesome-coding-assistants.showAllTools`
- Section 9.1 Components: ToolDetector
- Section 9.3 Directory structure: `toolDetector.ts`
- Section 11.1 Unit tests: `toolDetector.ts` pattern matching

## Tasks

### T08-01 - ToolDetector service: workspace scanning

- **Description**: Implement `src/services/toolDetector.ts` with the `detectWorkspaceTools` function that scans workplace folders for tool-specific markers.
- **Spec refs**: FR-013 (auto-detect workspace tools), Implementation Contract
- **Parallel**: No
- **Acceptance criteria**:
  - [ ] `detectWorkspaceTools(folder: WorkspaceFolder): Promise<DetectedTool[]>` returns array of `{ tool: 'copilot' | 'claude-code', confidence: 'high' | 'low' }`
  - [ ] Detects Copilot (high confidence): `.github/agents/` directory exists OR `.github/copilot-instructions.md` exists
  - [ ] Detects Copilot (low confidence): any `.agent.md`, `.instructions.md`, or `.prompt.md` file in `.github/`
  - [ ] Detects Claude Code (high confidence): `.claude/` directory exists OR `CLAUDE.md` exists at workspace root
  - [ ] Detects Claude Code (low confidence): `.claude/settings.json` exists without the directory
  - [ ] Returns empty array if no tool markers are found
  - [ ] Does NOT scan deeply into project directories - only checks known marker paths
- **Test requirements**: unit (mock workspace.fs.stat for various path combinations)
- **Depends on**: WP01 (project structure)
- **Implementation Guidance**:
  - Use `vscode.workspace.fs.stat()` to check existence; catch errors as "not found"
  - Check paths: `.github/agents`, `.github/copilot-instructions.md`, `.claude`, `CLAUDE.md`, `.claude/settings.json`
  - Confidence levels help UI: high = definitely uses the tool, low = might use it
  - scan all workspace folders if multiple are open

### T08-02 - ToolDetector service: item classification

- **Description**: Implement `classifyItem` that determines which tool a catalog item belongs to based on its file path pattern.
- **Spec refs**: FR-012 (detect target tool from path patterns), FR-015 (tool compatibility badge)
- **Parallel**: Yes (independent of T08-01)
- **Acceptance criteria**:
  - [ ] `classifyItem(path: string, content?: string): ToolClassification` returns `{ tool: 'copilot' | 'claude-code' | 'unknown', category: CategoryType }`
  - [ ] Copilot patterns: `agents/*.agent.md`, `instructions/*.instructions.md`, `skills/*/SKILL.md`, `hooks/*`, `prompts/*.prompt.md`, `plugins/*`, `workflows/*`, `chatmodes/*.chatmode.md`
  - [ ] Claude Code patterns: `.claude/agents/*.md`, `.claude/rules/*.md`, `CLAUDE.md`, `.claude/commands/*.md`, `.claude/settings.json`
  - [ ] Unknown: files that match no known pattern return `tool: 'unknown'`
  - [ ] Category is correctly inferred from path: `agents/foo.agent.md` -> category `agents`
  - [ ] Case-insensitive path matching (some repos may use mixed case)
- **Test requirements**: unit (all pattern variations, edge cases)
- **Depends on**: none
- **Implementation Guidance**:
  - Use regex patterns for each tool/category combo
  - Pattern examples: `/^agents\/.*\.agent\.md$/i` for Copilot agents
  - The `content` parameter is reserved for future heuristics (e.g., detecting frontmatter); not used in MVP patterns
  - Return `CategoryType` enum values matching spec Section 7

### T08-03 - Tree view filtering by detected tools

- **Description**: Modify CatalogTreeProvider to filter displayed items based on detected workspace tools, unless "Show All" is active.
- **Spec refs**: FR-014 (default to detected tools, toggle to show all), US-06 Scenarios 1-3
- **Parallel**: No (depends on T08-01, T08-02)
- **Acceptance criteria**:
  - [ ] On tree data load, call `detectWorkspaceTools` for the active workspace folder(s)
  - [ ] Filter catalog items: only show items where `classifyItem(item.path).tool` is in the detected tools set
  - [ ] If no tools detected, show ALL items (no filtering)
  - [ ] If `awesome-coding-assistants.showAllTools` setting is `true`, show all items regardless of detection
  - [ ] Filtering applies per-source: each source node still shows, but categories/items are filtered
  - [ ] Empty categories (after filtering) are hidden from the tree
  - [ ] Tree refreshes when workspace folders change (listen to `vscode.workspace.onDidChangeWorkspaceFolders`)
- **Test requirements**: unit (mock detector, verify filtered tree items), BDD
- **Depends on**: T08-01, T08-02, WP03 (CatalogTreeProvider)
- **Implementation Guidance**:
  - Store detected tools in a service-level cache (refresh on workspace folder changes)
  - In `getChildren()`, after loading catalog items, filter by tool match
  - Use `vscode.workspace.getConfiguration('awesome-coding-assistants').get('showAllTools')` to check toggle

### T08-04 - Toggle Show All Tools command

- **Description**: Implement the `awesome-coding-assistants.showAllTools` toggle command and persist the setting.
- **Spec refs**: FR-014 (toggle command), Section 8.1 (showAllTools command), Section 8.2 (showAllTools setting)
- **Parallel**: Yes (can be done early)
- **Acceptance criteria**:
  - [ ] Command `awesome-coding-assistants.showAllTools` registered in `package.json`
  - [ ] Command toggles the `awesome-coding-assistants.showAllTools` setting value
  - [ ] After toggle, tree view refreshes to show/hide filtered items
  - [ ] View title button shows current state: icon changes based on active/inactive filter
  - [ ] Status bar or notification briefly confirms: "Showing all tools" or "Filtering by detected tools"
- **Test requirements**: unit (mock configuration, verify toggle behavior)
- **Depends on**: WP01 (package.json commands)
- **Implementation Guidance**:
  - Toggle: `const current = config.get('showAllTools'); config.update('showAllTools', !current, ConfigurationTarget.Workspace);`
  - Listen to `vscode.workspace.onDidChangeConfiguration` to trigger tree refresh when setting changes
  - Button in view title: use `view/title` menu contribution with `when` clause

### T08-05 - Tool compatibility badges

- **Description**: Display tool-specific icons/badges on tree items: Copilot icon, Claude Code icon, or generic "AI" badge.
- **Spec refs**: FR-015 (tool compatibility badge on each item)
- **Parallel**: Yes (can be done after T08-02)
- **Acceptance criteria**:
  - [ ] Copilot items: show Copilot-themed icon (custom SVG or `$(github)` codicon)
  - [ ] Claude Code items: show Claude-themed icon (custom SVG or relevant codicon)
  - [ ] Unknown/both items: show generic `$(sparkle)` or `$(robot)` codicon
  - [ ] Badge appears as the tree item icon or as a description suffix
  - [ ] Custom SVG icons bundled in `resources/icons/` if codicons are insufficient
- **Test requirements**: unit (verify icon assignment per tool classification)
- **Depends on**: T08-02
- **Implementation Guidance**:
  - `treeItem.iconPath = new vscode.ThemeIcon('github')` for Copilot
  - If custom icons: `treeItem.iconPath = { light: Uri.joinPath(extensionUri, 'resources/icons/copilot-light.svg'), dark: Uri.joinPath(extensionUri, 'resources/icons/copilot-dark.svg') }`
  - Consider using `treeItem.description` as an alternative: `treeItem.description = '[Copilot]'`

### T08-06 - Unit tests for tool detection

- **Description**: Comprehensive unit tests for ToolDetector: workspace scanning, item classification, and tree filtering.
- **Spec refs**: Section 11.1 (toolDetector.ts: pattern matching for Copilot/Claude Code files)
- **Parallel**: No (depends on T08-01 through T08-05)
- **Acceptance criteria**:
  - [ ] Test: workspace with `.github/agents/` -> detects Copilot (high confidence)
  - [ ] Test: workspace with `CLAUDE.md` -> detects Claude Code (high confidence)
  - [ ] Test: workspace with both markers -> detects both tools
  - [ ] Test: empty workspace -> no tools detected, all items shown
  - [ ] Test: `classifyItem('agents/review.agent.md')` -> `{ tool: 'copilot', category: 'agents' }`
  - [ ] Test: `classifyItem('.claude/rules/standards.md')` -> `{ tool: 'claude-code', category: 'rules' }`
  - [ ] Test: `classifyItem('random/file.txt')` -> `{ tool: 'unknown', category: 'unknown' }`
  - [ ] Test: filtering hides non-matching items when showAllTools is false
  - [ ] Test: filtering shows all items when showAllTools is true
  - [ ] All tests pass with `npm test`
- **Test requirements**: This IS the test deliverable
- **Depends on**: T08-01 through T08-05
- **Implementation Guidance**:
  - Mock `vscode.workspace.fs.stat` to simulate presence/absence of marker files
  - Test all path patterns from FR-012 (both Copilot and Claude Code)
  - Test edge cases: mixed case paths, deeply nested items

## Implementation Notes

- Tool detection runs lazily (on sidebar open or workspace change) - not on every tree item render
- The ToolDetector is designed for extensibility: adding Kiro, KiloCode, OpenCode in future P2 work only requires adding patterns
- Detection results are cached per workspace folder and invalidated on folder change

## Parallel Opportunities

- T08-01 (workspace scanning) and T08-02 (item classification) are independent
- T08-04 (toggle command) can be built early
- T08-05 (badges) only needs T08-02

## Risks & Mitigations

- **False positives in tool detection**: A workspace might have `.github/agents/` for non-Copilot purposes. Mitigation: confidence levels + Show All toggle as escape hatch.
- **Performance on large workspaces**: Scanning for markers should be fast (stat calls only, no directory traversal). Mitigation: check only known marker paths.

## Activity Log

- 2026-03-15T00:00:00Z - planner - lane=planned - Work package created
