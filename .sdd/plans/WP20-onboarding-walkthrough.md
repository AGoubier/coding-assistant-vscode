---
lane: done
depends_on: [WP19]
docs_scope: [architecture, user-guide, developer-guide, changelog]
target_language: TypeScript
target_framework: VS Code Extension API
coverage_code: 80
coverage_branch: 90
---

# WP20 - Onboarding Walkthrough and Enterprise Configuration

| Field | Value |
|-------|-------|
| Spec | `.sdd/specs/003-folder-segregation-and-onboarding.spec.md` |
| Priority | P1 |
| Depends on | WP19 |
| Goal | Register a VS Code walkthrough for first-run onboarding with two steps, add a re-access command, and verify enterprise pre-configuration support |
| Status | Complete |
| Independent Test | Install the extension fresh. Verify the walkthrough auto-opens with two steps. Complete Step 1 by changing the indexUrl setting. Complete Step 2 by opening the catalog view. Run "Awesome Coding Assistants: Get Started" from Command Palette and verify the walkthrough re-opens. |
| Parallelisable | Yes (with WP15, WP16, WP17, WP18 -- only depends on WP19 for indexUrl array setting) |
| Prompt | `plans/WP20-onboarding-walkthrough.md` |

## Objective

This work package adds a VS Code Walkthrough for first-run onboarding that guides new users through configuring their index source URL and browsing the catalog. It also registers a command for re-accessing the walkthrough from the Command Palette. Enterprise pre-configuration via machine-level settings is verified to work with the standard VS Code settings resolution API.

## Spec References

- FR-028, FR-029, FR-030, FR-031 (Section 4.12 - Onboarding Walkthrough)
- FR-032, FR-033 (Section 4.13 - Walkthrough Re-access)
- FR-034, FR-035 (Section 4.14 - Enterprise Pre-configuration)
- US-06 (First-Run Onboarding Experience)
- US-07 (Re-access Walkthrough)
- US-10 (Enterprise Pre-configured Index URL)
- Section 8.7 (API/Interface - IWalkthroughCommand)
- NFR-012 (Accessibility - keyboard navigation)
- Companion artifacts: config-schema.ts (walkthrough contribution schema), error-catalog.ts (WALKTHROUGH_NOT_FOUND)

## Tasks

### T20-01 - Create walkthrough media markdown files

- **Description**: Create two markdown media files for the walkthrough steps: (1) `resources/walkthrough/configure-source.md` -- explains what an index URL is, why configuring one is beneficial, and shows a screenshot or diagram of the settings UI with the index URL field. (2) `resources/walkthrough/browse-catalog.md` -- explains what the catalog contains (agents, prompts, skills, rules from community and enterprise sources), how to browse it using the activity bar icon, and how to install items. Both files SHALL use clear, concise language suitable for first-time users.
- **Spec refs**: FR-031, Section 4.12
- **Parallel**: Yes
- **Acceptance criteria**:
  - [x] FR-031: `resources/walkthrough/configure-source.md` exists and explains what an index URL is and how to configure it
  - [x] FR-031: `resources/walkthrough/browse-catalog.md` exists and explains catalog browsing and item installation
  - [x] Both files use clear, concise language suitable for first-time users
  - [x] Both files render correctly in VS Code's walkthrough media panel (no broken references)
- **Test requirements**: none (static content)
- **Depends on**: none
- **Implementation Guidance**:
  - New files: `resources/walkthrough/configure-source.md`, `resources/walkthrough/browse-catalog.md`
  - Keep markdown simple -- the walkthrough media panel has limited width
  - Use headings, bullet points, and inline code for setting names
  - Do not include images initially (can be added later); markdown-only media is simpler to maintain
  - Reference the setting name `awesome-coding-assistants.indexUrl` in configure-source.md

### T20-02 - Add contributes.walkthroughs to package.json

