# Awesome Coding Assistants - API Reference

## Commands

| Command ID | Title | Description |
|------------|-------|-------------|
| `awesome-coding-assistants.refresh` | Refresh Sources | Invalidate cache and refetch all sources |
| `awesome-coding-assistants.preview` | Preview Item | Open item content in read-only editor |
| `awesome-coding-assistants.install` | Install Item | Download item to workspace |
| `awesome-coding-assistants.update` | Update Item | Download latest version of installed item |
| `awesome-coding-assistants.uninstall` | Uninstall Item | Remove installed item from workspace |
| `awesome-coding-assistants.checkUpdates` | Check for Updates | Scan all installed items for available updates |
| `awesome-coding-assistants.addToken` | Add GitHub Token | Store a personal access token in SecretStorage |
| `awesome-coding-assistants.removeToken` | Remove GitHub Token | Delete a stored token from SecretStorage |
| `awesome-coding-assistants.clearCache` | Clear Cache | Purge all cached data |
| `awesome-coding-assistants.showAllTools` | Show All Tools | Show all tools regardless of workspace detection |
| `awesome-coding-assistants.showDetectedTools` | Show Detected Tools Only | Re-enable filtering by detected tools (complementary toggle to showAllTools) |
| `awesome-coding-assistants.installBundle` | Install Bundle | Install all items in a practice bundle |
| `awesome-coding-assistants.search` | Search Customizations | Open search input to filter the catalog tree by keyword |
| `awesome-coding-assistants.clearSearch` | Clear Search | Remove the active search filter and restore the full tree |
| `awesome-coding-assistants.markAllSeen` | Mark All as Seen | Dismiss all new/removed content markers and reset badge |

All commands are fully implemented:
- **refresh**: Invalidates all caches, reloads master index, and refreshes the catalog tree
- **preview**: Opens the selected catalog item's content in a read-only editor tab via the `awesome-ca-preview` URI scheme
- **install**: Downloads item to workspace with conflict resolution, multi-root support, and manifest tracking
- **checkUpdates**: Checks all installed items for upstream updates via SHA comparison, updates tree badges
- **update**: Opens diff view of installed vs upstream content, applies update on accept
- **uninstall**: Confirms, deletes installed file(s), removes manifest entry, refreshes tree
- **addToken**: Prompts for token name and value, stores in SecretStorage. Accepts an optional string argument to pre-fill the token name InputBox.
- **removeToken**: Shows QuickPick of stored tokens, deletes selected
- **clearCache**: Purges all cached API responses
- **showAllTools**: Sets `showAllTools` workspace setting to true, refreshes catalog tree, shows confirmation message
- **showDetectedTools**: Sets `showAllTools` workspace setting to false, refreshes catalog tree, shows confirmation message
- **installBundle**: Installs all items in a practice bundle sequentially with progress notification. Handles cross-source references, optional/required items, and cancellation.
- **search**: Opens an InputBox for keyword search. Filters the catalog tree to show only matching items based on name, path, tool type, category, and description. Uses AND logic for multi-word queries. Sets `awesome-coding-assistants.searchActive` context key.
- **clearSearch**: Clears the active search filter, restores the full unfiltered tree, and resets the `searchActive` context key.
- **markAllSeen**: Clears all `newContent:new:*` and `newContent:removed:*` globalState keys, resets the TreeView badge, and refreshes the tree. Available when `awesome-coding-assistants.hasNewContent` context key is true.

## Extension API

### `activate(context: vscode.ExtensionContext): void`

Entry point called by VS Code when the extension activates. Creates the log output channel, initializes all services (AuthManager, CacheManager, GitHubClient, SourceRegistry, CatalogTreeProvider), registers the tree view, loads the master index, and registers all commands.

### `deactivate(): void`

Called when the extension is deactivated. Currently a no-op.

## Services

### SourceRegistry

Manages configured source repositories. Reads from VS Code settings and the master index URL(s). Supports single and multiple index URLs with backward-compatible coercion (WP19).

