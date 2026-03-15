---
lane: planned
---

# WP01 - Foundation and Project Scaffolding

> **Spec**: `specs/001-awesome-coding-assistants.spec.md`
> **Status**: Not Started
> **Priority**: P0
> **Goal**: A buildable, lintable, testable VS Code extension project that compiles, bundles, and runs an empty extension host with CI/CD pipeline.
> **Independent Test**: Run `npm install && npm run build && npm test` and verify zero errors. Open VS Code Extension Development Host via F5 and confirm the extension activates without error.
> **Depends on**: none
> **Parallelisable**: No (all other WPs depend on this)
> **Prompt**: `plans/WP01-foundation.md`

## Objective

Set up the complete development environment for the Awesome Coding Assistants VS Code extension. This includes the npm project, TypeScript configuration, esbuild bundler, ESLint, test framework (Mocha + @vscode/test-electron), GitHub Actions CI, a stub extension entry point, and coverage tooling. After this WP, the project is ready for feature development.

## Spec References

- Section 9.2 Technology Stack (TypeScript 5.x, esbuild, ESLint, Mocha + @vscode/test-electron, GitHub Actions)
- Section 9.3 Directory & Module Structure
- Section 8.1 VS Code Commands (contributes.commands for package.json)
- Section 8.2 VS Code Settings (contributes.configuration for package.json)
- Section 12 Constraints (VS Code >= 1.85.0, MIT license, npm)

## Tasks

### T01-01 - Initialize npm project and extension manifest