- **Description**: Add a `contributes.walkthroughs` section to `package.json` with: (1) walkthrough `id: "getStarted"`, `title: "Get Started with Awesome Coding Assistants"`, `description: "Configure your source catalog and browse AI coding assistant customizations."`, (2) Step 1: `id: "configureSource"`, `title: "Configure Your Source"`, `description` explaining index URLs, `media: { markdown: "resources/walkthrough/configure-source.md" }`, `completionEvents: ["onSettingChanged:awesome-coding-assistants.indexUrl"]`, (3) Step 2: `id: "browseCatalog"`, `title: "Browse the Catalog"`, `description` explaining catalog browsing, `media: { markdown: "resources/walkthrough/browse-catalog.md" }`, `completionEvents: ["onView:awesomeCodingAssistants.catalog"]`.
- **Spec refs**: FR-028, FR-029, FR-030, FR-031
- **Parallel**: No (depends on T20-01 for media file paths)
- **Acceptance criteria**:
  - [x] FR-028: `contributes.walkthroughs` array in `package.json` contains exactly one walkthrough with `id: "getStarted"`
  - [x] FR-029: Walkthrough has exactly two steps: `"configureSource"` and `"browseCatalog"`
  - [x] FR-030: Step 1 has `completionEvents: ["onSettingChanged:awesome-coding-assistants.indexUrl"]`
  - [x] FR-030: Step 2 has `completionEvents: ["onView:awesomeCodingAssistants.catalog"]`
  - [x] FR-031: Step 1 media points to `resources/walkthrough/configure-source.md`
  - [x] FR-031: Step 2 media points to `resources/walkthrough/browse-catalog.md`
  - [x] Walkthrough auto-opens on first extension install (native VS Code behavior for declared walkthroughs)
- **Test requirements**: none (declarative JSON, verified via manual testing)
- **Depends on**: T20-01
- **Implementation Guidance**:
  - File to modify: `package.json`, add `"walkthroughs"` key under `"contributes"`
  - VS Code Walkthrough API docs: https://code.visualstudio.com/api/references/contribution-points#contributes.walkthroughs
  - Media must use `{ "markdown": "<relative-path>" }` format for markdown content
  - `completionEvents` values are string arrays with specific prefixes: `onSettingChanged:`, `onView:`

### T20-03 - Register openWalkthrough command in package.json

- **Description**: Add a new command to the `contributes.commands` array in `package.json`: `{ "command": "awesome-coding-assistants.openWalkthrough", "title": "Get Started", "category": "Awesome Coding Assistants" }`. This command SHALL appear in the Command Palette for re-accessing the walkthrough (FR-033).
- **Spec refs**: FR-032, FR-033
- **Parallel**: Yes (can be done with T20-02)
- **Acceptance criteria**:
  - [x] FR-033: Command `awesome-coding-assistants.openWalkthrough` appears in the `contributes.commands` array
  - [x] FR-033: Command title is `"Get Started"` with category `"Awesome Coding Assistants"`
  - [x] Command appears in Command Palette when searching "Awesome Coding Assistants Get Started"
- **Test requirements**: none (declarative JSON)
- **Depends on**: none
- **Implementation Guidance**:
  - File to modify: `package.json`, under `contributes.commands` array
  - Follow the existing command declaration pattern in the file
  - No icon needed for this command

### T20-04 - Implement openWalkthrough command handler

- **Description**: Implement the `awesome-coding-assistants.openWalkthrough` command handler in `src/extension.ts` (or `src/commands/` if the project convention puts command handlers there). The handler SHALL call `vscode.commands.executeCommand('workbench.action.openWalkthrough', 'jlacube.awesome-coding-assistants#getStarted', false)`. The second argument `false` means the walkthrough opens as a tab (not in a side panel). Register the command in the `activate()` function alongside existing command registrations.
- **Spec refs**: FR-032
- **Parallel**: No (depends on T20-03 for command declaration)
- **Acceptance criteria**:
  - [x] FR-032: Handler calls `vscode.commands.executeCommand('workbench.action.openWalkthrough', 'jlacube.awesome-coding-assistants#getStarted', false)`
  - [x] FR-032: Command is registered in the `activate()` function and pushed to `context.subscriptions`
  - [x] Running the command opens the Get Started walkthrough tab
- **Test requirements**: unit
- **Depends on**: T20-03
- **Implementation Guidance**:
  - File to modify: `src/extension.ts` (or `src/commands/` if project convention separates command handlers)
  - Pattern: `const cmd = vscode.commands.registerCommand('awesome-coding-assistants.openWalkthrough', async () => { ... })`
  - Add to `context.subscriptions.push(cmd)` alongside existing command registrations
  - The walkthrough ID format is `${publisherId}.${extensionName}#${walkthroughId}` = `jlacube.awesome-coding-assistants#getStarted`

### T20-05 - Error handling for openWalkthrough command