| Method | Signature | Description |
|--------|-----------|-------------|
| `getSources` | `() => SourceConfig[]` | Returns all configured sources, merging user settings with master index |
| `addSource` | `(source: SourceConfig) => Promise<void>` | Validates and adds a source to settings |
| `removeSource` | `(url: string) => Promise<void>` | Removes a source by URL |
| `validateSource` | `(source: SourceConfig) => Promise<ValidationResult>` | Validates a source via GitHubClient |
| `loadMasterIndex` | `() => Promise<void>` | Fetches and parses master index from configured indexUrl(s). Reads the raw setting, coerces via `normalizeIndexUrls()`, and dispatches to single-fetch or `loadMultipleIndexes()` based on URL count (WP19) |
| `loadMultipleIndexes` | `(urls: string[]) => Promise<MergedSourceList>` | Fetches multiple index JSON files in parallel using `Promise.allSettled()`, validates HTTPS-only (NFR-006), and union-merges source lists with dedup by `sourceKey()` using first-seen-wins ordering (FR-024, FR-025, FR-026) (WP19) |
| `invalidateCache` | `() => void` | Clears cached master index data |

### normalizeIndexUrls (exported utility, WP19)

```typescript
normalizeIndexUrls(raw: unknown, defaultUrls: string[], log?: LogOutputChannel): string[]
```

Coerces the raw `indexUrl` setting value to a validated `string[]`. Implements the coercion state machine: `string` -> `[string]`, `string[]` -> as-is, `undefined` -> `defaultUrls`, invalid type -> `defaultUrls` with logged warning. Logs coercion events at warn level (NFR-017).

### sourceKey (exported utility)

```typescript
sourceKey(source: SourceConfig): string
```

Returns `url@branch` (defaulting to `main`) as the dedup key for source entries. Used by `loadMultipleIndexes()` for first-seen-wins merge and by `getSources()` for collision detection.

### MergedSourceList (WP19)

```typescript
interface MergedSourceList {
  sources: SourceConfig[];        // Union-merged, deduped source list
  fetchResults: IndexFetchResult[]; // Per-URL fetch outcome
}
```

### IndexFetchResult (WP19)

```typescript
interface IndexFetchResult {
  url: string;           // The index URL that was fetched
  success: boolean;      // Whether the fetch and validation succeeded
  sourceCount: number | null; // Number of sources added from this URL (null on failure)
  error: string | null;  // Error message (null on success)
}
```

### IndexErrorCodes (WP19)

Error code constants in `src/models/errors.ts` used for structured logging and error classification (not thrown as exceptions):

| Code | Log Level | Description |
|------|-----------|-------------|
| `INDEX_FETCH_FAILED` | warn | Fetch failure for a single index URL |
| `INDEX_SCHEMA_INVALID` | warn | Fetched JSON fails schema validation |
| `INVALID_INDEX_URL_TYPE` | warn | Setting value is not string or string array |

### ToolDetector (toolDetector)

Classifies file paths into tool type and category, and detects which AI tools are configured in a workspace folder.

| Method | Signature | Description |
|--------|-----------|-------------|
| `classifyItem` | `(path: string) => ToolClassification` | Returns `{ tool, category }` for recognized paths, `{ tool: 'unknown', category: 'unknown' }` for unrecognized. Case-insensitive path matching. Callers must strip folder prefixes via `stripFolderPrefix()` before calling. |
| `detectWorkspaceTools` | `(folder: WorkspaceFolder) => Promise<DetectedTool[]>` | Scans workspace folder for tool marker files/directories. Returns array of `{ tool, confidence }`. |
| `detectFolders` | `(entries: GitHubTreeEntry[]) => FolderDetectionResult[]` | Scans flat tree entries for first-level directories containing `.github/` or `.claude/` subdirectories. Case-sensitive for directory names, case-insensitive for markers. Only first path segment qualifies (FR-002). Pure function, no API calls. |
| `groupByFolder` | `(entries: GitHubTreeEntry[], folders: Set<string>) => Map<string, GitHubTreeEntry[]>` | Partitions entries by folder name. Root-level entries (`.github/`/`.claude/` at repo root) are grouped under `""`. Entries not matching any folder or root pattern are excluded. |

**classifyItem recognized patterns:**
- Copilot: `.github/agents/*.agent.md`, `.github/instructions/*.instructions.md`, `.github/skills/*`, `.github/prompts/*.prompt.md`, `.github/hooks/*.json`, `.github/chatmodes/*`
- Claude Code: `.claude/agents/*`, `.claude/rules/*`, `.claude/commands/*`, `.claude/hooks/*`, `CLAUDE.md`, `.claude/settings.json`

**classifyItem templates/ change**: The `templates/` prefix is no longer stripped inside `classifyItem()`. Callers must use `stripFolderPrefix()` before classification. Passing `templates/.github/agents/x.md` directly returns `{ tool: 'unknown', category: 'unknown' }`.

