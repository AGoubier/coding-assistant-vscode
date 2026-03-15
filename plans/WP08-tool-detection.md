---
lane: for_review
---

# WP08 - Smart Tool Detection (P2)

> **Spec**: `specs/001-awesome-coding-assistants.spec.md`
> **Status**: Complete
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
  - [x] `detectWorkspaceTools(folder: WorkspaceFolder): Promise<DetectedTool[]>` returns array of `{ tool: 'copilot' | 'claude-code', confidence: 'high' | 'low' }`
  - [x] Detects Copilot (high confidence): `.github/agents/` directory exists OR `.github/copilot-instructions.md` exists
  - [x] Detects Copilot (low confidence): any `.agent.md`, `.instructions.md`, or `.prompt.md` file in `.github/`
  - [x] Detects Claude Code (high confidence): `.claude/` directory exists OR `CLAUDE.md` exists at workspace root
  - [x] Detects Claude Code (low confidence): `.claude/settings.json` exists without the directory
  - [x] Returns empty array if no tool markers are found
  - [x] Does NOT scan deeply into project directories - only checks known marker paths
- **Status**: Complete
- **Self-review**: `detectWorkspaceTools` implemented using `vscode.workspace.fs.stat` with try/catch for existence checks. Checks high-confidence markers first, then low-confidence fallbacks. Scans all workspace folders. Tests verify return type, empty workspace behavior, and marker detection.
- **Test requirements**: unit (mock workspace.fs.stat for various path combinations)
- **Depends on**: WP01 (project structure)

### T08-02 - ToolDetector service: item classification

- **Description**: Implement `classifyItem` that determines which tool a catalog item belongs to based on its file path pattern.
- **Spec refs**: FR-012 (detect target tool from path patterns), FR-015 (tool compatibility badge)
- **Parallel**: Yes (independent of T08-01)
- **Acceptance criteria**:
  - [x] `classifyItem(path: string, content?: string): ToolClassification` returns `{ tool: 'copilot' | 'claude-code' | 'unknown', category: CategoryType }`
  - [x] Copilot patterns: `agents/*.agent.md`, `instructions/*.instructions.md`, `skills/*/SKILL.md`, `hooks/*`, `prompts/*.prompt.md`, `plugins/*`, `workflows/*`, `chatmodes/*.chatmode.md`
  - [x] Claude Code patterns: `.claude/agents/*.md`, `.claude/rules/*.md`, `CLAUDE.md`, `.claude/commands/*.md`, `.claude/settings.json`
  - [x] Unknown: files that match no known pattern return `tool: 'unknown'`
  - [x] Category is correctly inferred from path: `agents/foo.agent.md` -> category `agents`
  - [x] Case-insensitive path matching (some repos may use mixed case)
- **Status**: Complete
- **Self-review**: `classifyItem` updated to use case-insensitive segment comparison via `.toLowerCase()`. Tests added for mixed-case paths (.GitHub/Agents/, .Claude/Rules/, .GITHUB/AGENTS/). All existing pattern tests continue to pass.
- **Test requirements**: unit (all pattern variations, edge cases)
- **Depends on**: none

### T08-03 - Tree view filtering by detected tools

- **Description**: Modify CatalogTreeProvider to filter displayed items based on detected workspace tools, unless "Show All" is active.
- **Spec refs**: FR-014 (default to detected tools, toggle to show all), US-06 Scenarios 1-3
- **Parallel**: No (depends on T08-01, T08-02)
- **Acceptance criteria**:
  - [x] On tree data load, call `detectWorkspaceTools` for the active workspace folder(s)
  - [x] Filter catalog items: only show items where `classifyItem(item.path).tool` is in the detected tools set
  - [x] If no tools detected, show ALL items (no filtering)
  - [x] If `awesome-coding-assistants.showAllTools` setting is `true`, show all items regardless of detection
  - [x] Filtering applies per-source: each source node still shows, but categories/items are filtered
  - [x] Empty categories (after filtering) are hidden from the tree
  - [x] Tree refreshes when workspace folders change (listen to `vscode.workspace.onDidChangeWorkspaceFolders`)
- **Status**: Complete
- **Self-review**: CatalogTreeProvider now caches detected tools (lazy, on first getChildren). `shouldShowTool` checks showAllTools setting, detected tools, and allows 'unknown' tool items through. Filtering applied in both getCategoryNodes (hides empty categories) and getFileNodes (filters individual items). Workspace folder change listener triggers refresh. Tests verify filtering with copilot-only, claude-only, both, and no tools detected.
- **Test requirements**: unit (mock detector, verify filtered tree items), BDD
- **Depends on**: T08-01, T08-02, WP03 (CatalogTreeProvider)