- **Description**: Add error handling to the `openWalkthrough` command handler. If `executeCommand('workbench.action.openWalkthrough', ...)` throws or rejects (e.g., walkthrough ID not found), the handler SHALL: (1) catch the error, (2) log it at error level via the extension's log output channel, (3) display an information message to the user: "Unable to open the Get Started walkthrough." via `vscode.window.showInformationMessage()`. Add the `WALKTHROUGH_NOT_FOUND` error code to `src/models/errors.ts` as defined in the companion artifact `error-catalog.ts`.
- **Spec refs**: FR-032 (error behavior)
- **Parallel**: Yes (after T20-04)
- **Acceptance criteria**:
  - [x] FR-032 error: If `executeCommand` rejects, error is caught (not propagated to user as unhandled rejection)
  - [x] Error is logged at error level via the extension's output channel
  - [x] User sees `vscode.window.showInformationMessage("Unable to open the Get Started walkthrough.")`
  - [x] `WALKTHROUGH_NOT_FOUND` error code is added to `src/models/errors.ts`
- **Test requirements**: unit
- **Depends on**: T20-04
- **Implementation Guidance**:
  - File to modify: same as T20-04 (the command handler)
  - Wrap the `executeCommand` call in try/catch
  - On catch: log error with `WALKTHROUGH_NOT_FOUND` code, show info message
  - Add `WALKTHROUGH_NOT_FOUND` to `src/models/errors.ts` per companion artifact `error-catalog.ts`

### T20-06 - Ensure walkthrough media files are bundled in VSIX

- **Description**: Update the build configuration to ensure the `resources/walkthrough/` directory and its markdown files are included in the VSIX package. Check `.vscodeignore` to ensure the walkthrough media files are NOT excluded. Verify that `esbuild.js` or the packaging step copies the resources directory to the output. The `resources/` directory path in `package.json` walkthrough steps must match the packaged file locations.
- **Spec refs**: FR-031, C-04
- **Parallel**: Yes
- **Acceptance criteria**:
  - [x] C-04: `resources/walkthrough/` directory is included in the VSIX package
  - [x] `.vscodeignore` does NOT exclude `resources/walkthrough/`
  - [x] After `vsce package`, the VSIX contains the walkthrough markdown files at the expected paths
  - [x] Walkthrough media paths in `package.json` match the packaged file locations
- **Test requirements**: none (verified via packaging test)
- **Depends on**: T20-01, T20-02
- **Implementation Guidance**:
  - File to check: `.vscodeignore`
  - The `resources/` directory is typically included by default; verify no glob excludes it
  - Run `vsce package` locally and inspect the VSIX (it is a ZIP file) to verify contents
  - If `esbuild.js` handles asset copying, verify walkthrough files are included

### T20-07 - Unit tests for openWalkthrough command

- **Description**: Write unit tests for the `openWalkthrough` command handler: (1) verify `executeCommand` is called with the correct walkthrough ID `'jlacube.awesome-coding-assistants#getStarted'` and `false` flag, (2) verify error handling: when `executeCommand` rejects, the handler catches, logs an error, and shows an information message, (3) verify the command is registered in the extension's subscriptions. Test for enterprise pre-configuration (FR-034, FR-035): verify that `vscode.workspace.getConfiguration()` reads `indexUrl` correctly when set at machine level (this is standard VS Code behavior, so the test verifies the code path rather than VS Code internals).
- **Spec refs**: FR-032, FR-033, FR-034, FR-035, US-06, US-07, US-10
- **Parallel**: No (depends on T20-04, T20-05)
- **Acceptance criteria**:
  - [x] Tests cover BDD scenarios from spec Section 11: US-06.1 (first-run walkthrough), US-07.1 (re-access walkthrough)
  - [x] `executeCommand` stub verifies correct walkthrough ID and `toSide=false`
  - [x] Error handling test: `executeCommand` rejects -> error logged + info message shown
  - [x] FR-034, FR-035: `getConfiguration()` respects machine-level `indexUrl` setting (verify code path, not VS Code internals)
  - [x] All tests pass with `npm test`
- **Test requirements**: unit
- **Depends on**: T20-04, T20-05
- **Implementation Guidance**:
  - Extend existing test file or new file: `test/suite/walkthrough.test.ts`
  - Stub `vscode.commands.executeCommand` to verify call arguments
  - Stub `vscode.window.showInformationMessage` to verify error message
  - For enterprise config (FR-034): stub `vscode.workspace.getConfiguration()` to return a pre-configured array and verify the code reads it correctly
  - Use existing mock helpers from `test/helpers/mocks.ts`

## Implementation Notes

