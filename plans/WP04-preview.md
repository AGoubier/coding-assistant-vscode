---
lane: for_review
---

# WP04 - Preview

> **Spec**: `specs/001-awesome-coding-assistants.spec.md`
> **Status**: Complete
> **Priority**: P1
> **Goal**: Users can preview any customization file's content in a read-only editor tab before installing it.
> **Independent Test**: Click the preview icon on a tree item, verify a read-only Markdown editor tab opens showing the file content. Try on both a public and private repo item.
> **Depends on**: WP01, WP02, WP03
> **Parallelisable**: Yes (can be worked in parallel with WP05)
> **Prompt**: `plans/WP04-preview.md`

## Objective

Implement the preview functionality that lets users inspect customization file content before deciding to install. Uses a `TextDocumentContentProvider` to serve remote file content as read-only virtual documents within VS Code's native editor.

## Spec References

- Section 4.4 Preview (FR-016 to FR-019)
- Section 5 US-02 (Preview Before Installing)
- Section 6.2 Install Flow (step 2 - preview before install)
- Section 8.1 Commands: `awesome-coding-assistants.preview`
- Section 8.4 Error Codes: `PREVIEW_FETCH_FAILED`

## Tasks

### T04-01 - PreviewProvider (TextDocumentContentProvider)

- **Description**: Implement `src/providers/preview.ts` as a `TextDocumentContentProvider` that serves remote file content under the `awesome-ca-preview` URI scheme. The provider fetches content via GitHubClient when VS Code resolves a virtual document URI.
- **Spec refs**: FR-019 (TextDocumentContentProvider with scheme `awesome-ca-preview`)
- **Parallel**: No
- **Acceptance criteria**:
  - [x] `PreviewProvider` implements `vscode.TextDocumentContentProvider`
  - [x] Registered with `vscode.workspace.registerTextDocumentContentProvider('awesome-ca-preview', provider)`
  - [x] `provideTextDocumentContent(uri: Uri): Promise<string>` decodes source URL, branch, and file path from the URI query parameters
  - [x] Content is fetched via `GitHubClient.getFileContent(source, path)` using the decoded parameters
  - [x] Fetched content is cached by the provider to avoid re-fetching on tab switch
  - [x] On fetch failure, returns a placeholder: `"# Error\n\nFailed to load preview: {error message}"`
  - [x] URI format: `awesome-ca-preview:{filename}?source={encodedSourceUrl}&branch={branch}&path={encodedPath}`
- **Test requirements**: unit (mock GitHubClient)
- **Depends on**: WP02 (GitHubClient), WP03 (CatalogItem types)
- **Implementation Guidance**:
  - VS Code Virtual Documents: https://code.visualstudio.com/api/extension-guides/virtual-documents
  - URI encoding: use `encodeURIComponent` for query params, decode in `provideTextDocumentContent`
  - The URI authority and path determine the editor tab title - use the filename as the path component: `vscode.Uri.parse(\`awesome-ca-preview:${filename}?source=${encodeURIComponent(sourceUrl)}&branch=${branch}&path=${encodeURIComponent(filePath)}\`)`
  - Content caching: maintain a `Map<string, string>` keyed by URI string, cleared on explicit refresh

### T04-02 - Content fetching for public and private repos

- **Description**: Ensure the preview fetch path works correctly for both public repos (via raw.githubusercontent.com) and private repos (via GitHub REST API with authentication). Handle base64 decoding for API responses.
- **Spec refs**: FR-017 (fetch from raw for public, API for private)
- **Parallel**: No (depends on T04-01)
- **Acceptance criteria**:
  - [x] Public repo files are fetched from `raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}` (via GitHubClient.getFileContent from WP02)
  - [x] Private repo files are fetched from `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` with auth headers (via GitHubClient.getFileContent from WP02)
  - [x] Private repo API response `content` field (base64) is correctly decoded to UTF-8 text (via GitHubClient from WP02)
  - [x] If raw.githubusercontent.com is unreachable for a public repo, fallback to the API endpoint (via GitHubClient from WP02)
  - [x] Network errors are caught and thrown as `PreviewFetchFailedError`
- **Test requirements**: unit (mock HTTP for both paths)
- **Depends on**: T04-01, WP02 (GitHubClient - this is largely already handled in GitHubClient.getFileContent)
- **Implementation Guidance**:
  - This task largely validates that `GitHubClient.getFileContent()` from WP02 handles both paths correctly
  - The Contents API returns `{ content: "base64string", encoding: "base64" }` - decode with `Buffer.from(content, 'base64').toString('utf-8')`
  - Error wrapping: catch any GitHubClient error and re-throw as `PreviewFetchFailedError`

