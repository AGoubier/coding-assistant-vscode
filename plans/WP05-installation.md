---
lane: for_review
---

# WP05 - Installation and Manifest

> **Spec**: `specs/001-awesome-coding-assistants.spec.md`
> **Status**: Complete
> **Priority**: P1
> **Goal**: Users can install customizations to the correct workspace directory with one click, with conflict resolution, multi-root support, and manifest tracking.
> **Independent Test**: Click Install on a Copilot agent item, verify `.github/agents/{file}` is created. Click Install on a Claude Code rules item, verify `.claude/rules/{file}` is created. Install with an existing file and verify the conflict prompt appears. Check `.vscode/awesome-ca-manifest.json` records the installation.
> **Depends on**: WP01, WP02, WP03
> **Parallelisable**: Yes (can be worked in parallel with WP04)
> **Prompt**: `plans/WP05-installation.md`

## Objective

Implement the installation pipeline: download files from source repos, compute correct target paths per tool/category, create directories, handle conflicts, support multi-root workspaces, and track all installations in a manifest file. This WP delivers US-03 (Install a Customization) and the manifest foundation for US-05 (Track and Update).

## Spec References

- Section 4.5 Installation (FR-020 to FR-027)
- Section 4.6 Lifecycle Management (FR-028 - manifest structure; rest in WP06)
- Section 5 US-03 (Install a Customization), US-04 (Private repos - install path)
- Section 6.2 Install Flow
- Section 7.4-7.5 Data Models (Manifest, InstallationEntry)
- Section 8.1 Commands: `awesome-coding-assistants.install`
- Section 8.4 Error Codes: `INSTALL_FAILED`, `INVALID_PATH`
- Section 10.2 Security (path traversal, content security)

## Tasks

### T05-01 - Target path computation

- **Description**: Build the logic that maps a CatalogItem (tool + category + filename) to the correct workspace-relative target path. Uses the `getTargetPath` function from pathUtils (WP02 T02-03).
- **Spec refs**: FR-021 (target directory mapping - all 10 tool/category combos)
- **Parallel**: Yes
- **Acceptance criteria**:
  - [ ] Copilot agent `code-review.agent.md` maps to `.github/agents/code-review.agent.md`
  - [ ] Copilot instructions `typescript.instructions.md` maps to `.github/instructions/typescript.instructions.md`
  - [ ] Copilot skill directory `code-analysis/` maps to `.github/skills/code-analysis/` (preserving structure)
  - [ ] Copilot prompt `refactor.prompt.md` maps to `.github/prompts/refactor.prompt.md`
  - [ ] Copilot hook `commit-msg` maps to `.github/hooks/commit-msg`
  - [ ] Copilot chat mode `architect.chatmode.md` maps to `.github/chatmodes/architect.chatmode.md`
  - [ ] Claude Code agent `reviewer.md` maps to `.claude/agents/reviewer.md`
  - [ ] Claude Code rule `coding-standards.md` maps to `.claude/rules/coding-standards.md`
  - [ ] Claude Code command `deploy.md` maps to `.claude/commands/deploy.md`
  - [ ] Claude Code CLAUDE.md: target path is determined by user prompt (choose between `CLAUDE.md` and `.claude/CLAUDE.md`)
  - [ ] All paths are validated by `validatePath()` before returning
- **Test requirements**: unit (all 10 mappings + CLAUDE.md special case)
- **Depends on**: WP02 T02-03 (pathUtils)
- **Implementation Guidance**:
  - The `getTargetPath` function in pathUtils handles most mappings; this task integrates it with CatalogItem resolution
  - For CLAUDE.md: when `category === 'rules'` and `filename === 'CLAUDE.md'`, the installer must prompt the user via QuickPick to choose location
  - Preserve the source filename exactly - do not rename files during installation

### T05-02 - Single file installation

