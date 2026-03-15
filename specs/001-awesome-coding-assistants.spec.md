# Awesome Coding Assistants - Specification

> **Source brief**: `ideas/001-awesome-coding-assistants.md`
> **Feature branch**: `001-awesome-coding-assistants`
> **Status**: Draft
> **Version**: 1.0

---

## 1. Overview

Awesome Coding Assistants is a VS Code extension that serves as a universal browser, installer, and lifecycle manager for AI coding assistant customizations (agents, skills, instructions, prompts, slash commands, hooks, rules, and modes) across multiple tools. Unlike Tim Heuer's vscode-awesome-copilot (which is hardcoded to the single `github/awesome-copilot` repo), this extension supports multiple configurable source repositories - including a configurable default index and user/organization-added repos (public or private). The extension targets MVP support for GitHub Copilot and Claude Code formats, with Kiro, KiloCode, and OpenCode deferred to P2. The ultimate goal is enabling organizations to build and deploy a "practice" of AI-assisted coding best practices, onboarding new teams instantly.

---

## 2. Goals & Success Criteria

- **SC-001**: Users can browse, preview, and install a customization from a configured source repo in under 60 seconds from first opening the sidebar.
- **SC-002**: The extension SHALL correctly detect and install customization files to the correct target directory for both Copilot and Claude Code formats with zero manual path configuration.
- **SC-003**: Installed customizations SHALL be trackable; the extension SHALL detect upstream changes (new commits) and present a diff view for selective update for 100% of tracked items.
- **SC-004**: Users SHALL be able to add a private GitHub repo (via personal access token stored in SecretStorage) and browse its contents within 30 seconds of configuration.
- **SC-005**: The extension SHALL cache source data and serve cached results with zero network requests when data is fresh (ETag-validated), reducing GitHub API calls by at least 90% during normal use.
- **SC-006**: Zero security vulnerabilities related to credential storage, prompt injection, or path traversal in the installed files.

---

## 3. Users & Roles

- **Extension User** (Primary): Any developer using VS Code with one or more AI coding assistants. Permissions: browse all configured sources, preview items, install/update/remove items, configure personal source repos, add personal access tokens. Primary use cases: discover customizations, install them, keep them updated.

- **Org Lead / DevEx Engineer** (Secondary): Configures source repos at workspace or organization level, curates practice bundles (P2). Permissions: all Extension User permissions plus workspace-level settings configuration, defining source repos in workspace `.vscode/settings.json`. Primary use cases: standardize team practices, onboard new developers.

- **Community Contributor** (Tertiary): Authors customization files in public GitHub repos. No direct interaction with the extension beyond publishing content in source repos. The extension indexes their work.

---

## 4. Functional Requirements

### 4.1 Source Registry Management

- **FR-001**: The extension SHALL read a master index file (JSON format, see Section 7 for schema) from a configurable URL on startup to discover available source repositories.
- **FR-002**: The extension SHALL allow users to add, remove, and reorder source repositories via VS Code settings (`awesome-coding-assistants.sources`). Each source is defined by: `url` (GitHub repo URL), `name` (display label), `branch` (default: `main`), and `authTokenKey` (optional, references a SecretStorage key).
- **FR-003**: The extension SHALL support both public repos (unauthenticated access via `raw.githubusercontent.com`) and private repos (authenticated via GitHub REST API with a stored personal access token).
- **FR-004**: The extension SHALL validate source repository URLs on add, confirming they point to accessible GitHub repositories. On failure, the extension SHALL display an error message: "Unable to access repository: {url}. Check the URL and authentication." Error code: `SOURCE_UNREACHABLE`.
- **FR-005**: The extension SHALL ship with a placeholder default source URL (configurable in settings) that the user will replace with their dedicated index repo. If the default URL is not reachable, the extension SHALL show a welcome message guiding the user to configure their first source.

**Implementation Contract - Source Registry**:
- `addSource(source: SourceConfig): Promise<void>` - Validates and adds a source to settings.
- `removeSource(url: string): Promise<void>` - Removes a source by URL.
- `getSources(): SourceConfig[]` - Returns all configured sources.
- `validateSource(source: SourceConfig): Promise<ValidationResult>` - HEAD request to repo; returns `{ valid: boolean, error?: string }`.

### 4.2 Repository Browsing and Tree View

- **FR-006**: The extension SHALL contribute a custom Activity Bar view container titled "Awesome Coding Assistants" with a dedicated icon.
- **FR-007**: The extension SHALL display a tree view organized as: Source Repo > Category > Item. Categories SHALL include: Agents, Instructions, Skills, Prompts, Hooks, Commands, Rules, Modes, Plugins (matching the source repo structure).
- **FR-008**: Each tree item SHALL display: item name, associated tool icon/badge (Copilot, Claude Code), and a brief description (from frontmatter or first non-heading line of the file).
- **FR-009**: The extension SHALL support lazy loading of tree data: source repos are listed immediately from cache/settings; category contents are fetched when a source node is expanded; file metadata is fetched when a category is expanded.
- **FR-010**: The extension SHALL provide a "Refresh" command in the view title bar that invalidates all caches and refetches source data. The refresh command SHALL be bound to `awesome-coding-assistants.refresh`.
- **FR-011**: The extension SHALL display an "Installed" badge/icon overlay on tree items that have been installed in the current workspace.

**Implementation Contract - Tree View**:
- `TreeDataProvider<CatalogItem>.getChildren(element?: CatalogItem): Promise<CatalogItem[]>`
- `TreeDataProvider<CatalogItem>.getTreeItem(element: CatalogItem): TreeItem`
- CatalogItem types: `source`, `category`, `item`.
- Tree item context values: `catalogItem.source`, `catalogItem.category`, `catalogItem.item`, `catalogItem.item.installed`.

### 4.3 Tool Format Detection

- **FR-012**: The extension SHALL detect the target tool for each customization item based on file path patterns and file content:
  - **GitHub Copilot**: files matching `agents/*.agent.md`, `instructions/*.instructions.md`, `skills/*/SKILL.md`, `hooks/*`, `prompts/*.prompt.md`, `plugins/*`, `workflows/*`, chat modes.
  - **Claude Code**: files matching `.claude/agents/*.md`, `.claude/rules/*.md`, `CLAUDE.md`, `.claude/commands/*.md`, `.claude/settings.json`.
- **FR-013**: The extension SHALL auto-detect which AI tools are configured in the current workspace by checking for the existence of `.github/copilot-instructions.md` or `.github/agents/` (Copilot) and `CLAUDE.md` or `.claude/` (Claude Code).
- **FR-014**: The extension SHALL default to showing items compatible with detected tools, with a toggle command `awesome-coding-assistants.showAllTools` to show the full catalog regardless of detected tools.
- **FR-015**: The extension SHALL display a tool compatibility badge on each item: a Copilot icon, Claude Code icon, or both. Items without a detected tool affinity SHALL show a generic "AI" badge.

**Implementation Contract - Tool Detection**:
- `detectWorkspaceTools(workspaceFolder: WorkspaceFolder): Promise<DetectedTool[]>` - Returns array of `{ tool: 'copilot' | 'claude-code', confidence: 'high' | 'low' }`.
- `classifyItem(path: string, content?: string): ToolClassification` - Returns `{ tool: 'copilot' | 'claude-code' | 'unknown', category: CategoryType }`.

### 4.4 Preview