### T04-03 - Skill/directory preview (primary file selection)

- **Description**: Handle preview for items that are directories (e.g., Copilot skills, plugins). When the user previews a directory-type item, automatically select and display the primary file.
- **Spec refs**: FR-018 (preview skill directories - primary file)
- **Parallel**: Yes (once T04-01 is done)
- **Acceptance criteria**:
  - [x] For Copilot skill items (directory), preview shows `SKILL.md` content from within the skill directory
  - [x] For directories without a known primary file, preview shows the first `.md` file found, or `README.md` if present
  - [x] If no suitable file is found in the directory, show a message: "No previewable file found in this directory."
  - [x] The primary file selection logic is testable as a pure function
- **Test requirements**: unit
- **Depends on**: T04-01
- **Implementation Guidance**:
  - Primary file priority: `SKILL.md` > `README.md` > first `*.md` file alphabetically
  - The repo tree from GitHubClient already contains the full file listing; filter children of the directory path
  - This may require passing the repo tree to PreviewProvider or having the command handler resolve the primary file before constructing the preview URI

### T04-04 - Preview command and inline tree action

- **Description**: Wire the `awesome-coding-assistants.preview` command to open the preview for a selected tree item. Add inline action icon on tree items for quick preview access.
- **Spec refs**: FR-016 (Preview inline action), Section 8.1 (preview command)
- **Parallel**: No (depends on T04-01, T04-03)
- **Acceptance criteria**:
  - [x] `awesome-coding-assistants.preview` command accepts a `CatalogItem` argument (from tree item click)
  - [x] Command constructs the `awesome-ca-preview:` URI and opens it via `vscode.window.showTextDocument(uri, { preview: true })`
  - [x] Inline action icon (eye icon) appears on item-level tree nodes (contextValue `catalogItem.item` or `catalogItem.installed`) - configured in package.json from WP01
  - [x] The preview tab is labeled with the filename (URI path component)
  - [x] On fetch failure, a notification "Failed to fetch preview: {message}" is shown via `vscode.window.showErrorMessage`
  - [x] Clicking preview on the same item twice does not open a duplicate tab (reuses existing preview via `preview: true`)
- **Test requirements**: unit (verify URI construction and command dispatch)
- **Depends on**: T04-01, T04-03
- **Implementation Guidance**:
  - For Markdown rendering: either use `vscode.commands.executeCommand('markdown.showPreview', uri)` to leverage the built-in Markdown extension, or use `vscode.window.showTextDocument(uri)` to show raw text with syntax highlighting
  - The built-in Markdown preview command may not work with custom URI schemes; if so, fall back to `showTextDocument` which will show the raw Markdown with syntax highlighting (still useful for review)
  - Alternative: open as a text document with `languageId: 'markdown'` for syntax highlighting without rendering
  - Inline icon: configured in `package.json` `menus.view/item/context` with `"group": "inline"` (done in WP01)
  - Use `$(eye)` Codicon for the preview action icon

### T04-05 - Unit and BDD tests for preview

- **Description**: Write tests covering all preview scenarios from US-02 and the BDD feature block.
- **Spec refs**: Section 11.2 BDD (Preview Customization feature), US-02 Scenarios 1-3
- **Parallel**: No (depends on all T04 tasks)
- **Acceptance criteria**:
  - [x] Test: preview public file -> PreviewProvider returns file content (US-02 Scenario 1, BDD: Preview a public file)
  - [x] Test: preview private file with stored token -> content fetched via API (US-02 Scenario 2)
  - [x] Test: preview network failure -> `PreviewFetchFailedError` thrown, error message shown (US-02 Scenario 3, BDD: Preview fails)
  - [x] Test: preview skill directory -> SKILL.md content returned (FR-018)
  - [x] Test: preview URI construction is correct for various source/path combinations
  - [x] Test: PreviewProvider caches content and returns from cache on second call
  - [x] All tests pass with `npm test` (175 tests passing)
- **Test requirements**: This IS the test deliverable
- **Depends on**: T04-01 through T04-04
- **Implementation Guidance**:
  - Mock GitHubClient.getFileContent to return test Markdown content
  - Test error path by mocking getFileContent to throw SourceUnreachableError
  - Verify URI format roundtrip: construct URI -> decode in provider -> verify extracted params match original

## Implementation Notes