**Additional ToolType values**: The `ToolType` union also includes `kiro`, `kilocode`, and `opencode` (icon-ready but without classification patterns yet).

**FolderDetectionResult type**:
```typescript
{
  folderName: string;    // Raw directory name (e.g., "frontend-team")
  isDefault: boolean;    // Always false for detected folders
  entries: GitHubTreeEntry[];  // All tree entries under this folder
}
```

**FolderItem type** (new CatalogItem union member):
```typescript
{
  kind: 'folder';         // Discriminant
  source: SourceConfig;   // Parent source
  folderName: string;     // Raw directory name
  displayName: string;    // Formatted name via formatFolderName()
  isDefault: boolean;     // True for the virtual "Default" folder
}
```

**detectWorkspaceTools markers:**

| Tool | Confidence | Marker |
|------|-----------|--------|
| Copilot | high | `.github/agents/` directory OR `.github/copilot-instructions.md` |
| Copilot | low | `.github/instructions/`, `.github/prompts/`, `.github/hooks/`, or `.github/skills/` directories |
| Claude Code | high | `.claude/` directory OR `CLAUDE.md` at workspace root |
| Claude Code | low | `.claude/settings.json` without `.claude/` directory |

Returns an empty array if no tool markers are found.

### CatalogTreeProvider

Implements `vscode.TreeDataProvider<TreeElement>` for the main catalog tree view. The same provider instance powers both the Activity Bar catalog view (`awesomeCodingAssistants.catalog`) and an Explorer panel view (`awesomeCodingAssistants.explorerCatalog`). Both views share the same data and badges.

| Method | Signature | Description |
|--------|-----------|-------------|
| `getChildren` | `(element?) => Promise<TreeElement[]>` | Returns child nodes. Sources at root; folders or categories for a source (depending on detected folders); categories scoped to a folder's entries for folder nodes; items for a category. |
| `getTreeItem` | `(element) => TreeItem` | Converts a tree element to a VS Code TreeItem with icons, labels, context values, and lazy-fetched descriptions |
| `refresh` | `() => void` | Clears internal tree cache, description cache, and fires `onDidChangeTreeData` |
| `setSearchQuery` | `(query: string) => void` | Sets the active search filter and refreshes the tree. Empty string clears the filter. |
| `getSearchQuery` | `() => string` | Returns the current search query string |

### matchesSearch (exported utility)

```typescript
matchesSearch(item: CatalogFileItem, query: string): boolean
```

Determines whether a catalog item matches a keyword query. Matches against name, path, tool type, category, and description fields. Multi-word queries use AND logic (all words must match). Empty queries match everything. Case-insensitive.

File item descriptions are fetched lazily via `GitHubClient.getFileContent()` on first access, extracting the first non-heading, non-frontmatter line. Descriptions are cached per file path and do not block tree rendering.

## Tree View Context Values

| Context Value | Description |
|--------------|-------------|
| `catalogItem.source` | A source repository node |
| `catalogItem.folder` | A folder grouping node (between source and category when folders are detected) |
| `catalogItem.category` | A category grouping node |
| `catalogItem.item` | An installable item (not installed) |
| `catalogItem.installed` | An installed item |
| `catalogItem.updateAvailable` | An installed item with an update available |
| `bundleItem` | A practice bundle node (supports "Install Bundle" action) |
| `bundleFileItem` | A file item within a practice bundle |
| `catalogItem.new` | A newly detected item (not yet seen by user) |
| `catalogItem.removed` | An item removed from upstream source (not installed) |
| `catalogItem.removedInstalled` | A removed item that is still installed locally |

## Preview Provider

### PreviewProvider

Implements `vscode.TextDocumentContentProvider` for the `awesome-ca-preview` URI scheme. Serves remote file content as read-only virtual documents.

| Method | Signature | Description |
|--------|-----------|-------------|
| `provideTextDocumentContent` | `(uri: Uri) => Promise<string>` | Decodes source/branch/path from URI query, fetches content via GitHubClient, caches result |
| `clearCache` | `() => void` | Clears the in-memory content cache (called on Refresh) |

### URI Format

```
awesome-ca-preview:{filename}?source={encodedSourceUrl}&branch={branch}&path={encodedPath}
```