- **FR-016**: The extension SHALL provide a "Preview" inline action on each item in the tree view that opens the file content in a read-only VS Code editor tab.
- **FR-017**: Preview content SHALL be fetched from `raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}` for public repos, or via the GitHub REST API (`GET /repos/{owner}/{repo}/contents/{path}`) for private repos.
- **FR-018**: For skill items (which are directories), preview SHALL display the primary file (e.g., `SKILL.md` for Copilot skills, or the main `.md` file for Claude Code agents).
- **FR-019**: Preview SHALL render Markdown content using VS Code's built-in Markdown preview, opened as a virtual document via `TextDocumentContentProvider` with scheme `awesome-ca-preview`.

**Implementation Contract - Preview**:
- `previewItem(item: CatalogItem): Promise<void>` - Opens preview editor for the item.
- `fetchFileContent(source: SourceConfig, path: string): Promise<string>` - Returns raw file content.
- Error on network failure: display notification "Failed to fetch preview: {error.message}". Error code: `PREVIEW_FETCH_FAILED`.

### 4.5 Installation

- **FR-020**: The extension SHALL provide an "Install" inline action on each tree item that downloads the file(s) to the correct workspace location.
- **FR-021**: Target directories SHALL be determined by tool type and category:
  - **Copilot agents**: `.github/agents/{filename}`
  - **Copilot instructions**: `.github/instructions/{filename}`
  - **Copilot skills**: `.github/skills/{skill-folder}/` (entire directory)
  - **Copilot prompts**: `.github/prompts/{filename}`
  - **Copilot hooks**: `.github/hooks/{filename}`
  - **Copilot chat modes**: `.github/chatmodes/{filename}`
  - **Claude Code agents**: `.claude/agents/{filename}`
  - **Claude Code rules**: `.claude/rules/{filename}`
  - **Claude Code commands**: `.claude/commands/{filename}`
  - **Claude Code CLAUDE.md**: `CLAUDE.md` or `.claude/CLAUDE.md` (user prompted to choose)
- **FR-022**: The extension SHALL create target directories automatically if they do not exist (using `workspace.fs.createDirectory`).
- **FR-023**: If a file already exists at the target path, the extension SHALL prompt the user with three options: "Overwrite", "Keep Existing", "Show Diff". Selecting "Show Diff" SHALL open the VS Code diff editor comparing installed vs. incoming.
- **FR-024**: When multiple workspace folders are open, the extension SHALL prompt the user via QuickPick to select the target workspace folder for every installation.
- **FR-025**: For skill/plugin items that consist of multiple files (a directory), the extension SHALL download all files in the directory recursively, preserving the directory structure.
- **FR-026**: After successful installation, the extension SHALL record the installation in a tracking manifest file at `.vscode/awesome-ca-manifest.json` in the target workspace folder.
- **FR-027**: The extension SHALL validate downloaded file paths to prevent path traversal attacks. Any path containing `..` segments or absolute paths SHALL be rejected with error code `INVALID_PATH`.

**Implementation Contract - Installation**:
- `installItem(item: CatalogItem, targetFolder: WorkspaceFolder): Promise<InstallResult>`
  - Returns `{ success: boolean, filesWritten: string[], error?: string }`.
- `getTargetPath(item: CatalogItem): string` - Computes the workspace-relative target path.
- `recordInstallation(item: CatalogItem, folder: WorkspaceFolder, commitSha: string): Promise<void>` - Updates manifest.

### 4.6 Lifecycle Management (Updates & Tracking)

- **FR-028**: The extension SHALL maintain an installation manifest at `.vscode/awesome-ca-manifest.json` per workspace folder. The manifest tracks: source URL, item path, installed commit SHA, installation timestamp, and target file path(s).
- **FR-029**: The extension SHALL check for updates by comparing the installed commit SHA against the latest commit SHA for each tracked item's file path (using GitHub REST API `GET /repos/{owner}/{repo}/commits?path={file_path}&per_page=1`).
- **FR-030**: The extension SHALL display an update indicator (badge) on tree items where the upstream commit SHA differs from the installed commit SHA.
- **FR-031**: The extension SHALL provide an "Update" action on items with available updates. The update action SHALL: fetch the new content, open a diff view (installed vs. upstream), and allow the user to accept or reject the update.
- **FR-032**: The extension SHALL provide a "Check for Updates" command (`awesome-coding-assistants.checkUpdates`) that scans all installed items across all workspace folders.
- **FR-033**: The extension SHALL provide an "Uninstall" action that removes the installed file(s) and removes the entry from the manifest.
- **FR-034**: Update checks SHALL use conditional requests (ETags via `If-None-Match` header) to minimize API usage.

**Implementation Contract - Lifecycle**:
- `checkForUpdates(folder?: WorkspaceFolder): Promise<UpdateCheckResult[]>` - Returns array of `{ item: ManifestEntry, hasUpdate: boolean, latestSha: string }`.
- `applyUpdate(entry: ManifestEntry, folder: WorkspaceFolder): Promise<void>` - Downloads new version and updates manifest.
- `uninstallItem(entry: ManifestEntry, folder: WorkspaceFolder): Promise<void>` - Deletes files and removes from manifest.
- `readManifest(folder: WorkspaceFolder): Promise<Manifest>` - Reads and parses manifest file.
- `writeManifest(folder: WorkspaceFolder, manifest: Manifest): Promise<void>` - Serializes and writes manifest.

### 4.7 Authentication & Secrets

- **FR-035**: The extension SHALL store GitHub personal access tokens using VS Code's `SecretStorage` API (`context.secrets`). Tokens SHALL NOT be stored in settings, environment variables, or plain text files.
- **FR-036**: The extension SHALL provide a command `awesome-coding-assistants.addToken` that prompts the user for a token name and value, storing both in SecretStorage.
- **FR-037**: The extension SHALL provide a command `awesome-coding-assistants.removeToken` that lists stored token names and allows deletion.
- **FR-038**: The extension SHALL also support the VS Code GitHub Authentication provider (`vscode.authentication.getSession('github', ['repo'])`) as an alternative to personal access tokens, offering users a choice when configuring private repo access.
- **FR-039**: Tokens SHALL be sent only in HTTPS Authorization headers (`Authorization: token {pat}` or `Authorization: Bearer {token}`). Tokens SHALL NOT be logged, displayed in UI, or included in error messages.

**Implementation Contract - Auth**:
- `storeToken(name: string, token: string): Promise<void>` - Stores via `context.secrets.store()`.
- `getToken(name: string): Promise<string | undefined>` - Retrieves via `context.secrets.get()`.
- `deleteToken(name: string): Promise<void>` - Deletes via `context.secrets.delete()`.
- `getAuthHeader(source: SourceConfig): Promise<Record<string, string> | undefined>` - Returns `{ Authorization: 'token ...' }` or `undefined` for public repos.

### 4.8 Caching

- **FR-040**: The extension SHALL cache GitHub API responses and raw file content in VS Code's `globalState` (for metadata/ETags) and a local cache directory under `context.globalStorageUri` (for file content).
- **FR-041**: Cache entries SHALL include: response body, ETag, timestamp, and source+path key.
- **FR-042**: On subsequent requests, the extension SHALL send `If-None-Match: {etag}` headers. On HTTP 304 responses, the cached data SHALL be used. On HTTP 200, the cache SHALL be updated.
- **FR-043**: The extension SHALL provide a "Clear Cache" command (`awesome-coding-assistants.clearCache`) that purges all cached data.
- **FR-044**: Cache entries SHALL expire after 24 hours by default. The expiration interval SHALL be configurable via `awesome-coding-assistants.cacheExpirationMinutes` (default: 1440, minimum: 5, maximum: 43200).

