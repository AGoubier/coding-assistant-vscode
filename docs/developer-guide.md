# Awesome Coding Assistants - Developer Guide

## Project Overview

A VS Code extension for discovering, installing, and managing AI coding assistant customizations (agents, skills, prompts, slash commands, etc.) across multiple tools from GitHub-hosted source repositories.

## Prerequisites

- Node.js 20+
- VS Code 1.85.0+
- npm (included with Node.js)

## Local Setup

```bash
# Clone the repository
git clone https://github.com/jlacube/awesome-coding-assistants.git
cd awesome-coding-assistants

# Install dependencies
npm install

# Build the extension
npm run build

# Run linter
npm run lint

# Compile TypeScript (including tests)
npm run compile

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Project Structure

```
awesome-coding-assistants/
  .github/
    workflows/ci.yml     # GitHub Actions CI pipeline
    agents/              # Project agent definitions
  .vscode/
    launch.json          # Debug configurations
  src/
    extension.ts         # Extension entry point (activate/deactivate)
    commands/            # Command handler functions
      tokenCommands.ts   # addToken, removeToken implementations
      cacheCommands.ts   # clearCache implementation
      previewCommand.ts  # preview command handler (WP04)
      installCommand.ts  # install command handler with conflict resolution (WP05)
      checkUpdatesCommand.ts # check for updates command handler (WP06)
      updateCommand.ts     # update command handler with diff view (WP06)
      uninstallCommand.ts  # uninstall command handler (WP06)
    providers/           # TreeDataProvider, TextDocumentContentProvider
      catalogTree.ts     # CatalogTreeProvider (WP03) - main catalog tree view
      previewProvider.ts # PreviewProvider (WP04) - read-only virtual documents
    services/            # Business logic
      authManager.ts     # SecretStorage token management
      cacheManager.ts    # API response caching with ETags
      githubClient.ts    # GitHub REST API client
      installer.ts       # File/directory installer with path validation (WP05)
      lifecycle.ts       # LifecycleManager: update detection, apply, uninstall (WP06)
      manifestManager.ts # Manifest CRUD for installation tracking (WP05)
      sourceRegistry.ts  # Source config management and master index
      toolDetector.ts    # File path to tool/category classification
    models/              # TypeScript interfaces and types
      types.ts           # All shared type definitions
      errors.ts          # Custom error classes (8 error codes)
    utils/               # Utility functions
      pathUtils.ts       # Path validation, target mapping, URL parsing
  test/
    runTest.ts           # Test launcher
    helpers/
      mocks.ts           # Shared test mock helpers
      e2e.ts             # E2E test helpers (fixtures, fetch mocking, temp workspace)
    fixtures/
      api/               # Mock GitHub API responses (tree.json, commits.json)
      contents/           # Sample file contents for E2E tests
    suite/
      index.ts           # Mocha test runner configuration
      extension.test.ts  # Extension activation tests
      authManager.test.ts
      cacheManager.test.ts
      errors.test.ts
      githubClient.test.ts
      pathUtils.test.ts
      toolDetector.test.ts   # Tool classification tests (WP03)
      sourceRegistry.test.ts # Source registry tests (WP03)
      catalogTree.test.ts    # Catalog tree provider tests (WP03)
      previewProvider.test.ts # Preview provider and command tests (WP04)
      installer.test.ts    # Installer, manifest, and install command tests (WP05)
      lifecycle.test.ts    # Lifecycle manager, update, uninstall tests (WP06)
      e2e-browse-install.test.ts  # E2E: browse > preview > install journey (WP07)
      e2e-update-uninstall.test.ts # E2E: update > uninstall journey (WP07)
      integration-github.test.ts  # Integration: GitHubClient + CacheManager + AuthManager (WP07)
      integration-source.test.ts  # Integration: SourceRegistry + GitHubClient (WP07)
      performance.test.ts  # Performance tests: NFR thresholds (WP07)
      security.test.ts     # Security tests: path traversal, HTTPS, credentials (WP07)
      accessibility.test.ts # Accessibility: labels, tooltips, command palette (WP07)
  dist/                  # Bundled extension output (esbuild)
  out/                   # TypeScript compiled output (for tests)
  resources/
    icons/               # Extension icons (activity bar, tool badges)
```

## Build System

- **esbuild** bundles `src/extension.ts` to `dist/extension.js` (CommonJS, Node platform)
- **TypeScript** compiles to `out/` for test execution
- Two tsconfig files:
  - `tsconfig.json` - production compilation (src/ only)
  - `tsconfig.test.json` - test compilation (src/ + test/)

## Testing

- **Framework**: Mocha + @vscode/test-electron
- **Test UI**: BDD (describe/it)
- **Coverage**: c8 with custom Inspector-based collection + v8-to-istanbul. Thresholds: 80% lines, 80% branches, 80% functions, 80% statements.
- **Test runner**: `test/runTest.ts` launches a VS Code Extension Development Host
- Tests run inside a real VS Code instance for full API access

### Test Categories

| Category | Files | Purpose |
|----------|-------|---------|
| Unit | `*.test.ts` (service/provider) | Individual component tests |
| E2E | `e2e-*.test.ts` | Full user journey tests with mocked HTTP |
| Integration | `integration-*.test.ts` | Cross-component integration |
| Performance | `performance.test.ts` | NFR threshold validation |
| Security | `security.test.ts` | Path traversal, HTTPS, credential protection |
| Accessibility | `accessibility.test.ts` | Accessible labels, tooltips, command palette |

### Debug Tests in VS Code

Use the "Extension Tests" launch configuration in `.vscode/launch.json`.

### Accessibility Requirements

All tree view items must have `accessibilityInformation.label` set for screen readers. All icons must have `tooltip` as text equivalent. All commands must be accessible via the Command Palette.

## Coding Conventions

- TypeScript strict mode enabled
- ESLint with @typescript-eslint recommended rules
- No explicit `any` (warning)
- No unused variables (warning)
- Plain ASCII only in all files - no em dashes, smart quotes, or curly apostrophes

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Bundle with esbuild |
| `npm run watch` | Bundle with esbuild in watch mode |
| `npm run compile` | TypeScript compile (for tests) |
| `npm run lint` | Run ESLint |
| `npm test` | Run extension tests |
| `npm run test:coverage` | Run tests with c8 coverage |
| `npm run vscode:prepublish` | Pre-publish build (runs `npm run build`) |

## CI/CD

GitHub Actions runs on push/PR to main/master:
- Lint, build, test on ubuntu-latest, windows-latest, macos-latest
- Coverage reports uploaded as artifacts
- Linux uses `xvfb-run` for headless VS Code test execution