### Utility Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `buildPreviewUri` | `(source: SourceConfig, path: string, filename: string) => Uri` | Constructs a preview URI from source config and file path |
| `decodePreviewUri` | `(uri: Uri) => { sourceUrl, branch, path }` | Decodes source URL, branch, and path from a preview URI |
| `resolvePrimaryFile` | `(directoryPath: string, allPaths: string[]) => string \| undefined` | Resolves the primary file for directory items (SKILL.md > README.md > first .md) |

### Error Handling

On fetch failure, the provider throws `PreviewFetchFailedError` (code: `PREVIEW_FETCH_FAILED`) with user message "Failed to fetch preview: {detail}". The preview command shows this as an error notification.

## Installation Services

### ManifestManager

Manages the `.vscode/awesome-ca-manifest.json` file for tracking installed customizations. Each workspace folder has its own manifest.

| Method | Signature | Description |
|--------|-----------|-------------|
| `readManifest` | `(folder: WorkspaceFolder) => Promise<Manifest>` | Reads and parses manifest; returns empty manifest if file missing |
| `writeManifest` | `(folder: WorkspaceFolder, manifest: Manifest) => Promise<void>` | Serializes and writes manifest (2-space JSON indent) |
| `addInstallation` | `(folder: WorkspaceFolder, entry: InstallationEntry) => Promise<void>` | Adds/replaces an installation entry (idempotent by ID) |
| `removeInstallation` | `(folder: WorkspaceFolder, id: string) => Promise<void>` | Removes an installation entry by ID |
| `getInstallation` | `(folder: WorkspaceFolder, id: string) => Promise<InstallationEntry \| undefined>` | Looks up an installation entry by ID |
| `isInstalled` | `(folder: WorkspaceFolder, sourceUrl: string, itemPath: string) => Promise<boolean>` | Checks if an item is tracked in the manifest |

**Manifest format** (`.vscode/awesome-ca-manifest.json`):
```json
{
  "version": "1.0",
  "installations": [
    {
      "id": "https://github.com/owner/repo#.github/agents/code-review.agent.md",
      "sourceUrl": "https://github.com/owner/repo",
      "sourceBranch": "main",
      "itemPath": ".github/agents/code-review.agent.md",
      "targetPaths": [".github/agents/code-review.agent.md"],
      "tool": "copilot",
      "category": "agents",
      "commitSha": "abc123",
      "installedAt": "2025-07-19T10:00:00.000Z"
    },
    {
      "id": "https://github.com/owner/repo#frontend-team/.github/agents/helper.agent.md",
      "sourceUrl": "https://github.com/owner/repo",
      "sourceBranch": "main",
      "itemPath": "frontend-team/.github/agents/helper.agent.md",
      "targetPaths": [".github/agents/helper.agent.md"],
      "tool": "copilot",
      "category": "agents",
      "commitSha": "def456",
      "installedAt": "2025-07-19T11:00:00.000Z"
    }
  ]
}
```

The second entry (WP17) shows a folder-prefixed item: `itemPath` stores the full source path including the folder prefix, while `targetPaths` stores the stripped workspace path.

**Corruption handling**: If the manifest JSON is invalid, ManifestManager backs up the file to `.bak`, creates a fresh manifest, logs a `ManifestCorruptError`, and notifies the user.

### Installer

Handles file and directory downloads from source repos to workspace directories.

| Method | Signature | Description |
|--------|-----------|-------------|
| `installFile` | `(source, sourcePath, targetUri, targetRelativePath) => Promise<void>` | Downloads and writes a single file; validates path, creates directories |
| `installDirectory` | `(source, sourceDir, targetDirUri, targetDirRelative, repoTree, token, progress) => Promise<string[]>` | Recursively installs all files in a directory; shows progress |
| `fileExists` | `(uri: Uri) => Promise<boolean>` | Checks if a file exists at the given URI |
| `selectTargetFolder` | `() => Promise<WorkspaceFolder \| undefined>` | Prompts for workspace folder in multi-root; auto-selects in single-root |

**Path validation**: All target paths are validated with `validatePath()` before any filesystem operation. Invalid paths throw `InvalidPathError`.

### Install Command Flow