**Implementation Contract - Caching**:
- `getCached(key: string): Promise<CacheEntry | undefined>`
- `setCached(key: string, entry: CacheEntry): Promise<void>`
- `invalidate(key?: string): Promise<void>` - If key is undefined, clear all.
- `CacheEntry: { body: string, etag: string, timestamp: number }`

---

## 5. User Stories

### US-01 -- Browse Community Customizations (Priority: P1) MVP

**As an** Extension User, **I want** to browse available AI coding assistant customizations from a configured source repo in a tree view, **so that** I can discover useful agents, instructions, and skills without leaving VS Code.

**Why P1**: Core discovery is the foundation; without it, no other feature has value.

**Independent Test**: Open VS Code with a workspace, ensure at least one source is configured (or the default placeholder is reachable), expand the sidebar view, and verify categories and items are displayed. Click to expand categories and see item names with tool badges.

**Acceptance Scenarios**:
1. **Given** a configured source repo with agents and instructions, **When** the user opens the Awesome Coding Assistants sidebar, **Then** the source repo appears as a top-level node with collapsible category children (Agents, Instructions, Skills, Prompts, Hooks, Commands, Rules, Modes, Plugins), each containing items with names, tool badges, and descriptions.
2. **Given** no configured sources, **When** the user opens the sidebar, **Then** a welcome message is displayed guiding the user to configure their first source repository.
3. **Given** a configured source repo that is unreachable, **When** the user expands that source node, **Then** an error message "Unable to access repository: {url}" is shown inline in the tree.

---

### US-02 -- Preview Before Installing (Priority: P1) MVP

**As an** Extension User, **I want** to preview the content of a customization file before installing it, **so that** I can evaluate whether it is useful and safe.

**Why P1**: Security and trust require users to see content before modifying their workspace.

**Independent Test**: Click the preview icon on any tree item, verify a read-only editor tab opens showing the file's Markdown content.

**Acceptance Scenarios**:
1. **Given** a tree item representing an agent file, **When** the user clicks the preview icon, **Then** a read-only editor tab opens showing the full Markdown content of the file.
2. **Given** a tree item in a private repo requiring authentication, **When** the user clicks preview and a valid token is stored, **Then** the content is fetched and displayed.
3. **Given** a network failure during preview fetch, **When** the user clicks preview, **Then** an error notification "Failed to fetch preview: {error}" is displayed.

---

### US-03 -- Install a Customization (Priority: P1) MVP

**As an** Extension User, **I want** to install a customization to my workspace with one click, placing it in the correct tool-specific directory, **so that** I do not have to manually create directories or copy files.

**Why P1**: Installation is the primary value-delivery action.

**Independent Test**: Click install on a Copilot agent item, verify the `.github/agents/` directory is created (if needed) and the file appears there.

**Acceptance Scenarios**:
1. **Given** a Copilot agent item and a single workspace folder, **When** the user clicks Install, **Then** the file is downloaded to `.github/agents/{filename}` and a success notification is shown.
2. **Given** a Claude Code rules item and multiple workspace folders open, **When** the user clicks Install, **Then** a QuickPick appears listing workspace folders; after selection the file is downloaded to `{selected}/.claude/rules/{filename}`.
3. **Given** a file already exists at the target path, **When** the user clicks Install, **Then** a prompt offers "Overwrite", "Keep Existing", or "Show Diff".
4. **Given** a skill item (directory), **When** the user clicks Install, **Then** the entire directory structure is downloaded preserving all files.

---

### US-04 -- Add a Private Source Repository (Priority: P1) MVP

**As an** Org Lead, **I want** to add a private GitHub repository as a source for customizations, **so that** my team can browse our internal agents and instructions alongside community content.

**Why P1**: Multi-source is the core differentiator versus Tim Heuer's extension.

**Independent Test**: Add a private repo URL and a PAT via the extension commands, verify the private repo appears in the tree and its items can be browsed and previewed.

**Acceptance Scenarios**:
1. **Given** a valid private repo URL and a stored PAT, **When** the user adds the source via settings, **Then** the repo appears in the tree view and items can be browsed.
2. **Given** an invalid PAT, **When** the user tries to browse a private source, **Then** an error "Authentication failed for {repo}. Check your token." is shown. Error code: `AUTH_FAILED`.
3. **Given** no PAT is configured for a private repo, **When** the user expands that source node, **Then** they are prompted to add a token or authenticate via GitHub.

---

### US-05 -- Track and Update Installed Items (Priority: P1) MVP

**As an** Extension User, **I want** to see which customizations I have installed and whether updates are available, **so that** I can keep my configurations current with upstream improvements.

**Why P1**: Lifecycle management is a key differentiator and provides ongoing value.

**Independent Test**: Install an item, verify the tree shows an "installed" badge. Simulate an upstream change (mock the API to return a different SHA), run "Check for Updates", verify the update badge appears and clicking it opens a diff view.

**Acceptance Scenarios**:
1. **Given** a customization that has been installed, **When** the user views the tree, **Then** the item has an "installed" badge/overlay.
2. **Given** an installed item and a newer commit SHA upstream, **When** the user runs "Check for Updates", **Then** the item shows an "update available" badge.
3. **Given** an update is available, **When** the user clicks "Update", **Then** a diff view opens showing installed vs. upstream content with Accept/Reject actions.
4. **Given** a user wants to remove an installed customization, **When** they click "Uninstall", **Then** the file(s) are deleted and the manifest entry is removed.

---

### US-06 -- Smart Tool Detection (Priority: P2)

**As an** Extension User, **I want** the extension to detect which AI tools I use and filter the catalog accordingly, **so that** I see relevant items by default.

**Why P2**: Useful UX enhancement but not blocking for core value.

**Independent Test**: Open a workspace with `.github/agents/` present. Verify the tree defaults to showing Copilot-compatible items. Toggle "Show All" and verify all items appear.

**Acceptance Scenarios**:
1. **Given** a workspace with `.github/agents/` directory, **When** the sidebar opens, **Then** items tagged as Copilot-compatible are shown by default.
2. **Given** a workspace with both `.github/agents/` and `.claude/` directories, **When** the sidebar opens, **Then** items for both Copilot and Claude Code are shown.
3. **Given** the user clicks "Show All Tools" toggle, **When** the tree refreshes, **Then** all items from all sources are shown regardless of detected tools.

---

### US-07 -- Org Practice Bundles (Priority: P2)

**As an** Org Lead, **I want** to define a collection of customizations as a "practice bundle" in a manifest file, **so that** new team members can install all team standards with one click.

**Why P2**: High organizational value but builds on top of core install/browse.

**Independent Test**: Create a bundle manifest in a source repo, configure the source, verify the bundle appears in the tree. Click "Install Bundle" and verify all items are installed.

**Acceptance Scenarios**:
1. **Given** a source repo with a `bundles/team-onboarding.json` file listing 5 items, **When** the user expands the Bundles category, **Then** the bundle "team-onboarding" appears with a count badge showing "5 items".
2. **Given** a bundle, **When** the user clicks "Install Bundle", **Then** all items in the bundle are installed to the correct directories with a progress notification.