- The walkthrough is entirely declarative via `contributes.walkthroughs` in `package.json`. No runtime code manages the walkthrough lifecycle -- VS Code handles rendering, step tracking, auto-open, and completion state internally.
- The only runtime code is the `openWalkthrough` command handler (a few lines in `extension.ts`).
- Enterprise pre-configuration (FR-034, FR-035) requires NO custom code. VS Code's standard settings resolution handles machine-level settings automatically. The extension reads `indexUrl` via `getConfiguration()` which respects the workspace > user > machine precedence.
- The walkthrough depends on WP19 only because Step 1's `completionEvents` references the `indexUrl` setting, and the setting must be an array type for the multi-URL onboarding guidance to make sense.

## Research Context

- VS Code Walkthrough API documentation: walkthroughs are registered via `contributes.walkthroughs` in `package.json`. Each step has an `id`, `title`, `description`, `media` (markdown, image, or SVG), and `completionEvents` array.
- `completionEvents` supports: `onCommand:`, `onSettingChanged:`, `onView:`, `onLink:`, `onContext:`, and `extensionInstalled:` prefixes.
- The `workbench.action.openWalkthrough` command takes `(walkthrough-id, toSide)` where `walkthrough-id` is `${publisher}.${extension-name}#${walkthrough-id}`.
- Existing commands in `extension.ts` are registered via `vscode.commands.registerCommand()` within the `activate()` function and pushed to `context.subscriptions`.
- The `.vscodeignore` file determines what is excluded from the VSIX. The `resources/` directory is typically included.

## Risks & Mitigations

- **Risk**: Walkthrough auto-open may be perceived as intrusive by existing users upgrading. **Mitigation**: VS Code's native walkthrough behavior auto-opens only until steps are completed or dismissed. After one dismissal, it does not re-open.
- **Risk**: Media markdown files may not render correctly in all VS Code themes. **Mitigation**: Use simple markdown without complex formatting. Test in both light and dark themes.
- **Risk**: Enterprise administrators expect `indexUrl` to be lockable via policy. **Mitigation**: Constraint C-01 in the spec explicitly documents that VS Code custom settings cannot be policy-enforced. Document this limitation.

## Activity Log

- 2025-07-20T00:00:00Z - planner - lane=planned - Work package created
- 2026-04-12T00:00:00Z - coder - lane=doing - Starting implementation
- 2026-04-12T00:01:00Z - coder - T20-01 completed - Created walkthrough media markdown files
- 2026-04-12T00:02:00Z - coder - T20-02 completed - Added contributes.walkthroughs to package.json
- 2026-04-12T00:02:00Z - coder - T20-03 completed - Registered openWalkthrough command in package.json
- 2026-04-12T00:03:00Z - coder - T20-04 completed - Implemented openWalkthrough command handler
- 2026-04-12T00:03:00Z - coder - T20-05 completed - Added error handling and WALKTHROUGH_NOT_FOUND error code
- 2026-04-12T00:04:00Z - coder - T20-06 completed - Verified walkthrough media included in VSIX
- 2026-04-12T00:05:00Z - coder - T20-07 completed - Unit tests for walkthrough command (11 tests)
- 2026-04-12T00:06:00Z - coder - lane=for_review - All tasks complete, tests passing (597/597)
- 2026-04-12T00:10:00Z - review-coordinator - lane=done - Verdict: Approved

## Review

> **Reviewed by**: Review Coordinator (v2)
> **Date**: 2026-04-12T00:10:00Z
> **Verdict**: Approved
> **Skills dispatched**: review-spec (PASS), review-architecture (PASS), review-security (PASS), review-quality (PASS), review-performance (PASS), review-tests (PASS), review-deps (PASS), review-docs (PASS)
> **Review round**: 1

### Process Compliance
- [PASS] Spec Compliance Checklist: All 28 acceptance criteria checked across 7 tasks
- [PASS] Activity Log: Consistent lane transitions (planned -> doing -> for_review)
- [PASS] Commit granularity: 4 granular commits for 7 tasks (fd9031f, 9a4a536, 038777a, d740da9)
- [PASS] Encoding: No violations found

### Review Feedback

No FAIL findings. No action required.

### Warnings

No warnings.

### Cross-Correlation Notes

No cross-correlation findings.

### Statistics
| Dimension | Pass | Warn | Fail |
|-----------|------|------|------|
| Process Compliance | 4 | 0 | 0 |
| review-spec | 10 | 0 | 0 |
| review-architecture | 8 | 0 | 0 |
| review-security | 2 | 0 | 0 |
| review-quality | 8 | 0 | 0 |
| review-performance | 0 | 0 | 0 |
| review-tests | 6 | 0 | 0 |
| review-deps | 1 | 0 | 0 |
| review-docs | 1 | 0 | 0 |
| **Total** | **40** | **0** | **0** |