The `awesome-coding-assistants.install` command orchestrates:
1. Select target workspace folder (auto-select or QuickPick for multi-root)
2. Compute target path from tool/category mapping
3. For folder-enabled sources: strip folder prefix via `stripFolderPrefix()` to compute workspace-relative target path (FR-010). Items from the "Default" folder (root-level) are not stripped (FR-011). (WP17)
4. For folder-enabled sources: call `detectCrossFolderConflict()` to check for items from other folders resolving to the same target path. If a conflict is detected, call `resolveFolderConflict()` to show a QuickPick. If the user cancels, skip installation. If the user selects a candidate, use that candidate's `fullSourcePath` as the install source. (WP17)
5. Check for existing file and resolve conflicts (Overwrite/Keep/Show Diff)
6. Download content via GitHubClient and write to workspace
7. Fetch latest commit SHA for version tracking
8. Record installation in manifest with `itemPath` set to the full source path (including folder prefix) and `targetPaths` set to the stripped workspace-relative path (WP17)
9. Refresh catalog tree to show installed badge
10. Show success notification

**CLAUDE.md special case**: When installing a CLAUDE.md file, user is prompted to choose between project root (`CLAUDE.md`) and `.claude/CLAUDE.md`.

**Error codes**: `INSTALL_FAILED` (write failure), `INVALID_PATH` (path traversal detected).

## Conflict Resolution (WP17)

### ConflictResolver (`conflictResolver.ts`)

Detects and resolves cross-folder naming conflicts when items from different source folders strip to the same workspace target path.

| Function | Signature | Description |
|----------|-----------|-------------|
| `detectCrossFolderConflict` | `(itemPath: string, folders: Set<string>, allEntries: GitHubTreeEntry[], manifest: Manifest, source: SourceConfig, log: LogOutputChannel) => CrossFolderConflict \| undefined` | Scans tree entries and manifest for items from other folders that strip to the same target path. Returns undefined if no conflict. O(n) scan, < 10ms at p95 (NFR-005). |
| `resolveFolderConflict` | `(conflict: CrossFolderConflict, log: LogOutputChannel) => Promise<ConflictCandidate \| undefined>` | Shows a QuickPick with one option per conflict candidate. Returns the selected candidate or undefined if dismissed. Logs outcome at info level (NFR-016). |

**CrossFolderConflict type**:
```typescript
{
  targetPath: string;           // The post-strip workspace path that conflicts
  candidates: ConflictCandidate[];  // All candidates (including the item being installed)
}
```

**ConflictCandidate type**:
```typescript
{
  fullSourcePath: string;    // Full path including folder prefix (e.g., "frontend-team/.github/agents/x.md")
  folderName: string;        // Raw folder name (e.g., "frontend-team")
  folderDisplayName: string; // Formatted display name (e.g., "Frontend Team")
  source: SourceConfig;      // Parent source config
}
```

**Detection algorithm**:
1. Strip the folder prefix from `itemPath` to compute `targetPath`
2. If stripping changed nothing (no folder prefix), return undefined
3. Scan `allEntries` for other blob entries from different folders that strip to the same `targetPath`
4. Scan `manifest.installations` for existing entries at the same `targetPath` from a different folder
5. If candidates found, prepend the current item and return the `CrossFolderConflict`

**QuickPick label format**: `"<folderDisplayName>/<filename>"` with description showing the full source path.

## Lifecycle Services

### LifecycleManager

Orchestrates update detection, update application, and uninstallation. Delegates to GitHubClient for API calls, ManifestManager for persistence, and Installer for file operations.

| Method | Signature | Description |
|--------|-----------|-------------|
| `checkForUpdates` | `(folder?: WorkspaceFolder, token?: CancellationToken) => Promise<UpdateCheckResult[]>` | Reads manifest entries, fetches latest commit SHA for each, returns which items have updates |
| `applyUpdate` | `(entry: InstallationEntry, folder: WorkspaceFolder, latestSha: string) => Promise<void>` | Re-downloads file(s), updates manifest entry with new SHA and timestamp |
| `uninstallItem` | `(entry: InstallationEntry, folder: WorkspaceFolder) => Promise<void>` | Deletes file(s) from workspace and removes manifest entry |
| `hasUpdate` | `(entryId: string) => boolean` | Returns true if the entry has a cached update available |
| `getUpdateResult` | `(entryId: string) => UpdateCheckResult \| undefined` | Returns the cached update result for a given entry |
| `clearUpdateCache` | `() => void` | Clears all cached update results |

**UpdateCheckResult type**:
```typescript
{
  entry: InstallationEntry;
  hasUpdate: boolean;
  latestSha: string;
  folder: WorkspaceFolder;
}
```

**Concurrency**: Update checks run with a concurrency limit of 10 parallel requests to avoid rate limiting. Per-item errors do not abort the entire check.