---

### US-08 -- Search and Filter (Priority: P2)

**As an** Extension User, **I want** to search across all sources by keyword, **so that** I can find customizations without expanding every category.

**Why P2**: Convenience feature for larger catalogs.

**Independent Test**: Type a search term in the tree view filter box, verify results narrow to matching items.

**Acceptance Scenarios**:
1. **Given** multiple sources with dozens of items, **When** the user types "typescript" in the search box, **Then** only items with "typescript" in name, description, or tags are shown.
2. **Given** a search query with no results, **When** the user searches, **Then** an empty state message "No items match '{query}'" is displayed.

---

### Edge Cases

- What happens when a source repo is deleted or made private after initial configuration? The extension SHALL show an error on that source node and continue to function for other sources.
- What happens when a file is installed then locally modified? On update, the diff view SHALL show both upstream changes and local modifications. The user decides.
- What happens when GitHub API rate limits are exceeded? The extension SHALL show a rate limit warning with the reset time and suggest configuring a PAT. Error code: `RATE_LIMITED`.
- What happens with very large files (>1MB)? The extension SHALL warn the user before downloading files larger than 1MB.
- What happens if the manifest file `.vscode/awesome-ca-manifest.json` is corrupted? The extension SHALL attempt to parse it; on failure, it SHALL back up the corrupted file and create a fresh manifest.

---

## 6. User Flows

### 6.1 First Use Flow

1. User installs extension from VS Code Marketplace.
2. Activity Bar shows new "Awesome Coding Assistants" icon.
3. User clicks the icon; sidebar opens.
4. If no sources configured: welcome view with "Configure Source Repository" button.
5. User clicks button; settings.json opens with `awesome-coding-assistants.sources` highlighted.
6. User adds a source config `{ "url": "https://github.com/{owner}/{repo}", "name": "My Source" }`.
7. Sidebar auto-refreshes; source node appears.
8. User expands source > category > browses items.

### 6.2 Install Flow

1. User expands a category and sees items with tool badges.
2. User clicks the preview icon on an item; read-only preview opens.
3. User clicks the install icon on the item.
4. If multiple workspace folders: QuickPick shows folder list; user selects one.
5. If target file exists: prompt with Overwrite / Keep / Diff.
6. File is downloaded to the target path.
7. Manifest is updated.
8. Tree item badge changes to "Installed".
9. Success notification: "Installed {item.name} to {target.path}".

### 6.3 Update Flow

1. User triggers "Check for Updates" (command palette or view title button).
2. Extension reads manifest entries, queries GitHub for latest commit SHAs.
3. Items with newer SHAs get "Update Available" badge in tree.
4. User clicks "Update" on an item.
5. Diff editor opens: left = installed, right = upstream.
6. Diff editor title bar shows "Accept Update" and "Dismiss" actions.
7. On accept: file is overwritten, manifest updated with new SHA.
8. On dismiss: no changes; badge remains.

### 6.4 Private Repo Setup Flow

1. User opens extension settings; adds a source with `authTokenKey: "my-org-token"`.
2. Extension detects no token stored under "my-org-token".
3. Notification: "Token 'my-org-token' not found. Add a GitHub token?"
4. User runs command `awesome-coding-assistants.addToken`.
5. Extension prompts: "Token name:" (pre-filled "my-org-token"), "Token value:" (password input).
6. Token stored in SecretStorage.
7. Source node refreshes; private repo contents appear.

---

## 7. Data Model

### 7.1 Master Index File (`index.json`)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `$schema` | string | URI, optional | JSON schema reference |
| `version` | string | semver, required, pattern: `^\d+\.\d+\.\d+$` | Index format version |
| `sources` | SourceEntry[] | required, min 1 item | Array of source repositories |

### 7.2 SourceEntry

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `url` | string | required, pattern: `^https://github\.com/[^/]+/[^/]+$` | GitHub repo URL |
| `name` | string | required, 1-100 chars | Display name |
| `description` | string | optional, 0-500 chars | Source description |
| `branch` | string | optional, default: `main`, 1-100 chars | Git branch |
| `categories` | string[] | optional, valid values: `agents`, `instructions`, `skills`, `prompts`, `hooks`, `commands`, `rules`, `modes`, `plugins`, `bundles` | Supported categories |
| `tools` | string[] | optional, valid values: `copilot`, `claude-code`, `kiro`, `kilocode`, `opencode` | Supported tools |
| `private` | boolean | optional, default: false | Whether auth is required |

### 7.3 VS Code Settings Schema (`awesome-coding-assistants.sources`)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `url` | string | required, GitHub repo URL | Repository URL |
| `name` | string | required, 1-100 chars | Display name |
| `branch` | string | optional, default: `main` | Git branch |
| `authTokenKey` | string | optional, 1-50 chars, alphanumeric + hyphens | Name of token in SecretStorage |

### 7.4 Installation Manifest (`.vscode/awesome-ca-manifest.json`)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `version` | string | required, value: `1.0` | Manifest format version |
| `installations` | InstallationEntry[] | required | Array of tracked installations |

### 7.5 InstallationEntry

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | string | required, unique, format: `{sourceUrl}#{itemPath}` | Unique identifier |
| `sourceUrl` | string | required | Source repo URL |
| `sourceBranch` | string | required | Branch at install time |
| `itemPath` | string | required | Path within source repo |
| `targetPaths` | string[] | required, min 1 | Workspace-relative paths of installed files |
| `tool` | string | required, enum: `copilot`, `claude-code`, `unknown` | Target tool |
| `category` | string | required | Item category |
| `commitSha` | string | required, 40 chars hex | Git commit SHA at install time |
| `installedAt` | string | required, ISO 8601 datetime | Installation timestamp |
| `updatedAt` | string | optional, ISO 8601 datetime | Last update timestamp |

### 7.6 Cache Entry (Internal)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `key` | string | required | Cache key: `{source}:{path}` |
| `body` | string | required | Response body |
| `etag` | string | optional | ETag from response |
| `timestamp` | number | required | Unix timestamp in ms |

### 7.7 Bundle Manifest (P2, `bundles/{name}.json`)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `name` | string | required, 1-100 chars | Bundle name |
| `description` | string | optional, 0-500 chars | Bundle description |
| `items` | BundleItem[] | required, min 1 | Items in the bundle |

### 7.8 BundleItem (P2)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `path` | string | required | Path within the source repo |
| `tool` | string | required, enum: `copilot`, `claude-code` | Target tool |
| `category` | string | required | Item category |
| `required` | boolean | optional, default: true | Whether the item is mandatory |

---

## 8. API / Interface Design

### 8.1 VS Code Commands

| Command ID | Title | Description | When |
|------------|-------|-------------|------|
| `awesome-coding-assistants.refresh` | Refresh Sources | Invalidate cache, refetch all sources | Always |
| `awesome-coding-assistants.preview` | Preview Item | Open item content in read-only editor | Tree item selected |
| `awesome-coding-assistants.install` | Install Item | Download item to workspace | Tree item, not installed |
| `awesome-coding-assistants.update` | Update Item | Download latest version | Tree item, update available |
| `awesome-coding-assistants.uninstall` | Uninstall Item | Remove installed item | Tree item, installed |
| `awesome-coding-assistants.checkUpdates` | Check for Updates | Scan all installed items | Always |
| `awesome-coding-assistants.addToken` | Add GitHub Token | Store PAT in SecretStorage | Always |
| `awesome-coding-assistants.removeToken` | Remove GitHub Token | Delete PAT from SecretStorage | Always |
| `awesome-coding-assistants.clearCache` | Clear Cache | Purge all cached data | Always |
| `awesome-coding-assistants.showAllTools` | Toggle Show All Tools | Toggle tool filter on/off | Always |