- The preview functionality is read-only and low-risk; it does not modify the workspace
- The main design choice is whether to use VS Code's Markdown preview rendering or plain text with syntax highlighting; both are acceptable for MVP
- **Decision**: Used `vscode.window.showTextDocument(uri, { preview: true })` which provides syntax-highlighted Markdown in a read-only tab. The built-in Markdown preview command may not work with custom URI schemes.
- Preview content is cached per-session in the PreviewProvider; the Refresh command clears the preview cache

## Self-Review

### Spec Compliance
- [x] All items in the Spec Compliance Checklist are checked off
- [x] Every SHALL obligation from FR-016 through FR-019 has corresponding code
- [x] PREVIEW_FETCH_FAILED error code returned correctly with proper user/log messages
- [x] Every validation rule from the data model is enforced
- [x] Every acceptance scenario (US-02 S1-S3) has a corresponding test

### Correctness
- [x] All acceptance criteria from the spec are met
- [x] All 175 tests pass (20 new tests for preview)
- [x] Edge cases: special characters in paths, missing sources, empty directories, cache invalidation
- [x] Error paths: network failures throw PreviewFetchFailedError, missing source returns error placeholder

### Code quality
- [x] No unused code, dead imports, or debug artifacts
- [x] No hardcoded values; scheme name is a const, source lookup is dynamic
- [x] No security issues (read-only operation, no file writes, no path traversal risk)
- [x] Logic is understandable without the spec

### Scope discipline
- [x] Implementation matches task requirements exactly
- [x] No unasked-for abstractions added

### Encoding
- [x] No em dashes, smart quotes, or curly apostrophes in any file

### Documentation
- [x] api-reference.md updated with PreviewProvider section
- [x] architecture.md updated with preview wiring in activation sequence
- [x] user-guide.md updated with Preview section and checklist
- [x] developer-guide.md updated with new files in project structure
- Preview content is cached per-session in the PreviewProvider; the user can force refresh via the Refresh command (which calls PreviewProvider's cache clear)

## Parallel Opportunities

- T04-01 is the foundation; T04-02 and T04-03 can be partially parallel after T04-01
- T04-04 integrates T04-01 and T04-03
- T04-05 (tests) depends on all

## Risks & Mitigations

- **Markdown preview with custom URI**: VS Code's built-in Markdown preview may not support the `awesome-ca-preview` scheme. Mitigation: fall back to `showTextDocument` with `languageId: 'markdown'` for syntax-highlighted raw view.
- **Large files**: Files over 1MB may be slow to render. Mitigation: check file size from the tree API response and warn before fetching (spec edge case).

## Activity Log

- 2026-03-15T00:00:00Z - planner - lane=planned - Work package created
- 2025-07-19T08:00:00Z - coder - lane=doing - Starting WP04 implementation
- 2025-07-19T09:00:00Z - coder - lane=for_review - All tasks complete, submitted for review

## Spec Compliance Checklist

### FR-016: Preview inline action
- [x] Preview inline icon (eye) on tree items with contextValue `catalogItem.item` or `catalogItem.installed`
- [x] Clicking opens read-only editor tab with file content

### FR-017: Preview fetch from raw/API
- [x] Public repos fetched from `raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`
- [x] Private repos fetched from `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` with auth
- [x] Base64 decoding for API response content field
- [x] Fallback from raw to API if raw fails for public repos

### FR-018: Preview skill directories (primary file)
- [x] Copilot skill directory previews SKILL.md
- [x] Fallback to README.md, then first *.md alphabetically
- [x] Message when no previewable file found

### FR-019: Preview via TextDocumentContentProvider
- [x] Provider registered with scheme `awesome-ca-preview`
- [x] URI format: `awesome-ca-preview:{filename}?source={encoded}&branch={branch}&path={encoded}`
- [x] Content cached per-session to avoid re-fetch on tab switch
- [x] Error placeholder on fetch failure

### PREVIEW_FETCH_FAILED Error Code
- [x] User message: "Failed to fetch preview: {message}"
- [x] Internal log: "Preview fetch error for {path}: {error}"

### US-02 Acceptance Scenarios
- [x] Scenario 1: Click preview icon -> read-only editor tab shows Markdown content
- [x] Scenario 2: Private repo with valid token -> content fetched and displayed
- [x] Scenario 3: Network failure -> error notification shown

### BDD Scenarios (Section 11.2)
- [x] Preview a public file: read-only editor tab with content
- [x] Preview fails due to network error: notification shown