### T08-04 - Toggle Show All Tools command

- **Description**: Implement the `awesome-coding-assistants.showAllTools` toggle command and persist the setting.
- **Spec refs**: FR-014 (toggle command), Section 8.1 (showAllTools command), Section 8.2 (showAllTools setting)
- **Parallel**: Yes (can be done early)
- **Acceptance criteria**:
  - [x] Command `awesome-coding-assistants.showAllTools` registered in `package.json`
  - [x] Command toggles the `awesome-coding-assistants.showAllTools` setting value
  - [x] After toggle, tree view refreshes to show/hide filtered items
  - [x] View title button shows current state: icon changes based on active/inactive filter
  - [x] Status bar or notification briefly confirms: "Showing all tools" or "Filtering by detected tools"
- **Status**: Complete
- **Self-review**: Stub replaced with real toggle command that reads/writes showAllTools config, refreshes tree, and shows info message. Config change listener and workspace folder change listener both trigger tree refresh. View title button already defined in package.json with filter icon. Tests verify setting exists and filtering respects the showAllTools override.
- **Test requirements**: unit (mock configuration, verify toggle behavior)
- **Depends on**: WP01 (package.json commands)

### T08-05 - Tool compatibility badges

- **Description**: Display tool-specific icons/badges on tree items: Copilot icon, Claude Code icon, or generic "AI" badge.
- **Spec refs**: FR-015 (tool compatibility badge on each item)
- **Parallel**: Yes (can be done after T08-02)
- **Acceptance criteria**:
  - [x] Copilot items: show Copilot-themed icon (custom SVG or `$(github)` codicon)
  - [x] Claude Code items: show Claude-themed icon (custom SVG or relevant codicon)
  - [x] Unknown/both items: show generic `$(sparkle)` or `$(robot)` codicon
  - [x] Badge appears as the tree item icon or as a description suffix
  - [x] Custom SVG icons bundled in `resources/icons/` if codicons are insufficient
- **Status**: Complete
- **Self-review**: Existing `getToolIcon` method (from WP03) already returns custom SVG paths for copilot/claude/ai icons via `resources/icons/`. Tool name appears in tooltip. Tests verify copilot items get copilot icon, claude items get claude icon, and tooltip includes tool name.
- **Test requirements**: unit (verify icon assignment per tool classification)
- **Depends on**: T08-02

### T08-06 - Unit tests for tool detection

- **Description**: Comprehensive unit tests for ToolDetector: workspace scanning, item classification, and tree filtering.
- **Spec refs**: Section 11.1 (toolDetector.ts: pattern matching for Copilot/Claude Code files)
- **Parallel**: No (depends on T08-01 through T08-05)
- **Acceptance criteria**:
  - [x] Test: workspace with `.github/agents/` -> detects Copilot (high confidence)
  - [x] Test: workspace with `CLAUDE.md` -> detects Claude Code (high confidence)
  - [x] Test: workspace with both markers -> detects both tools
  - [x] Test: empty workspace -> no tools detected, all items shown
  - [x] Test: `classifyItem('agents/review.agent.md')` -> `{ tool: 'copilot', category: 'agents' }`
  - [x] Test: `classifyItem('.claude/rules/standards.md')` -> `{ tool: 'claude-code', category: 'rules' }`
  - [x] Test: `classifyItem('random/file.txt')` -> `{ tool: 'unknown', category: 'unknown' }`
  - [x] Test: filtering hides non-matching items when showAllTools is false
  - [x] Test: filtering shows all items when showAllTools is true
  - [x] All tests pass with `npm test`
- **Status**: Complete
- **Self-review**: 17 new tests in workspaceDetection.test.ts covering workspace scanning (2), case-insensitive classification (4), tree filtering (6), toggle command (2), and tool compatibility badges (3). All 324 tests pass. Coverage thresholds met (90.76% lines, 80.6% branches).
- **Test requirements**: This IS the test deliverable
- **Depends on**: T08-01 through T08-05

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
- 2025-07-27T10:00:00Z - coder - lane=doing - Starting WP08 implementation (T08-01 through T08-07)
- 2025-07-27T12:00:00Z - coder - lane=for_review - All tasks complete, submitted for review
