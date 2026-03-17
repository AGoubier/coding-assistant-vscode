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
| `awesome-coding-assistants.showAllTools` | Toggle Show All Tools | Toggle tool filter on/off |
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
- **addToken**: Prompts for token name and value, stores in SecretStorage
- **removeToken**: Shows QuickPick of stored tokens, deletes selected
- **clearCache**: Purges all cached API responses
- **showAllTools**: Toggles `showAllTools` workspace setting, refreshes catalog tree, shows confirmation message
- **installBundle**: Installs all items in a practice bundle sequentially with progress notification. Handles cross-source references, optional/required items, and cancellation.
- **search**: Opens an InputBox for keyword search. Filters the catalog tree to show only matching items based on name, path, tool type, and category. Uses AND logic for multi-word queries. Sets `awesome-coding-assistants.searchActive` context key.
- **clearSearch**: Clears the active search filter, restores the full unfiltered tree, and resets the `searchActive` context key.
- **markAllSeen**: Clears all `newContent:new:*` and `newContent:removed:*` globalState keys, resets the TreeView badge, and refreshes the tree. Available when `awesome-coding-assistants.hasNewContent` context key is true.

## Extension API

### `activate(context: vscode.ExtensionContext): void`

Entry point called by VS Code when the extension activates. Creates the log output channel, initializes all services (AuthManager, CacheManager, GitHubClient, SourceRegistry, CatalogTreeProvider), registers the tree view, loads the master index, and registers all commands.

### `deactivate(): void`

Called when the extension is deactivated. Currently a no-op.

## Services

### SourceRegistry

Manages configured source repositories. Reads from VS Code settings and the master index URL.

| Method | Signature | Description |
|--------|-----------|-------------|
| `getSources` | `() => SourceConfig[]` | Returns all configured sources, merging user settings with master index |
| `addSource` | `(source: SourceConfig) => Promise<void>` | Validates and adds a source to settings |
| `removeSource` | `(url: string) => Promise<void>` | Removes a source by URL |
| `validateSource` | `(source: SourceConfig) => Promise<ValidationResult>` | Validates a source via GitHubClient |
| `loadMasterIndex` | `() => Promise<void>` | Fetches and parses master index from indexUrl |
| `invalidateCache` | `() => void` | Clears cached master index data |

### ToolDetector (toolDetector)

Classifies file paths into tool type and category, and detects which AI tools are configured in a workspace folder.

| Method | Signature | Description |
|--------|-----------|-------------|
| `classifyItem` | `(path: string) => ToolClassification` | Returns `{ tool, category }` for recognized paths, `{ tool: 'unknown', category: 'unknown' }` for unrecognized. Case-insensitive path matching. |
| `detectWorkspaceTools` | `(folder: WorkspaceFolder) => Promise<DetectedTool[]>` | Scans workspace folder for tool marker files/directories. Returns array of `{ tool, confidence }`. |

**classifyItem recognized patterns:**
- Copilot: `.github/agents/*.agent.md`, `.github/instructions/*.instructions.md`, `.github/skills/*`, `.github/prompts/*.prompt.md`, `.github/hooks/*`, `.github/chatmodes/*`, `.github/plugins/*`, `.github/workflows/*`
- Claude Code: `.claude/agents/*.md`, `.claude/rules/*.md`, `.claude/commands/*.md`, `.claude/hooks/*`, `CLAUDE.md`, `.claude/settings.json`

**detectWorkspaceTools markers:**

| Tool | Confidence | Marker |
|------|-----------|--------|
| Copilot | high | `.github/agents/` directory OR `.github/copilot-instructions.md` |
| Copilot | low | `.github/instructions/`, `.github/prompts/`, `.github/hooks/`, or `.github/skills/` directories |
| Claude Code | high | `.claude/` directory OR `CLAUDE.md` at workspace root |
| Claude Code | low | `.claude/settings.json` without `.claude/` directory |

Returns an empty array if no tool markers are found.

### CatalogTreeProvider

Implements `vscode.TreeDataProvider<TreeElement>` for the main catalog tree view.

| Method | Signature | Description |
|--------|-----------|-------------|
| `getChildren` | `(element?) => Promise<TreeElement[]>` | Returns child nodes (sources at root, categories for source, items for category) |
| `getTreeItem` | `(element) => TreeItem` | Converts a tree element to a VS Code TreeItem with icons, labels, context values, and lazy-fetched descriptions |
| `refresh` | `() => void` | Clears internal tree cache, description cache, and fires `onDidChangeTreeData` |
| `setSearchQuery` | `(query: string) => void` | Sets the active search filter and refreshes the tree. Empty string clears the filter. |
| `getSearchQuery` | `() => string` | Returns the current search query string |

### matchesSearch (exported utility)

```typescript
matchesSearch(item: CatalogFileItem, query: string): boolean
```

Determines whether a catalog item matches a keyword query. Matches against name, path, tool type, and category fields. Multi-word queries use AND logic (all words must match). Empty queries match everything. Case-insensitive.

File item descriptions are fetched lazily via `GitHubClient.getFileContent()` on first access, extracting the first non-heading, non-frontmatter line. Descriptions are cached per file path and do not block tree rendering.

## Tree View Context Values

| Context Value | Description |
|--------------|-------------|
| `catalogItem.source` | A source repository node |
| `catalogItem.category` | A category grouping node |
| `catalogItem.item` | An installable item (not installed) |
| `catalogItem.installed` | An installed item |
| `catalogItem.updateAvailable` | An installed item with an update available |
| `bundleItem` | A practice bundle node (supports "Install Bundle" action) |
| `bundleFileItem` | A file item within a practice bundle |

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
    }
  ]
}
```

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
3. Check for existing file and resolve conflicts (Overwrite/Keep/Show Diff)
4. Download content via GitHubClient and write to workspace
5. Fetch latest commit SHA for version tracking
6. Record installation in manifest
7. Refresh catalog tree to show installed badge
8. Show success notification

**CLAUDE.md special case**: When installing a CLAUDE.md file, user is prompted to choose between project root (`CLAUDE.md`) and `.claude/CLAUDE.md`.

**Error codes**: `INSTALL_FAILED` (write failure), `INVALID_PATH` (path traversal detected).

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
5. On accept: re-download file, update manifest SHA and timestamp, refresh tree

### Uninstall Command Flow

1. Find the installation entry and workspace folder
2. Show confirmation dialog (modal warning)
3. Delete file(s) at target path(s) using `workspace.fs.delete` (graceful if already deleted)
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

Bundles appear as a "Bundles" category under each source that has a `bundles/` directory. Each bundle shows:
- Label: bundle name
- Description: "{N} items" count badge
- Collapsible: expands to show individual bundle items with tool/category info
- Context value: `bundleItem` (enables "Install Bundle" inline action)
