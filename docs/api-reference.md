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
