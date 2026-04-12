# Awesome Coding Assistants - Architecture

## System Design

The extension runs entirely within the VS Code extension host process. It makes outbound HTTPS requests to GitHub (REST API and raw.githubusercontent.com) and reads/writes files in the user's workspace and extension global storage. There are no background services, databases, or external runtimes.

## Components

```
Extension Host (src/extension.ts)
  |
  +-- Commands (src/commands/)
  |     +-- installCommand - orchestrates install flow (folder select, conflict, download, manifest)
  |     +-- checkUpdatesCommand - triggers update detection across all workspace folders
  |     +-- updateCommand - shows diff view and applies update on accept
  |     +-- uninstallCommand - confirms and deletes files, removes manifest entry
  |     +-- previewCommand - opens item content in read-only editor
  |     +-- tokenCommands - addToken, removeToken handlers
  |     +-- cacheCommands - clearCache handler
  |     +-- installBundleCommand - installs all items in a bundle sequentially
  |
  +-- Providers (src/providers/)
  |     +-- CatalogTreeProvider - TreeDataProvider for the catalog view; dispatches to folder or category children based on detectFolders() result
  |     +-- PreviewProvider - TextDocumentContentProvider for item preview
  |
  +-- Services (src/services/)
  |     +-- SourceRegistry - reads settings/index, validates sources, multi-index URL fetch and union merge (normalizeIndexUrls, loadMultipleIndexes)
  |     +-- GitHubClient - HTTP client for GitHub API and raw content
  |     +-- CacheManager - in-memory and persistent caching
  |     +-- Installer - file/directory download, target path computation, multi-root folder selection
  |     +-- ConflictResolver - cross-folder conflict detection (detectCrossFolderConflict) and resolution via QuickPick (resolveFolderConflict) (WP17)
  |     +-- ManifestManager - CRUD for .vscode/awesome-ca-manifest.json (installation tracking with full source paths for folder items)
  |     +-- LifecycleManager - update detection (SHA comparison), update application (folder-aware fetch/write), uninstall orchestration (uses targetPaths)
  |     +-- AuthManager - SecretStorage token management
  |     +-- ToolDetector - workspace tool detection, folder discovery (detectFolders, groupByFolder), item classification
  |     +-- BundleParser - parses and validates bundle manifest JSON from source repos
  |     +-- NewContentDetector - tree snapshot diffing for new/removed item detection
  |
  +-- Models (src/models/)
  |     +-- types.ts - shared TypeScript interfaces (CatalogItem union incl. FolderItem, FolderDetectionResult, CrossFolderConflict, ConflictCandidate, MergedSourceList, IndexFetchResult)
  |     +-- errors.ts - custom error classes and IndexErrorCodes (INDEX_FETCH_FAILED, INDEX_SCHEMA_INVALID, INVALID_INDEX_URL_TYPE)
  |
  +-- Utils (src/utils/)
        +-- pathUtils.ts - path computation, traversal validation, folder name formatting (formatFolderName), folder prefix stripping (stripFolderPrefix)
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.x (strict mode) |
| Runtime | VS Code Extension Host (Node.js) |
| Bundler | esbuild (CommonJS output) |
| Linter | ESLint + @typescript-eslint |
| Test Framework | Mocha + @vscode/test-electron |
| Coverage | c8 (V8 native coverage) |
| CI/CD | GitHub Actions |

## Data Flow

1. User configures source repositories in settings or via master index. The `indexUrl` setting accepts an array of strings; legacy single-string values are coerced to arrays at runtime via `normalizeIndexUrls()` (WP19)
2. SourceRegistry resolves and validates source URLs. For multiple index URLs, `loadMultipleIndexes()` fetches all indexes in parallel using `Promise.allSettled()`, validates HTTPS-only, and union-merges source lists with dedup by `sourceKey()` (`url@branch`) using first-seen-wins ordering (WP19)
3. GitHubClient fetches repository trees and file contents via GitHub API
4. CacheManager caches responses using ETags and expiration times
5. ToolDetector.detectFolders() scans the flat tree entry array to identify first-level directories containing `.github/` or `.claude/` subdirectories; groupByFolder() partitions entries by detected folder. Folder prefixes are stripped via stripFolderPrefix() before classification and installation.
6. CatalogTreeProvider renders the catalog tree view from fetched data, inserting a Folder level (Source > Folder > Category > Items) when folders are detected
7. On install: Installer validates paths, strips folder prefixes via stripFolderPrefix() for folder-enabled sources, then ConflictResolver.detectCrossFolderConflict() checks whether another folder's item would resolve to the same workspace path. If a conflict is detected, resolveFolderConflict() presents a QuickPick for the user to choose which folder's version to install. The selected item is downloaded via GitHubClient and written to the workspace. (WP17)
8. ManifestManager records each installation in `.vscode/awesome-ca-manifest.json` with commit SHA, timestamp, itemPath (full source path including folder prefix), and targetPaths (folder-prefix-stripped workspace-relative paths). (WP17)
9. LifecycleManager checks for upstream updates by comparing manifest SHAs with latest GitHub commit SHAs (concurrency limit of 10)
10. On update: LifecycleManager fetches content using the full itemPath from the manifest (preserving folder prefix) and writes to the workspace using the stripped targetPaths. If the source path no longer exists in the repo tree, the user is informed. (WP17)
11. On uninstall: files are deleted at targetPaths locations and manifest entry is removed
12. CatalogTreeProvider discovers bundles from `bundles/*.json` in source repos and displays them under a "Bundles" category
13. On install bundle: each item is installed sequentially with progress, supporting cross-source references and optional/required items
14. Search/filter: CatalogTreeProvider stores a search query and applies `matchesSearch()` to filter items by name, path, tool, and category when rendering the tree
15. New content detection: NewContentDetector compares current tree entries against a globalState baseline; new paths and removed paths are stored in globalState keys (`newContent:new:{url}`, `newContent:removed:{url}`). CatalogTreeProvider merges removed items as synthetic entries and marks new items with a sparkle icon. The TreeView badge shows combined new + removed + update counts.

## Extension Activation

The extension activates lazily. On activation:
1. Creates a LogOutputChannel for structured logging
2. Initializes AuthManager, CacheManager, and GitHubClient services
3. Initializes SourceRegistry (reads configured sources, listens for config changes)
4. Initializes CatalogTreeProvider (lazy-loading tree view for browsing customizations)
5. Registers tree views via `createTreeView` for programmatic access: Activity Bar catalog (`awesomeCodingAssistants.catalog`) and Explorer panel catalog (`awesomeCodingAssistants.explorerCatalog`), both powered by the same CatalogTreeProvider
6. Sets `awesome-coding-assistants.noSources` context key for the welcome view
7. Loads master index from configurable URL(s) -- supports single URL (existing behavior) or multiple URLs with parallel fetch and union merge (WP19). Silently falls back on partial or total failure.
8. Wires token management commands (addToken, removeToken) to AuthManager
9. Wires cache management command (clearCache) to CacheManager
10. Wires refresh command to invalidate caches (including preview cache) and reload the catalog tree
11. Registers PreviewProvider as TextDocumentContentProvider for the `awesome-ca-preview` scheme
12. Wires preview command to open catalog items in read-only editor via PreviewProvider
13. Initializes Installer and ManifestManager services
14. Wires install command to orchestrate full installation flow (folder selection, path computation, conflict resolution, file download, manifest update, tree refresh)
15. Wires checkUpdates command to detect upstream changes across all workspace folders
16. Wires update command to show diff and apply updates
17. Wires uninstall command to delete files and clean up manifest
18. Schedules automatic update checks on activation (configurable interval)
19. Registers showAllTools and showDetectedTools toggle commands to switch between filtered and full catalog views
20. Runs workspace tool detection on tree load (scans for `.github/agents/`, `CLAUDE.md`, etc.) and caches results per folder
21. Listens for workspace folder changes and configuration changes to refresh tool detection and filtering
22. Registers installBundle command for one-click bundle installation with progress and cross-source support
23. Registers search command (InputBox-based keyword search) and clearSearch command for catalog filtering
24. Initializes NewContentDetector (global state-backed tree snapshot diffing) and injects into CatalogTreeProvider
25. During auto-check, compares source trees against baselines to detect new and removed items; updates TreeView badge and shows notification
26. Registers markAllSeen command to clear all new/removed content markers and reset badge

## Security

- No secrets stored in code or settings; GitHub tokens use VS Code SecretStorage
- All HTTP requests use HTTPS exclusively; non-HTTPS index URLs are rejected with a logged warning (NFR-006, WP19)
- Path traversal validation on all file write operations
- Rate limit tracking for GitHub API calls