- **Description**: Create `package.json` with full VS Code extension manifest including `contributes.viewsContainers`, `contributes.views`, `contributes.commands`, `contributes.configuration`, `contributes.menus`, and `activationEvents`. Register all 10 commands from spec Section 8.1, all 6 settings from Section 8.2, the Activity Bar view container, and the catalog tree view with welcome content. Include all devDependencies.
- **Spec refs**: Section 8.1 (commands), Section 8.2 (settings), Section 9.2 (tech stack), Section 9.3 (structure), FR-006 (Activity Bar view container), FR-007 (tree view)
- **Parallel**: No
- **Acceptance criteria**:
  - [ ] `package.json` exists with `name: "awesome-coding-assistants"`, `displayName: "Awesome Coding Assistants"`, `engines.vscode: "^1.85.0"`, `license: "MIT"`
  - [ ] All 10 commands from Section 8.1 are declared in `contributes.commands` with correct IDs and titles
  - [ ] All 6 settings from Section 8.2 are declared in `contributes.configuration` with correct types, defaults, and descriptions
  - [ ] `contributes.viewsContainers.activitybar` declares container `awesome-coding-assistants` with title "Awesome Coding Assistants"
  - [ ] `contributes.views` declares tree view `awesomeCodingAssistants.catalog` inside the container
  - [ ] `contributes.viewsWelcome` provides a welcome message when no sources are configured (FR-005)
  - [ ] `contributes.menus` maps commands to `view/title` and `view/item/context` with correct `when` clauses using `viewItem` context values from spec Section 4.2
  - [ ] `devDependencies` include: `@types/vscode`, `@types/node`, `@types/mocha`, `typescript`, `esbuild`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint`, `@vscode/test-electron`, `mocha`, `c8`
  - [ ] `npm install` succeeds with zero vulnerabilities
- **Test requirements**: none (manifest validated by VS Code at load time)
- **Depends on**: none
- **Implementation Guidance**:
  - Official docs: https://code.visualstudio.com/api/references/extension-manifest
  - Official docs: https://code.visualstudio.com/api/references/contribution-points
  - Tree View API: https://code.visualstudio.com/api/extension-guides/tree-view
  - Use `viewsWelcome` contribution for the empty-state welcome message per spec FR-005
  - View container icon: create a placeholder SVG in `resources/icons/` (simple robot/AI icon outline, 24x24px, single color for theme compatibility)
  - Command `when` clauses must use `viewItem` context values documented in spec Section 4.2: `catalogItem.source`, `catalogItem.category`, `catalogItem.item`, `catalogItem.installed`, `catalogItem.updateAvailable`
  - Set `main: "./dist/extension.js"` (esbuild output) not `./out/`
  - Use `"bundler": "esbuild"` pattern per VS Code extension scaffolding
  - Settings validation: `cacheExpirationMinutes` must declare `minimum: 5, maximum: 43200`; `autoCheckIntervalMinutes` must declare `minimum: 5, maximum: 1440`

### T01-02 - TypeScript configuration and esbuild build script

- **Description**: Create `tsconfig.json` for strict TypeScript compilation targeting ES2022/Node18. Create `esbuild.js` build script that bundles `src/extension.ts` to `dist/extension.js` as a CommonJS module with external `vscode` dependency. Add `build`, `watch`, and `vscode:prepublish` scripts to `package.json`.
- **Spec refs**: Section 9.2 (TypeScript 5.x, esbuild)
- **Parallel**: No (depends on T01-01 for package.json)
- **Acceptance criteria**:
  - [ ] `tsconfig.json` exists with `strict: true`, `target: "ES2022"`, `module: "Node16"`, `moduleResolution: "Node16"`, `outDir: "./out"`, `rootDir: "./src"`, `sourceMap: true`
  - [ ] `esbuild.js` exists and bundles `src/extension.ts` to `dist/extension.js` as `cjs` format with `vscode` as external
  - [ ] `npm run build` compiles TypeScript and produces `dist/extension.js`
  - [ ] `npm run watch` starts esbuild in watch mode
  - [ ] `package.json` scripts include `build`, `watch`, `compile`, `vscode:prepublish`
- **Test requirements**: none (build verification)
- **Depends on**: T01-01
- **Implementation Guidance**:
  - Official docs: https://code.visualstudio.com/api/working-with-extensions/bundling-extension
  - esbuild config pattern: `{ entryPoints: ['src/extension.ts'], bundle: true, outfile: 'dist/extension.js', external: ['vscode'], format: 'cjs', platform: 'node', sourcemap: true }`
  - Tim Heuer's extension uses a similar esbuild setup for reference
  - `tsconfig.json` should exclude `test/` from compilation for the main build; tests compile separately
  - Known pitfall: `module: "Node16"` + `moduleResolution: "Node16"` is required for proper ESM interop in newer TypeScript versions

### T01-03 - ESLint configuration

- **Description**: Configure ESLint with `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` for the TypeScript codebase. Add an `npm run lint` script.
- **Spec refs**: Section 9.2 (ESLint with @typescript-eslint)
- **Parallel**: Yes (independent of T01-02)
- **Acceptance criteria**:
  - [ ] `.eslintrc.json` (or `eslint.config.mjs` for flat config) exists with TypeScript parser and recommended rules
  - [ ] `npm run lint` succeeds with zero errors on the stub codebase
  - [ ] Lint rules include: `no-unused-vars` (warn), `@typescript-eslint/no-explicit-any` (warn), `@typescript-eslint/explicit-function-return-type` (off for now)
- **Test requirements**: none (linting is a build step)
- **Depends on**: T01-01
- **Implementation Guidance**:
  - Official docs: https://typescript-eslint.io/getting-started/
  - Prefer flat config (`eslint.config.mjs`) if using ESLint 9+; otherwise `.eslintrc.json`
  - Extend: `eslint:recommended`, `plugin:@typescript-eslint/recommended`
  - Ignore patterns: `dist/`, `out/`, `node_modules/`, `*.js` (except config files)

### T01-04 - Test framework setup (Mocha + @vscode/test-electron)

- **Description**: Set up the VS Code extension test infrastructure using Mocha and `@vscode/test-electron`. Create test runner configuration, a sample test file that verifies the extension activates, and npm scripts for running tests.
- **Spec refs**: Section 9.2 (Mocha + @vscode/test-electron), Section 11 (Test Requirements)
- **Parallel**: Yes (independent of T01-02, T01-03)
- **Acceptance criteria**:
  - [ ] `test/suite/index.ts` exists with Mocha test runner configuration
  - [ ] `test/suite/extension.test.ts` exists with a basic activation test that verifies the extension exports `activate` and `deactivate`
  - [ ] `test/runTest.ts` exists to launch VS Code with the test suite
  - [ ] `.vscode/launch.json` includes an "Extension Tests" debug configuration
  - [ ] `npm test` launches the VS Code test host and all tests pass
  - [ ] Test output is visible in terminal with pass/fail counts
- **Test requirements**: The test framework itself is the deliverable
- **Depends on**: T01-01
- **Implementation Guidance**:
  - Official docs: https://code.visualstudio.com/api/working-with-extensions/testing-extension
  - @vscode/test-electron docs: https://github.com/microsoft/vscode-test
  - Pattern: `test/runTest.ts` uses `runTests({ extensionDevelopmentPath, extensionTestsPath })` to launch
  - `test/suite/index.ts` configures Mocha with `timeout: 10000`, `ui: 'bdd'`, glob pattern `**/**.test.js`
  - Known pitfall: Tests must be compiled to JS before running; add a separate `tsconfig.test.json` or include test/ in the main tsconfig outDir
  - Known pitfall: Windows paths need normalization in the test runner glob

### T01-05 - GitHub Actions CI workflow

- **Description**: Create a GitHub Actions workflow that installs dependencies, lints, builds, and runs tests on push/PR to `main` and `master`. Use `ubuntu-latest` with Node.js 20. Include `xvfb-run` for headless VS Code test execution on Linux.
- **Spec refs**: Section 9.2 (GitHub Actions)
- **Parallel**: Yes (independent of T01-02/03/04 once T01-01 is done)
- **Acceptance criteria**:
  - [ ] `.github/workflows/ci.yml` exists
  - [ ] Workflow triggers on push to `main`/`master` and on pull requests
  - [ ] Steps: checkout, setup Node.js 20, `npm ci`, `npm run lint`, `npm run build`, `xvfb-run npm test`
  - [ ] Matrix includes `ubuntu-latest` (primary), optionally `windows-latest` and `macos-latest`
  - [ ] Workflow YAML is valid (passes `actionlint` or manual review)
- **Test requirements**: none (CI validates itself)
- **Depends on**: T01-01
- **Implementation Guidance**:
  - Official docs: https://code.visualstudio.com/api/working-with-extensions/continuous-integration
  - `xvfb-run` is required for @vscode/test-electron on Linux (headless display)
  - Pattern: `run: xvfb-run -a npm test` on Linux; direct `npm test` on Windows/macOS
  - Known pitfall: GitHub Actions `ubuntu-latest` may lack display server; `xvfb-run` solves this
  - Cache `node_modules` with `actions/cache` keyed on `package-lock.json` hash

### T01-06 - Extension entry point stub

- **Description**: Create `src/extension.ts` with `activate()` and `deactivate()` functions. The activate function SHALL create a `LogOutputChannel` named "Awesome Coding Assistants" (per spec Section 10.5), register all command stubs as no-op disposables, and log an activation message. Create stub directories for the module structure (empty `index.ts` files).
- **Spec refs**: Section 9.1 (Extension Host entry point), Section 9.3 (Directory structure), Section 10.5 (Observability - LogOutputChannel)
- **Parallel**: No (depends on T01-02 for compilation)
- **Acceptance criteria**:
  - [ ] `src/extension.ts` exports `activate(context: vscode.ExtensionContext)` and `deactivate()`
  - [ ] `activate()` creates `vscode.window.createOutputChannel('Awesome Coding Assistants', { log: true })` and logs "Extension activated"
  - [ ] All 10 commands from Section 8.1 are registered as no-op stubs via `vscode.commands.registerCommand()` and pushed to `context.subscriptions`
  - [ ] Directory structure exists: `src/commands/`, `src/providers/`, `src/services/`, `src/models/`, `src/utils/`
  - [ ] `npm run build` succeeds and `dist/extension.js` is produced
  - [ ] F5 launches Extension Development Host and extension activates without errors
- **Test requirements**: unit (extension.test.ts from T01-04 validates activation)
- **Depends on**: T01-02, T01-04
- **Implementation Guidance**:
  - Official docs: https://code.visualstudio.com/api/references/vscode-api#LogOutputChannel
  - Pattern: `const log = vscode.window.createOutputChannel('Awesome Coding Assistants', { log: true });`
  - Store the output channel in a module-level variable or pass via dependency injection for later use by services
  - Each command stub: `context.subscriptions.push(vscode.commands.registerCommand('awesome-coding-assistants.xxx', () => { log.info('Command xxx not yet implemented'); }))`
  - Create empty barrel files (`index.ts`) in each subdirectory for future exports

### T01-07 - Coverage tooling configuration

- **Description**: Configure `c8` (or `nyc`) code coverage tooling integrated with the Mocha test runner. Set coverage thresholds at 80% line / 90% branch as required by spec. Add `npm run test:coverage` script.
- **Spec refs**: Section 11.1 (Minimum coverage: 80% line, 90% branch)
- **Parallel**: No (depends on T01-04, T01-06 for working tests)
- **Acceptance criteria**:
  - [ ] `.c8rc.json` (or `nyc` config in `package.json`) exists with `lines: 80`, `branches: 90`, `functions: 80`
  - [ ] `npm run test:coverage` runs tests and produces coverage report
  - [ ] Coverage report is generated in `coverage/` directory (lcov + text)
  - [ ] CI workflow updated to run `test:coverage` and upload coverage artifact
  - [ ] Coverage thresholds are enforced: build fails if thresholds are not met
- **Test requirements**: The coverage tooling is the deliverable
- **Depends on**: T01-04, T01-06
- **Implementation Guidance**:
  - c8 docs: https://github.com/bcoe/c8
  - Known pitfall: c8 works with Node.js native V8 coverage, which is simpler than Istanbul/nyc for bundled code
  - Integration with @vscode/test-electron: coverage may need to instrument the compiled output, not the source. Consider using `c8` wrapping the test runner
  - Add `coverage/` to `.gitignore`
  - If c8 integration with VS Code test host is complex, fall back to `nyc` which has broader ecosystem support
  - CI step: `npm run test:coverage` followed by coverage artifact upload

## Implementation Notes

- Use `npx --package yo --package generator-code -- yo code` as a starting point reference, but build from scratch for full control over the manifest
- The `package.json` manifest is the most critical artifact - it declares the entire extension surface area
- All commands are stubs in this WP; they will be wired to real implementations in WP02-WP06
- esbuild is preferred over webpack for build speed and simplicity
- Minimum VS Code 1.85.0 per spec constraint Section 12

## Parallel Opportunities

- T01-03 (ESLint), T01-04 (Test framework), and T01-05 (CI) can all be worked in parallel after T01-01 is complete
- T01-06 depends on T01-02 (needs tsconfig for compilation) and T01-04 (needs test framework for validation)
- T01-07 depends on T01-04 and T01-06 (needs working tests with real code)

## Risks & Mitigations

- **@vscode/test-electron compatibility**: Newer VS Code versions may have breaking changes in the test API. Mitigation: pin `@vscode/test-electron` version and test on CI before upgrading.
- **esbuild + TypeScript strict mode**: Some edge cases with decorators or advanced TS features. Mitigation: keep TypeScript config simple; extension code does not use decorators.
- **c8 + VS Code test host compatibility**: Coverage instrumentation may not work seamlessly with the VS Code test runner. Mitigation: test c8 integration early; fall back to nyc if needed.

## Activity Log

- 2026-03-15T00:00:00Z - planner - lane=planned - Work package created