- **Description**: Implement `src/services/installer.ts` with core file download and write logic. Downloads a single file from the source repo via GitHubClient and writes it to the computed target path.
- **Spec refs**: FR-020 (Install inline action), FR-022 (auto-create directories)
- **Parallel**: No (depends on T05-01)
- **Acceptance criteria**:
  - [ ] `Installer.installFile(source: SourceConfig, sourcePath: string, targetUri: vscode.Uri): Promise<void>` downloads content via GitHubClient and writes via `vscode.workspace.fs.writeFile()`
  - [ ] Target directory is created automatically with `vscode.workspace.fs.createDirectory()` if it does not exist
  - [ ] File content is written as UTF-8 encoded `Uint8Array`
  - [ ] Path traversal check runs BEFORE any file system operation (FR-027)
  - [ ] On write failure, throws `InstallFailedError` with the target path and error message
  - [ ] Success is logged at info level: "Installed {sourcePath} to {targetPath}"
- **Test requirements**: unit (mock workspace.fs), integration (temp directory)
- **Depends on**: T05-01, WP02 (GitHubClient, pathUtils)
- **Implementation Guidance**:
  - `vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'))` for writing
  - `vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(folderUri, targetDir))` for directory creation
  - Use `vscode.Uri.joinPath(workspaceFolder.uri, targetRelativePath)` to construct the full URI
  - Validate path with `validatePath(targetRelativePath)` before ANY fs operation

### T05-03 - Directory installation (recursive download)

- **Description**: Handle installation of directory-type items (Copilot skills, plugins) that consist of multiple files. Download all files in the source directory recursively and write them preserving structure.
- **Spec refs**: FR-025 (recursive directory download)
- **Parallel**: Yes (once T05-02 is done)
- **Acceptance criteria**:
  - [ ] `Installer.installDirectory(source: SourceConfig, sourceDir: string, targetDirUri: vscode.Uri, repoTree: TreeNode[]): Promise<string[]>` downloads all files under `sourceDir`
  - [ ] Directory structure is preserved: `skills/analysis/SKILL.md`, `skills/analysis/prompts/main.md` -> `.github/skills/analysis/SKILL.md`, `.github/skills/analysis/prompts/main.md`
  - [ ] Returns array of all written file paths
  - [ ] Each file path is validated for traversal before writing
  - [ ] Empty subdirectories are created (gitkeep pattern)
  - [ ] Progress notification shows: "Installing {dirName}: {current}/{total} files"
- **Test requirements**: unit, integration
- **Depends on**: T05-02
- **Implementation Guidance**:
  - Use the repo tree (from GitHubClient.getRepoTree) to list all files under the directory path
  - Filter tree nodes where `node.path.startsWith(sourceDir + '/')` and `node.type === 'blob'`
  - For each file, compute relative path within the directory, join with target dir, and call `installFile`
  - Use `vscode.window.withProgress` to show installation progress

### T05-04 - Conflict resolution

- **Description**: When installing a file that already exists at the target path, prompt the user with three choices: Overwrite, Keep Existing, Show Diff.
- **Spec refs**: FR-023 (conflict resolution: Overwrite, Keep Existing, Show Diff)
- **Parallel**: Yes (once T05-02 is done)
- **Acceptance criteria**:
  - [ ] Before writing, check `vscode.workspace.fs.stat(targetUri)` to detect existing files
  - [ ] If file exists, show QuickPick with options: "Overwrite", "Keep Existing", "Show Diff"
  - [ ] "Overwrite": proceed with writing the new content
  - [ ] "Keep Existing": skip the file, return success without writing
  - [ ] "Show Diff": open VS Code diff editor with `vscode.commands.executeCommand('vscode.diff', existingUri, incomingUri, title)` where incomingUri uses the `awesome-ca-preview` scheme
  - [ ] If user cancels the QuickPick (presses Escape), treat as "Keep Existing"
  - [ ] For directory installs, conflict resolution applies per-file (each conflicting file prompts individually, or use "Apply to all" option)
