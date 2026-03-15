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
  |
  +-- Providers (src/providers/)
  |     +-- CatalogTreeProvider - TreeDataProvider for the catalog view
  |     +-- PreviewProvider - TextDocumentContentProvider for item preview
  |
  +-- Services (src/services/)
  |     +-- SourceRegistry - reads settings/index, validates sources
  |     +-- GitHubClient - HTTP client for GitHub API and raw content
  |     +-- CacheManager - in-memory and persistent caching
  |     +-- Installer - file/directory download, target path computation, conflict detection, multi-root folder selection
  |     +-- ManifestManager - CRUD for .vscode/awesome-ca-manifest.json (installation tracking)
  |     +-- LifecycleManager - update detection (SHA comparison), update application, uninstall orchestration
  |     +-- AuthManager - SecretStorage token management
  |     +-- ToolDetector - workspace tool detection
  |     +-- BundleParser - parses and validates bundle manifest JSON from source repos
  |
  +-- Models (src/models/)
  |     +-- types.ts - shared TypeScript interfaces
  |     +-- errors.ts - custom error classes
  |
  +-- Utils (src/utils/)
        +-- pathUtils.ts - path computation, traversal validation
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

1. User configures source repositories in settings or via master index
2. SourceRegistry resolves and validates source URLs
3. GitHubClient fetches repository trees and file contents via GitHub API
4. CacheManager caches responses using ETags and expiration times
5. CatalogTreeProvider renders the catalog tree view from fetched data
6. On install: Installer validates paths, downloads content via GitHubClient, writes files to workspace, handles conflicts via QuickPick
7. ManifestManager records each installation in `.vscode/awesome-ca-manifest.json` with commit SHA, timestamp, and target paths
8. LifecycleManager checks for upstream updates by comparing manifest SHAs with latest GitHub commit SHAs (concurrency limit of 10)
9. On update: diff view shows installed vs upstream; on accept, Installer re-downloads and ManifestManager updates SHA
10. On uninstall: files are deleted and manifest entry is removed
11. CatalogTreeProvider discovers bundles from `bundles/*.json` in source repos and displays them under a "Bundles" category
12. On install bundle: each item is installed sequentially with progress, supporting cross-source references and optional/required items

## Extension Activation

The extension activates lazily. On activation:
1. Creates a LogOutputChannel for structured logging
2. Initializes AuthManager, CacheManager, and GitHubClient services
3. Initializes SourceRegistry (reads configured sources, listens for config changes)
4. Initializes CatalogTreeProvider (lazy-loading tree view for browsing customizations)
5. Registers the tree view via `createTreeView` for programmatic access
6. Sets `awesome-coding-assistants.noSources` context key for the welcome view
7. Loads master index from configurable URL (silently falls back on failure)
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
19. Registers showAllTools toggle command to switch between filtered and full catalog views
20. Runs workspace tool detection on tree load (scans for `.github/agents/`, `CLAUDE.md`, etc.) and caches results per folder
21. Listens for workspace folder changes and configuration changes to refresh tool detection and filtering
22. Registers installBundle command for one-click bundle installation with progress and cross-source support

## Security

- No secrets stored in code or settings; GitHub tokens use VS Code SecretStorage
- All HTTP requests use HTTPS exclusively
- Path traversal validation on all file write operations
- Rate limit tracking for GitHub API calls
