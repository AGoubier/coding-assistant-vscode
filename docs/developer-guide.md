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
    providers/           # TreeDataProvider, TextDocumentContentProvider
    services/            # Business logic
      authManager.ts     # SecretStorage token management
      cacheManager.ts    # API response caching with ETags
      githubClient.ts    # GitHub REST API client
    models/              # TypeScript interfaces and types
      types.ts           # All shared type definitions
      errors.ts          # Custom error classes (8 error codes)
    utils/               # Utility functions
      pathUtils.ts       # Path validation, target mapping, URL parsing
  test/
    runTest.ts           # Test launcher
    suite/
      index.ts           # Mocha test runner configuration
      extension.test.ts  # Extension activation tests
  dist/                  # Bundled extension output (esbuild)
  out/                   # TypeScript compiled output (for tests)
  resources/
    icons/               # Extension icons (activity bar, etc.)
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
- **Coverage**: c8 with thresholds (80% lines, 90% branches)
- **Test runner**: `test/runTest.ts` launches a VS Code Extension Development Host
- Tests run inside a real VS Code instance for full API access

### Debug Tests in VS Code

Use the "Extension Tests" launch configuration in `.vscode/launch.json`.

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