- **Test requirements**: unit (mock stat, mock QuickPick)
- **Depends on**: T05-02
- **Implementation Guidance**:
  - Check existence: `try { await vscode.workspace.fs.stat(targetUri); exists = true; } catch { exists = false; }`
  - QuickPick: `vscode.window.showQuickPick(['Overwrite', 'Keep Existing', 'Show Diff'], { placeHolder: \`${filename} already exists\` })`
  - Diff view: use `vscode.commands.executeCommand('vscode.diff', existingUri, previewUri, \`${filename}: Installed vs Incoming\`)`
  - For directory installs with multiple conflicts, consider adding "Overwrite All" and "Keep All" options to avoid repeated prompts

### T05-05 - Multi-root workspace folder selection

- **Description**: When multiple workspace folders are open, prompt the user to select the target folder via QuickPick before installation. Single-folder workspaces auto-select without prompt.
- **Spec refs**: FR-024 (prompt for target folder in multi-root)
- **Parallel**: Yes (once T05-02 is done)
- **Acceptance criteria**:
  - [ ] `Installer.selectTargetFolder(): Promise<vscode.WorkspaceFolder | undefined>` checks `vscode.workspace.workspaceFolders`
  - [ ] If exactly 1 folder: return it immediately, no prompt
  - [ ] If 2+ folders: show QuickPick with folder names and paths, return selected folder
  - [ ] If 0 folders (no workspace): show error "No workspace folder open. Please open a folder first." and return undefined
  - [ ] If user cancels QuickPick: return undefined (caller aborts install)
- **Test requirements**: unit (mock workspaceFolders, mock QuickPick)
- **Depends on**: none (can be built independently)
- **Implementation Guidance**:
  - `vscode.workspace.workspaceFolders` is `readonly WorkspaceFolder[] | undefined`
  - QuickPick items should show `${folder.name} - ${folder.uri.fsPath}` for clarity
  - This function is called at the start of every install operation, before path computation

### T05-06 - Manifest read/write

- **Description**: Implement manifest CRUD operations for `.vscode/awesome-ca-manifest.json`. The manifest tracks all installations in a workspace folder.
- **Spec refs**: FR-026 (record installation in manifest), FR-028 (manifest per workspace folder), Section 7.4-7.5 (Manifest, InstallationEntry schemas)
- **Parallel**: Yes (independent of T05-02/03/04)
- **Acceptance criteria**:
  - [ ] `readManifest(folder: WorkspaceFolder): Promise<Manifest>` reads and parses `.vscode/awesome-ca-manifest.json`
  - [ ] If manifest file does not exist, returns `{ version: '1.0', installations: [] }`
  - [ ] If manifest JSON is invalid/corrupted: backs up to `.vscode/awesome-ca-manifest.json.bak`, creates fresh manifest, logs `ManifestCorruptError` internally, notifies user
  - [ ] `writeManifest(folder: WorkspaceFolder, manifest: Manifest): Promise<void>` serializes and writes JSON (pretty-printed with 2-space indent)
  - [ ] `addInstallation(folder: WorkspaceFolder, entry: InstallationEntry): Promise<void>` reads, appends, writes
  - [ ] `removeInstallation(folder: WorkspaceFolder, id: string): Promise<void>` reads, filters, writes
  - [ ] `getInstallation(folder: WorkspaceFolder, id: string): Promise<InstallationEntry | undefined>` lookup by ID
  - [ ] `isInstalled(folder: WorkspaceFolder, sourceUrl: string, itemPath: string): Promise<boolean>` checks if an item is tracked
  - [ ] InstallationEntry `id` format: `{sourceUrl}#{itemPath}` per spec Section 7.5