### 8.2 VS Code Settings (`contributes.configuration`)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `awesome-coding-assistants.sources` | array of `SourceConfig` | `[]` | Configured source repositories |
| `awesome-coding-assistants.indexUrl` | string | `""` | URL to master index JSON file |
| `awesome-coding-assistants.cacheExpirationMinutes` | integer | 1440 | Cache expiry (5-43200) |
| `awesome-coding-assistants.showAllTools` | boolean | false | Show all tools regardless of detection |
| `awesome-coding-assistants.autoCheckUpdates` | boolean | true | Auto-check updates on activation |
| `awesome-coding-assistants.autoCheckIntervalMinutes` | integer | 60 | Auto-check interval (5-1440) |

### 8.3 GitHub API Usage

| Operation | API | Auth Required | Caching |
|-----------|-----|---------------|---------|
| List repo tree | `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1` | For private repos | ETag |
| Get file content | `GET https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}` | For private repos (use API instead) | ETag |
| Get file content (private) | `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` | Yes | ETag |
| Get latest commit for file | `GET /repos/{owner}/{repo}/commits?path={path}&per_page=1&sha={branch}` | For private repos | ETag |
| Validate repo access | `HEAD /repos/{owner}/{repo}` | For private repos | None |

All API requests SHALL:
- Include `User-Agent: awesome-coding-assistants-vscode` header.
- Include `Accept: application/vnd.github.v3+json` header for REST API calls.
- Use HTTPS exclusively.
- Respect `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers.

### 8.4 Error Codes

| Code | HTTP Context | User Message | Internal Log |
|------|-------------|--------------|--------------|
| `SOURCE_UNREACHABLE` | 404 or network error | "Unable to access repository: {url}. Check the URL and authentication." | "Source validation failed: {url}, status: {code}" |
| `AUTH_FAILED` | 401 or 403 | "Authentication failed for {repo}. Check your token." | "Auth failure for {url}: {code}" |
| `RATE_LIMITED` | 429 | "GitHub API rate limit exceeded. Resets at {time}. Consider adding a personal access token." | "Rate limited: resets at {reset}" |
| `PREVIEW_FETCH_FAILED` | Any failure | "Failed to fetch preview: {message}" | "Preview fetch error for {path}: {error}" |
| `INSTALL_FAILED` | Write failure | "Failed to install {name}: {message}" | "Install error: {path}, {error}" |
| `INVALID_PATH` | Path traversal | "Invalid file path detected. Installation blocked for security." | "Path traversal attempt: {path}" |
| `MANIFEST_CORRUPT` | Parse failure | "Installation manifest was corrupted and has been reset." | "Manifest parse failed: {error}" |
| `CACHE_ERROR` | Storage failure | (silent) | "Cache write failed: {error}" |

---

## 9. Architecture

### 9.1 System Design

The extension runs entirely within the VS Code extension host process. It makes outbound HTTPS requests to GitHub (REST API and raw.githubusercontent.com) and reads/writes files in the user's workspace and extension global storage. There are no background services, databases, or external runtimes.

Component diagram (prose):
- **Extension Host** - entry point; registers commands, views, providers.
- **SourceRegistry** - reads settings/index, validates sources, manages the list of configured repos.
- **GitHubClient** - wraps all HTTP calls to GitHub (REST API + raw content), handles auth headers, caching, rate limit tracking.
- **CacheManager** - manages in-memory and persistent cache using `globalState` and `globalStorageUri`.
- **CatalogTreeProvider** - implements `TreeDataProvider<CatalogItem>`, lazy-loads tree data from sources via GitHubClient.
- **PreviewProvider** - implements `TextDocumentContentProvider` for the `awesome-ca-preview` scheme.
- **Installer** - handles file download, path computation, conflict detection, directory creation, and manifest updates.
- **LifecycleManager** - reads manifests, checks for updates via GitHubClient, orchestrates diff/update flows.
- **AuthManager** - wraps `SecretStorage` and GitHub Auth provider; provides tokens to GitHubClient.
- **ToolDetector** - scans workspace for tool-specific files/folders; classifies catalog items.

### 9.2 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Language | TypeScript 5.x | VS Code extension standard; type safety |
| Runtime | VS Code Extension Host (Node.js) | Required by VS Code extension API |
| HTTP Client | Built-in `https` module (Node.js) or VS Code `fetch` | Zero dependency; native TLS support |
| Bundler | esbuild | Fast, used by Tim Heuer's extension and yo code scaffolding |
| Package Manager | npm (local `node_modules`) | Standard for VS Code extensions |
| Linter | ESLint with @typescript-eslint | Standard for TS projects |
| Test Framework | Mocha + @vscode/test-electron | Official VS Code extension test framework |
| CI/CD | GitHub Actions | Standard for GitHub-hosted projects |

### 9.3 Directory & Module Structure

```
awesome-coding-assistants/
  .github/
    workflows/         # CI/CD workflows
    agents/            # project agent definitions (already exists)
  .vscode/
    launch.json        # debug configurations
    settings.json      # workspace settings
  src/
    extension.ts       # activate/deactivate entry point
    commands/           # command handler functions
      index.ts
    providers/
      catalogTree.ts   # TreeDataProvider implementation
      preview.ts       # TextDocumentContentProvider
    services/
      sourceRegistry.ts # source repo management
      githubClient.ts  # HTTP client for GitHub API
      cacheManager.ts  # caching logic
      installer.ts     # file installation logic
      lifecycle.ts     # update tracking and checking
      authManager.ts   # token storage and retrieval
      toolDetector.ts  # workspace tool detection
    models/
      types.ts         # shared TypeScript interfaces/types
      errors.ts        # custom error classes and codes
    utils/
      pathUtils.ts     # path computation, traversal validation
  test/
    suite/
      extension.test.ts
      sourceRegistry.test.ts
      githubClient.test.ts
      installer.test.ts
      lifecycle.test.ts
      toolDetector.test.ts
      cacheManager.test.ts
  resources/
    icons/             # light/dark theme icons
  specs/               # specification files
  ideas/               # ideation briefs
  package.json         # extension manifest
  tsconfig.json        # TypeScript configuration
  esbuild.js           # build script
  .eslintrc.json       # linter configuration
  README.md            # extension readme
  CHANGELOG.md         # version changelog
  LICENSE              # MIT license
