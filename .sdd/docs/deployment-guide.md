# Awesome Coding Assistants - Deployment Guide

## Prerequisites

- Node.js 20+
- npm
- VS Code 1.85.0+

## Building

```bash
npm install
npm run build
```

This produces `dist/extension.js` via esbuild.

## Packaging

To create a `.vsix` package for distribution:

```bash
npx @vscode/vsce package
```

## Installation

### From VSIX

1. Open VS Code
2. Cmd/Ctrl+Shift+P -> "Extensions: Install from VSIX..."
3. Select the `.vsix` file

### From Source (Development)

1. Clone the repository
2. Run `npm install && npm run build`
3. Press F5 in VS Code to launch the Extension Development Host

## CI/CD

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs automatically on:
- Push to `main` or `master` branches
- Pull requests targeting `main` or `master`

Pipeline steps:
1. Checkout code
2. Setup Node.js 20
3. `npm ci` (install dependencies)
4. `npm run lint` (ESLint)
5. `npm run build` (esbuild bundle)
6. Tests (with `xvfb-run` on Linux)
7. Coverage report upload

### Matrix

Tests run on: ubuntu-latest, windows-latest, macos-latest.

## Dependencies

All dependencies are devDependencies (no runtime dependencies). The extension is bundled into a single file by esbuild with `vscode` as the only external.