- **Test requirements**: unit (mock workspace.fs), integration (temp directory)
- **Depends on**: WP02 T02-01 (Manifest, InstallationEntry types), WP02 T02-02 (ManifestCorruptError)
- **Implementation Guidance**:
  - Path: `vscode.Uri.joinPath(folder.uri, '.vscode', 'awesome-ca-manifest.json')`
  - Read: `vscode.workspace.fs.readFile(uri)` -> `Buffer.from(bytes).toString('utf-8')` -> `JSON.parse()`
  - Write: `JSON.stringify(manifest, null, 2)` -> `Buffer.from(json, 'utf-8')` -> `vscode.workspace.fs.writeFile(uri, buffer)`
  - Backup on corruption: `vscode.workspace.fs.rename(manifestUri, backupUri)`
  - Create `.vscode/` directory if it does not exist before writing

### T05-07 - Install command integration

- **Description**: Wire the `awesome-coding-assistants.install` command to orchestrate the full installation flow: folder selection -> path computation -> conflict check -> file download + write -> manifest update -> tree refresh.
- **Spec refs**: FR-020 (Install inline action), Section 6.2 (Install Flow steps 1-9)
- **Parallel**: No (depends on T05-01 through T05-06)
- **Acceptance criteria**:
  - [ ] `awesome-coding-assistants.install` command accepts a `CatalogItem` argument from tree item click
  - [ ] Flow: selectTargetFolder -> getTargetPath -> check conflict -> installFile/installDirectory -> getLatestCommitSha -> recordInstallation -> notify
  - [ ] Commit SHA is fetched via `GitHubClient.getLatestCommitSha()` and stored in the manifest entry
  - [ ] Installation timestamp is set to current ISO 8601 datetime
  - [ ] After successful install, `CatalogTreeProvider.refresh()` is called to update the installed badge
  - [ ] Success notification: "Installed {item.name} to {target.path}"
  - [ ] On failure, shows error notification and does not update manifest
  - [ ] Path traversal is validated before any file operation; `InvalidPathError` triggers "Invalid file path detected. Installation blocked for security."
  - [ ] For CLAUDE.md items, user is prompted to choose between root and `.claude/` location
- **Test requirements**: unit (mock all dependencies), integration
- **Depends on**: T05-01 through T05-06
- **Implementation Guidance**:
  - The command handler function should be in `src/commands/install.ts`
  - Wrap the entire flow in `vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Installing...' })`
  - Error handling: catch all errors, show appropriate notification based on error type (InvalidPathError, InstallFailedError, etc.)
  - After install, update the tree item's `contextValue` to `catalogItem.installed` by refreshing

### T05-08 - Unit and integration tests for installation

- **Description**: Write comprehensive tests covering all installation scenarios from US-03 and the BDD feature block.
- **Spec refs**: Section 11.2 BDD (Install Customization feature), US-03 Scenarios 1-4
- **Parallel**: No (depends on all T05 tasks)
- **Acceptance criteria**:
  - [ ] Test: install Copilot agent to single workspace -> file at `.github/agents/` (US-03 Scenario 1, BDD)
  - [ ] Test: install Claude Code rules to multi-root -> folder selection prompt shown (US-03 Scenario 2, BDD)
  - [ ] Test: install with existing file -> conflict prompt shown (US-03 Scenario 3, BDD)
  - [ ] Test: install skill directory -> recursive download, all files written (US-03 Scenario 4)
  - [ ] Test: path traversal blocked -> `InvalidPathError` thrown (BDD: Path traversal blocked)
  - [ ] Test: manifest updated after successful install
  - [ ] Test: manifest corrupt -> backup created, fresh manifest initialized
  - [ ] Test: no workspace open -> error message shown
  - [ ] Test: user cancels folder selection -> install aborted without error
  - [ ] Integration test: full install flow with mock GitHubClient and real filesystem (temp dir)
  - [ ] All tests pass with `npm test`
- **Test requirements**: This IS the test deliverable
- **Depends on**: T05-01 through T05-07
- **Implementation Guidance**:
  - Use a temp directory as a mock workspace folder for integration tests
  - Create fixture data: mock CatalogItem objects for Copilot agents, Claude Code rules, skill directories
  - Mock GitHubClient to return fixture file content
  - Test manifest roundtrip: install -> read manifest -> verify entry fields match spec Section 7.5