```

### 9.4 Key Design Decisions

**Decision 1: No external HTTP library**
- **Rationale**: Node.js built-in `https` or VS Code's `fetch` API eliminates supply chain risk and keeps the extension lightweight. The GitHub API usage is simple (GET requests with headers).
- **Alternatives considered**: Axios (used by Tim Heuer) - adds a dependency and bundle size.
- **Consequences**: Slightly more boilerplate for HTTP handling; acceptable trade-off for zero dependencies.

**Decision 2: JSON for master index (not YAML or TOML)**
- **Rationale**: User confirmed JSON. Native parsing in Node.js, schema validation via JSON Schema, VS Code has excellent JSON support. Aligns with package.json and tsconfig.json conventions.
- **Alternatives considered**: YAML (more readable but requires a parser), TOML (less common in JS ecosystem).
- **Consequences**: Index files are slightly less human-readable than YAML but tooling support is superior.

**Decision 3: Git commit SHA for versioning (not tags or frontmatter)**
- **Rationale**: User confirmed SHA-based versioning. Automatic (no author action needed), precise, and available via a single API call. Every change to a file produces a new SHA.
- **Alternatives considered**: Git tags (requires author discipline), frontmatter version (requires parsing and author compliance).
- **Consequences**: Version is opaque to users (hash vs. "v1.2"); mitigated by showing dates and diffs.

**Decision 4: Prompt for workspace folder on every install (not default-to-first)**
- **Rationale**: User confirmed "always prompt". Prevents accidental installs to the wrong folder in multi-root workspaces.
- **Alternatives considered**: Default to first folder (faster for single-folder workspaces), install to all (too aggressive).
- **Consequences**: One extra click per install in multi-root scenarios; single-folder workspaces are auto-selected without prompt (only one option).

**Decision 5: MVP supports Copilot + Claude Code only**
- **Rationale**: User confirmed. These are the two most established and widely-used tools. Kiro, KiloCode, and OpenCode formats will be added in P2.
- **Alternatives considered**: All tools in MVP (larger scope, less stable formats), Copilot-only (too narrow).
- **Consequences**: P2 requires extending ToolDetector and path mapping for additional tools but the architecture is designed to be extensible.

### 9.5 External Integrations

**GitHub REST API v3**
- **Purpose**: Read repository tree structure, file contents, commit history for update detection.
- **Authentication**: Bearer token (PAT or GitHub Auth session token) for private repos; unauthenticated for public repos.
- **Key operations**: List tree, get contents, get commits, HEAD for validation.
- **Failure handling**: Cache-first strategy. On 304, use cache. On 401/403, prompt for re-auth. On 429, show rate limit message with reset time and pause requests until reset. On 5xx/network error, use stale cache with a "stale data" warning badge.

**raw.githubusercontent.com**
- **Purpose**: Fast file content retrieval for public repos (no API rate limits).
- **Authentication**: None (public repos only).
- **Key operations**: GET file by path.
- **Failure handling**: Fall back to GitHub API if raw.githubusercontent.com is unreachable.

---

## 10. Non-Functional Requirements

### 10.1 Performance

- Tree view initial load SHALL complete in under 2 seconds when data is cached.
- Preview SHALL display content in under 3 seconds on a typical broadband connection.
- Update check for 50 installed items SHALL complete in under 30 seconds (parallelized API calls, max 10 concurrent).
- The extension SHALL NOT block the VS Code UI thread; all network I/O and file I/O SHALL be asynchronous.

### 10.2 Security

- **Authentication**: Personal access tokens stored exclusively in VS Code SecretStorage API (OS keychain). No plaintext credential storage.
- **Authorization**: Tokens are scoped per-source; each source references a named token. Extension does not request broader permissions than needed.
- **Input validation**: All file paths from remote sources SHALL be validated against path traversal (reject `..` segments, absolute paths, and null bytes). OWASP: A03:2021 - Injection.
- **Content security**: Files are written to workspace directories only. No execution of downloaded content. OWASP: A08:2021 - Software and Data Integrity.
- **SSRF protection**: Only HTTPS connections to `github.com`, `api.github.com`, and `raw.githubusercontent.com` domains are allowed. No user-supplied arbitrary URLs for HTTP requests. OWASP: A10:2021 - SSRF.
- **Credential exposure**: Tokens SHALL NOT appear in log output, error messages, telemetry, or UI elements.
- **Prompt injection**: Preview content is rendered as Markdown via VS Code's built-in renderer (sandboxed). No content is passed to AI chat or executed.

### 10.3 Scalability & Availability

- Expected load: 1-20 source repos per user, each with 10-500 items.
- The extension is client-side only; scalability is bounded by GitHub API rate limits.
- Unauthenticated: 60 requests/hour. Authenticated: 5,000 requests/hour.
- Caching and ETags SHALL keep actual API usage to under 50 requests per session for typical workflows.

### 10.4 Accessibility

- All tree view items SHALL have accessible labels (set via `TreeItem.accessibilityInformation`).
- All commands SHALL be accessible via the Command Palette (keyboard-only users).
- Status notifications SHALL use VS Code's standard notification API (read by screen readers).
- Icons SHALL have text-equivalent labels; no information conveyed solely by color.

### 10.5 Observability

- **Logging**: Extension SHALL use a dedicated `LogOutputChannel` named "Awesome Coding Assistants". Log levels: trace (API request/response), debug (cache hits/misses), info (install/update actions), warning (stale cache, rate limit approaching), error (failures).
- **Metrics**: No telemetry in v1.0. Extension SHALL not send any data to external services.
- **Alerting**: Not applicable (client-side extension).

---

## 11. Test Requirements

### 11.1 Unit Tests

Modules requiring unit test coverage:
- `sourceRegistry.ts`: validation logic, source add/remove, index parsing.
- `githubClient.ts`: URL construction, header assembly, response parsing, rate limit handling.
- `cacheManager.ts`: get/set/invalidate, expiry logic, ETag handling.
- `installer.ts`: path computation, path traversal validation, directory creation, conflict detection.
- `lifecycle.ts`: SHA comparison, manifest read/write, update detection.
- `toolDetector.ts`: pattern matching for Copilot/Claude Code files.
- `pathUtils.ts`: path normalization, traversal checks.

Minimum coverage: 80% line coverage, 90% branch coverage.

Edge cases that MUST be tested:
- Path with `..` segments is rejected.
- Path with null bytes is rejected.
- Manifest with invalid JSON is handled gracefully.
- Empty source list renders welcome view.
- ETag cache hit returns cached body without network call.
- Rate limit response returns error code `RATE_LIMITED` and displays a notification with the reset time.

### 11.2 BDD / Acceptance Tests

```gherkin
Feature: Browse Source Repositories

  Scenario: User browses a configured public source
    Given a configured source "Community" pointing to "https://github.com/example/awesome-copilot"
    And the source contains an "agents" directory with 3 agent files
    When the user opens the Awesome Coding Assistants sidebar
    Then the source "Community" appears as a top-level tree node
    And expanding "Community" shows a category node "Agents"
    And expanding "Agents" shows 3 items with names and tool badges

  Scenario: No sources configured
    Given no sources are configured in settings
    When the user opens the sidebar
    Then a welcome message "No sources configured" is shown
    And a "Configure Source" button is displayed

  Scenario: Source repo is unreachable
    Given a configured source "Broken" pointing to "https://github.com/example/nonexistent"
    When the user expands "Broken"
    Then an error item "Unable to access repository" is shown

Feature: Preview Customization

  Scenario: Preview a public file
    Given a configured source with an agent file "code-review.agent.md"
    When the user clicks the preview icon on "code-review.agent.md"
    Then a read-only editor tab opens with the file's Markdown content

  Scenario: Preview fails due to network error
    Given a configured source and a network timeout
    When the user clicks preview on any item
    Then a notification "Failed to fetch preview" is shown