**Auto-check**: When `autoCheckUpdates` is enabled (default: true), the extension runs an update check 5 seconds after activation and then at the configured interval (`autoCheckIntervalMinutes`, default: 60 min).

### Update Command Flow

1. Find the installation entry and workspace folder for the selected item
2. Get the cached update result with the latest SHA
3. Open VS Code diff editor: installed file vs upstream content (via preview scheme)
4. Prompt user to Accept or Reject the update
5. On accept: fetch content using full `itemPath` from manifest (preserves folder prefix for folder items), write to workspace using `targetPaths` (stripped path), update manifest SHA and timestamp, refresh tree (WP17)

### Uninstall Command Flow

1. Find the installation entry and workspace folder
2. Show confirmation dialog (modal warning)
3. Delete file(s) at `targetPaths` locations in workspace using `workspace.fs.delete` (graceful if already deleted) (WP17)
4. Remove manifest entry
5. Refresh tree to remove installed badge

## Practice Bundles

### Bundle Parser (`bundleParser.ts`)

Parses and validates bundle manifest JSON files from `bundles/*.json` in source repos.

| Function | Signature | Description |
|----------|-----------|-------------|
| `parseBundle` | `(content: string, bundleName?: string) => Bundle` | Parses JSON, validates schema, returns Bundle or throws descriptive error |

**Bundle schema**: `{ name: string (1-100 chars), description?: string (0-500 chars), items: BundleItem[] (min 1) }`

**BundleItem schema**: `{ path: string, tool: 'copilot' \| 'claude-code', category: string, sourceUrl?: string, required?: boolean (default: true) }`

### Install Bundle Command Flow

1. Select target workspace folder (same logic as single-item install)
2. For each item in the bundle (sequentially):
   a. Resolve source config (parent source or cross-source via `sourceUrl`)
   b. Compute target path from tool/category mapping
   c. Download and install file via Installer service
   d. Record installation entry in manifest (per-item, not per-bundle)
3. Progress notification: "Installing bundle '{name}': {current}/{total}"
4. Cross-source items with unresolved `sourceUrl`: warn user, skip item
5. Required items that fail: abort remaining installs
6. Optional items that fail: warn and continue
7. Summary: "Installed {N}/{total} items from bundle '{name}'"
8. Cancellable via progress notification

### Bundle Tree Display

## Path Utilities (`pathUtils.ts`)

Pure path computation functions for folder name formatting and prefix stripping.

| Function | Signature | Description |
|----------|-----------|-------------|
| `formatFolderName` | `(rawName: string) => string` | Replaces dashes and underscores with spaces, converts to title case, trims. Returns raw name unchanged if result would be empty (e.g., `"---"`). |
| `stripFolderPrefix` | `(itemPath: string, folders: Set<string>) => string` | Removes the first path segment if it matches a known folder name. Returns original path if no match. |
| `validatePath` | `(filePath: string) => boolean` | Validates path safety (no traversal, no absolute paths, no null bytes). |
| `getTargetDirectory` | `(tool: ToolType, category: CategoryType) => string` | Returns the target directory for a tool/category combination. |
| `getTargetPath` | `(tool: ToolType, category: CategoryType, fileName: string) => string` | Returns the full target path including filename. |
| `parseGitHubUrl` | `(url: string) => { owner: string; repo: string } \| null` | Extracts owner and repo from a GitHub URL. |
| `classifyPath` | `(filePath: string) => { tool: ToolType; category: CategoryType }` | Classifies a file path into tool and category. |
| `isAllowedDomain` | `(url: string) => boolean` | SSRF protection -- checks if URL domain is in the allowed list. |

**formatFolderName examples**:
- `"frontend-team"` -> `"Frontend Team"`
- `"ALLCAPS"` -> `"Allcaps"`
- `"my-cool_project"` -> `"My Cool Project"`
- `"---"` -> `"---"` (empty result fallback)

**stripFolderPrefix examples**:
- `stripFolderPrefix("frontend-team/.github/agents/x.md", new Set(["frontend-team"]))` -> `".github/agents/x.md"`
- `stripFolderPrefix(".github/agents/x.md", new Set(["frontend-team"]))` -> `".github/agents/x.md"` (unchanged)

## Practice Bundles

Bundles appear as a "Bundles" category under each source that has a `bundles/` directory. Each bundle shows:
- Label: bundle name
- Description: "{N} items" count badge
- Collapsible: expands to show individual bundle items with tool/category info
- Context value: `bundleItem` (enables "Install Bundle" inline action)