## Implementation Notes

- Path traversal validation is SECURITY-CRITICAL - it must run before any filesystem operation
- The manifest file `.vscode/awesome-ca-manifest.json` is workspace-visible and may be committed to version control; format it nicely (2-space indent)
- For directory installs, consider download parallelism (up to 5 concurrent file downloads)
- The install command should be idempotent: installing the same item twice should trigger the conflict flow, not duplicate manifest entries

## Parallel Opportunities

- T05-01, T05-05, T05-06 are partially independent and can be worked in parallel
- T05-02 depends on T05-01
- T05-03 and T05-04 depend on T05-02 but are parallel with each other
- T05-07 integrates everything
- T05-08 (tests) last

## Risks & Mitigations

- **File permissions**: On some systems, writing to `.github/` may require elevated permissions or git hooks may interfere. Mitigation: use `workspace.fs` API which handles cross-platform concerns.
- **Large directory installs**: Skills with many files may be slow. Mitigation: parallel downloads, progress indicator.
- **Manifest conflicts in multi-user scenarios**: Two users installing different items may cause git merge conflicts in the manifest. Mitigation: manifest JSON format is designed for easy merge (array of objects), but this is inherently a user concern.

## Activity Log

- 2026-03-15T00:00:00Z - planner - lane=planned - Work package created
- 2026-03-15T13:00:00Z - coder - lane=doing - Starting WP05 implementation
- 2026-03-15T13:09:00Z - coder - lane=for_review - All tasks complete, submitted for review

## Self-Review

### Spec Compliance
- [x] FR-020: Install inline action implemented via install command
- [x] FR-021: Target path mapping for all 10 tool/category combos (via getTargetPath in pathUtils)
- [x] FR-022: Auto-create directories before file write
- [x] FR-023: Conflict resolution with Overwrite/Keep/Show Diff
- [x] FR-024: Multi-root workspace folder selection (auto for single, QuickPick for multi)
- [x] FR-025: Recursive directory download for skills/plugins
- [x] FR-026: Installation recorded in manifest with commit SHA and timestamp
- [x] FR-027: Path traversal validation before all filesystem operations
- [x] FR-028: Manifest per workspace folder at .vscode/awesome-ca-manifest.json

### Correctness
- [x] All 228 tests pass (including 33 new tests for WP05)
- [x] Path mappings verified for all tool/category combinations
- [x] Manifest CRUD operations tested (read, write, add, remove, get, isInstalled)
- [x] Corrupt manifest handled with backup and fresh creation
- [x] CLAUDE.md special case prompts user for location choice
- [x] Conflict resolution tested for all three choices

### Code Quality
- [x] No unused code or debug artifacts
- [x] No hardcoded values - all paths use pathUtils constants
- [x] Path traversal validation prevents security issues
- [x] No secrets in code
- [x] Dependency injection for filesystem operations enables testability

### Scope Discipline
- [x] Only implemented what spec requires
- [x] No unasked-for abstractions added

### Encoding
- [x] No em dashes, smart quotes, or curly apostrophes

### Documentation
- [x] docs/architecture.md updated with Installer, ManifestManager, installCommand
- [x] docs/api-reference.md updated with ManifestManager API, Installer API, install command flow
- [x] docs/developer-guide.md updated with new files in project structure
- [x] docs/user-guide.md updated with full Installing Customizations section
- [x] docs/configuration-guide.md reviewed - no changes needed (no new config options)
- [x] docs/deployment-guide.md reviewed - no changes needed (no deployment changes)

### Files Created/Modified
- Created: src/services/manifestManager.ts
- Created: src/services/installer.ts
- Created: src/commands/installCommand.ts
- Modified: src/extension.ts (wiring install command and services)
- Created: test/suite/installer.test.ts
- Updated: docs/architecture.md, docs/api-reference.md, docs/developer-guide.md, docs/user-guide.md