Feature: Install Customization

  Scenario: Install a Copilot agent to single workspace
    Given a single workspace folder and a Copilot agent item "code-review.agent.md"
    When the user clicks Install
    Then the file is created at ".github/agents/code-review.agent.md"
    And a success notification "Installed code-review.agent.md" is shown
    And the item shows an "Installed" badge in the tree

  Scenario: Install with file conflict
    Given an installed file at ".github/agents/code-review.agent.md"
    When the user installs the same item again
    Then a prompt shows "Overwrite", "Keep Existing", "Show Diff"

  Scenario: Install to multi-root workspace
    Given two workspace folders "project-a" and "project-b"
    When the user clicks Install on any item
    Then a QuickPick shows both folder names
    And after selection, the file is installed to the chosen folder

  Scenario: Path traversal blocked
    Given a source with a file path containing "../../../etc/passwd"
    When the extension processes that item for installation
    Then the installation is rejected with error "Invalid file path detected"

Feature: Authentication for Private Repos

  Scenario: Add a personal access token
    Given no tokens stored
    When the user runs "Add GitHub Token" command
    Then they are prompted for a token name and value
    And the token is stored in SecretStorage

  Scenario: Browse a private repo with stored token
    Given a private source with authTokenKey "my-token" and a valid stored token
    When the user expands the source node
    Then items from the private repo are displayed

  Scenario: Auth failure on private repo
    Given a private source with an invalid stored token
    When the user expands the source node
    Then an error "Authentication failed" is shown

Feature: Lifecycle Management

  Scenario: Detect available updates
    Given an item installed at commit SHA "abc123"
    And the source now has a newer commit SHA "def456" for that file
    When the user runs "Check for Updates"
    Then the item shows an "Update Available" badge

  Scenario: Apply an update
    Given an item with an available update
    When the user clicks "Update"
    Then a diff view opens showing installed vs upstream
    And the user can click "Accept Update" to apply

  Scenario: Uninstall a customization
    Given an installed customization tracked in the manifest
    When the user clicks "Uninstall"
    Then the file is deleted from the workspace
    And the manifest entry is removed

Feature: Caching

  Scenario: Serve data from cache
    Given a cached response for a source with a valid ETag
    When the extension fetches the same data
    Then the request includes "If-None-Match" header
    And if the server returns 304, cached data is used without re-download

  Scenario: Cache expiration
    Given a cached entry older than the configured expiration
    When the extension needs that data
    Then a fresh request is made (no If-None-Match)
