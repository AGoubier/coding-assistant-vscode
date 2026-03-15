# Awesome Coding Assistants - Architecture

## System Design

The extension runs entirely within the VS Code extension host process. It makes outbound HTTPS requests to GitHub (REST API and raw.githubusercontent.com) and reads/writes files in the user's workspace and extension global storage. There are no background services, databases, or external runtimes.

## Components

```
Extension Host (src/extension.ts)
  |
  +-- Commands (src/commands/)
  |     Command handler functions for all 10 registered commands
  |
  +-- Providers (src/providers/)
  |     +-- CatalogTreeProvider - TreeDataProvider for the catalog view
  |     +-- PreviewProvider - TextDocumentContentProvider for item preview
  |
  +-- Services (src/services/)
  |     +-- SourceRegistry - reads settings/index, validates sources
  |     +-- GitHubClient - HTTP client for GitHub API and raw content
  |     +-- CacheManager - in-memory and persistent caching
  |     +-- Installer - file download, path computation, conflict detection
  |     +-- LifecycleManager - update tracking and checking
  |     +-- AuthManager - SecretStorage token management
  |     +-- ToolDetector - workspace tool detection
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
6. Installer writes files to workspace directories on install/update
7. LifecycleManager tracks installed items and checks for updates

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
13. Registers stub commands for features not yet implemented (install, update, uninstall)

## Security

- No secrets stored in code or settings; GitHub tokens use VS Code SecretStorage
- All HTTP requests use HTTPS exclusively
- Path traversal validation on all file write operations
- Rate limit tracking for GitHub API calls
