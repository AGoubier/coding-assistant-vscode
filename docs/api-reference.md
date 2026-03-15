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

All commands are currently registered as stubs except:
- **refresh**: Invalidates all caches, reloads master index, and refreshes the catalog tree
- **preview**: Opens the selected catalog item's content in a read-only editor tab via the `awesome-ca-preview` URI scheme
- **install**: Downloads item to workspace with conflict resolution, multi-root support, and manifest tracking
- **addToken**: Prompts for token name and value, stores in SecretStorage
- **removeToken**: Shows QuickPick of stored tokens, deletes selected
- **clearCache**: Purges all cached API responses

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

### classifyItem (toolDetector)

Classifies a file path into tool type and category.

| Method | Signature | Description |
|--------|-----------|-------------|
| `classifyItem` | `(path: string) => ToolClassification` | Returns `{ tool, category }` for recognized paths, `{ tool: 'unknown', category: 'unknown' }` for unrecognized |

**Recognized patterns:**
- Copilot: `.github/agents/*.agent.md`, `.github/instructions/*.instructions.md`, `.github/skills/*`, `.github/prompts/*.prompt.md`, `.github/hooks/*`, `.github/chatmodes/*`, `.github/plugins/*`, `.github/workflows/*`
- Claude Code: `.claude/agents/*.md`, `.claude/rules/*.md`, `.claude/commands/*.md`, `CLAUDE.md`, `.claude/settings.json`

### CatalogTreeProvider

Implements `vscode.TreeDataProvider<TreeElement>` for the main catalog tree view.

| Method | Signature | Description |
|--------|-----------|-------------|
| `getChildren` | `(element?) => Promise<TreeElement[]>` | Returns child nodes (sources at root, categories for source, items for category) |
| `getTreeItem` | `(element) => TreeItem` | Converts a tree element to a VS Code TreeItem with icons, labels, context values, and lazy-fetched descriptions |
| `refresh` | `() => void` | Clears internal tree cache, description cache, and fires `onDidChangeTreeData` |

File item descriptions are fetched lazily via `GitHubClient.getFileContent()` on first access, extracting the first non-heading, non-frontmatter line. Descriptions are cached per file path and do not block tree rendering.

## Tree View Context Values

| Context Value | Description |
|--------------|-------------|
| `catalogItem.source` | A source repository node |
| `catalogItem.category` | A category grouping node |
| `catalogItem.item` | An installable item (not installed) |
| `catalogItem.installed` | An installed item |
| `catalogItem.updateAvailable` | An installed item with an update available |

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