```

### 11.3 Integration Tests

- **GitHub API integration**: Mock HTTP responses (using a test HTTP interceptor) to verify correct header assembly, ETag handling, and error code mapping across GitHubClient + CacheManager.
- **Installer + FileSystem**: Use a temporary workspace folder to verify file creation, directory creation, conflict detection, and manifest writing.
- **SourceRegistry + GitHubClient**: Verify that adding a source triggers a validation request and the tree updates accordingly.

External dependencies to mock: All GitHub API calls (HTTP layer). No real GitHub requests in tests.
Data setup: Fixture JSON files for API responses; fixture Markdown files for content.
Teardown: Delete temporary workspace folders after each test.

### 11.4 End-to-End Tests

- **Critical journeys**: Browse > Preview > Install > Check Updates > Apply Update flow on a real (test) GitHub repo.
- **Target environment**: VS Code extension test runner (`@vscode/test-electron`).
- **Tools**: Mocha as the test runner within the VS Code test host.

### 11.5 Performance Tests

- **Scenario**: Load a source repo tree with 500 items. Measure time from expansion click to full tree render. Pass: under 3 seconds with cache, under 10 seconds cold.
- **Scenario**: Run "Check for Updates" on 50 installed items. Measure total time. Pass: under 30 seconds.

### 11.6 Security Tests

- **Path traversal**: Attempt to install items with paths like `../../.ssh/authorized_keys`, `../../../etc/passwd`, files with null bytes, absolute paths. All SHALL be rejected.
- **Credential exposure**: Verify no tokens appear in `LogOutputChannel` output for any log level.
- **HTTPS enforcement**: Verify no HTTP (non-TLS) requests are made.

---

## 12. Constraints & Assumptions

### Constraints

- **Platform**: VS Code only (no JetBrains or other IDE support).
- **VS Code Version**: Minimum 1.85.0 (for stable `SecretStorage`, `TreeView`, and `fetch` support).
- **License**: MIT license; all dependencies must be MIT-compatible.
- **Distribution**: VS Code Marketplace only; no sideloading support required.
- **No external runtime**: No Docker, no database, no background service; extension host only.
- **GitHub only**: Source repos must be GitHub-hosted (no GitLab, Bitbucket, or generic git). This could be extended in P3.

### Assumptions

- GitHub repos remain the primary distribution mechanism for AI coding customizations.
- Customization file formats (`.agent.md`, `.instructions.md`, `CLAUDE.md`, `.claude/agents/`, `.claude/rules/`) are sufficiently stable for reliable pattern-based detection.
- The user will provide a dedicated index repository URL to replace the default placeholder.
- VS Code remains the dominant IDE for AI-assisted coding for the target audience.
- The GitHub REST API v3 remains stable and available.

---

## 13. Out of Scope

- **Automatic format conversion between tools**: The formats and semantics differ enough that automatic conversion would be unreliable.
- **Editing or authoring customizations**: The extension is a distribution and lifecycle tool, not an editor.
- **Runtime execution of agents/skills**: The extension installs files; the respective AI tools execute them.
- **Support for SaaS-only platforms** (Lovable, GitHub Spark, etc.): No file-based customization model.
- **Paid marketplace features**: No transactions, paid listings, or DRM.
- **Non-GitHub hosting**: GitLab, Bitbucket, generic git, or local filesystem sources - deferred to P3.
- **Kiro, KiloCode, OpenCode format support**: Deferred to P2.
- **Offline/air-gapped mode**: Deferred to P3.
- **Telemetry or analytics**: No usage tracking in v1.0.
- **Extension marketplace publishing automation**: CI/CD is specified but the actual publishing process is out of scope for this spec.

---

## 14. Open Questions

| # | Question | Impact if Unresolved | Owner |
|---|----------|---------------------|-------|
| 1 | What is the URL of the dedicated index repository? | Default source will be a placeholder that shows an empty catalog until configured. Extension will function but first-use experience loses discoverability. | User/Org Lead |
| 2 | Should bundles (P2) support cross-source references (items from source A bundled with items from source B)? | Bundle manifest format may need revision in P2. For now, bundles are scoped to a single source. | Spec Architect (P2) |
| 3 | Should the extension support `.gitignore`-style exclusion patterns in source repos (to skip certain files from indexing)? | Some large repos may have files that should not be browsable. Low impact for MVP. | Spec Architect (P2) |

---

## 15. Glossary

| Term | Definition |
|------|------------|
| **Customization** | A file or set of files that configure the behavior of an AI coding assistant (agent, instruction, skill, hook, etc.) |
| **Source** | A GitHub repository configured as a browsable catalog of customizations |
| **Master Index** | A JSON file listing available source repositories with metadata |
| **Manifest** | A `.vscode/awesome-ca-manifest.json` file tracking which customizations are installed in a workspace folder |
| **Practice Bundle** | A named collection of customizations intended to be installed together (P2) |
| **Tool** | An AI coding assistant (GitHub Copilot, Claude Code, etc.) |
| **Category** | A classification of customization type (agents, instructions, skills, hooks, etc.) |
| **ETag** | An HTTP header used for conditional requests to avoid re-downloading unchanged content |
| **PAT** | Personal Access Token; a GitHub authentication credential |
| **SecretStorage** | VS Code API for secure credential storage backed by the OS keychain |

---

## 16. Traceability Matrix

| FR ID | Requirement Summary | User Story | Acceptance Scenario | Test Type | Test Section Ref |
|-------|-------------------|------------|--------------------|-----------|-|
| FR-001 | Read master index on startup | US-01 | US-01 Scenario 1 | unit, BDD | 11.1, 11.2 |
| FR-002 | Add/remove/reorder sources via settings | US-04 | US-04 Scenario 1 | unit, integration | 11.1, 11.3 |
| FR-003 | Support public and private repos | US-04 | US-04 Scenarios 1-3 | unit, BDD, integration | 11.1, 11.2, 11.3 |
| FR-004 | Validate source URLs | US-01, US-04 | US-01 Scenario 3 | unit, BDD | 11.1, 11.2 |
| FR-005 | Ship with placeholder default source | US-01 | US-01 Scenario 2 | BDD | 11.2 |
| FR-006 | Activity Bar view container | US-01 | US-01 Scenario 1 | E2E | 11.4 |
| FR-007 | Tree view organized by Source > Category > Item | US-01 | US-01 Scenario 1 | BDD, E2E | 11.2, 11.4 |
| FR-008 | Tree items show name, tool badge, description | US-01 | US-01 Scenario 1 | BDD | 11.2 |
| FR-009 | Lazy loading of tree data | US-01 | US-01 Scenario 1 | unit, performance | 11.1, 11.5 |
| FR-010 | Refresh command | US-01 | (implicit) | unit | 11.1 |
| FR-011 | Installed badge on tree items | US-05 | US-05 Scenario 1 | BDD | 11.2 |
| FR-012 | Tool format detection by path/content | US-06 | US-06 Scenarios 1-2 | unit | 11.1 |
| FR-013 | Auto-detect workspace tools | US-06 | US-06 Scenarios 1-2 | unit | 11.1 |
| FR-014 | Default filter to detected tools | US-06 | US-06 Scenario 3 | BDD | 11.2 |
| FR-015 | Tool compatibility badge | US-01 | US-01 Scenario 1 | BDD | 11.2 |
| FR-016 | Preview inline action | US-02 | US-02 Scenario 1 | BDD | 11.2 |
| FR-017 | Preview fetch from raw/API | US-02 | US-02 Scenarios 1-2 | unit, BDD | 11.1, 11.2 |
| FR-018 | Preview skill directories (primary file) | US-02 | US-02 Scenario 1 | unit | 11.1 |
| FR-019 | Preview renders Markdown | US-02 | US-02 Scenario 1 | BDD | 11.2 |
| FR-020 | Install inline action | US-03 | US-03 Scenario 1 | BDD, E2E | 11.2, 11.4 |
| FR-021 | Target directory mapping | US-03 | US-03 Scenarios 1-2 | unit | 11.1 |
| FR-022 | Auto-create target directories | US-03 | US-03 Scenario 1 | unit, integration | 11.1, 11.3 |
| FR-023 | Conflict resolution prompt | US-03 | US-03 Scenario 3 | BDD | 11.2 |
| FR-024 | Multi-root: prompt for target folder | US-03 | US-03 Scenario 2 | BDD | 11.2 |
| FR-025 | Recursive directory download (skills) | US-03 | US-03 Scenario 4 | unit, integration | 11.1, 11.3 |
| FR-026 | Record installation in manifest | US-05 | US-05 Scenario 1 | unit, integration | 11.1, 11.3 |
| FR-027 | Path traversal validation | US-03 | Edge case | unit, security | 11.1, 11.6 |
| FR-028 | Manifest file per workspace folder | US-05 | US-05 Scenarios 1-4 | unit, integration | 11.1, 11.3 |
| FR-029 | Update detection by commit SHA | US-05 | US-05 Scenario 2 | unit, BDD | 11.1, 11.2 |
| FR-030 | Update indicator badge | US-05 | US-05 Scenario 2 | BDD | 11.2 |
| FR-031 | Update action with diff view | US-05 | US-05 Scenario 3 | BDD, E2E | 11.2, 11.4 |
| FR-032 | Check for Updates command | US-05 | US-05 Scenario 2 | BDD | 11.2 |
| FR-033 | Uninstall action | US-05 | US-05 Scenario 4 | BDD | 11.2 |
| FR-034 | Conditional requests (ETags) | US-05 | (implicit) | unit | 11.1 |
| FR-035 | Store tokens in SecretStorage | US-04 | US-04 Scenario 1 | unit, security | 11.1, 11.6 |
| FR-036 | Add token command | US-04 | US-04 Scenario 3 | BDD | 11.2 |
| FR-037 | Remove token command | US-04 | (implicit) | unit | 11.1 |
| FR-038 | GitHub Auth provider support | US-04 | US-04 Scenario 1 | integration | 11.3 |
| FR-039 | Token only in HTTPS headers | US-04 | (implicit) | unit, security | 11.1, 11.6 |
| FR-040 | Cache in globalState + storage | US-01 | (implicit) | unit | 11.1 |
| FR-041 | Cache entries include ETag/timestamp | US-01 | (implicit) | unit | 11.1 |
| FR-042 | Conditional requests (If-None-Match) | US-01 | Caching scenario | unit, BDD | 11.1, 11.2 |
| FR-043 | Clear Cache command | US-01 | (implicit) | unit | 11.1 |
| FR-044 | Configurable cache expiration | US-01 | Cache expiration scenario | unit, BDD | 11.1, 11.2 |

**Validation**: Every FR maps to at least one US. Every US maps to at least one acceptance scenario. Every acceptance scenario maps to at least one test type and test section.

---

## 17. Technical References

### Architecture & Patterns
- VS Code Extension API Reference, https://code.visualstudio.com/api/references/vscode-api, consulted 2025-07-17
- VS Code Tree View API Guide, https://code.visualstudio.com/api/extension-guides/tree-view, consulted 2025-07-17

### Technology Stack
- Tim Heuer vscode-awesome-copilot source code (architecture reference), https://github.com/timheuer/vscode-awesome-copilot, consulted 2025-07-17
- github/awesome-copilot repository structure, https://github.com/github/awesome-copilot, consulted 2025-07-17

### Security
- OWASP Top 10 2021, https://owasp.org/Top10/, referenced for A03 (Injection), A08 (Integrity), A10 (SSRF)
- VS Code SecretStorage API, https://code.visualstudio.com/api/references/vscode-api#SecretStorage

### Standards & Specifications
- GitHub REST API v3 Documentation, https://docs.github.com/en/rest
- Claude Code Settings Documentation, https://code.claude.com/docs/en/settings, consulted 2025-07-17
- Claude Code Memory Documentation, https://code.claude.com/docs/en/memory, consulted 2025-07-17

---

## 18. Version History

| Version | Date | Author | Summary of Changes |
|---------|------|--------|--------------------|
| 1.0 | 2025-07-17 | Spec Architect | Initial specification. Self-review corrections: added path traversal validation (FR-027), added manifest corruption handling (edge case), added SSRF protection to security section, replaced all instances of "should" with "SHALL", added error codes for all failure paths, added cache expiration scenario to BDD tests. |
