# Awesome Coding Assistants - User Guide

## Overview

Awesome Coding Assistants is a VS Code extension that lets you discover, install, and manage AI coding assistant customizations (agents, skills, prompts, slash commands, and more) from GitHub-hosted repositories. It supports customizations for multiple AI tools including GitHub Copilot, Claude Code, and more.

## Getting Started

After installing the extension, you will see an "Awesome Coding Assistants" icon in the Activity Bar (left sidebar). Click it to open the Catalog view. You can also find a collapsed "Awesome Coding Assistants" view in the Explorer panel.

### Initial Setup

If no sources are configured, the welcome view will guide you to configure a source repository. You can configure sources in VS Code settings under `awesome-coding-assistants.sources`.

## Features

Features are being implemented incrementally. Current status:

- [x] Extension activation with Activity Bar view
- [x] Source repository configuration and browsing (catalog tree view)
- [x] Tool classification (Copilot/Claude Code badges on tree items)
- [x] Welcome view when no sources configured
- [x] Refresh command to reload all sources
- [x] Master index support for discovering source repositories
- [x] Item preview (read-only editor tab with file content)
- [x] Install customizations with conflict resolution and manifest tracking
- [x] Installed/update-available badges on tree items
- [x] Check for updates (SHA comparison with upstream)
- [x] Update with diff view (accept/reject)
- [x] Uninstall with confirmation
- [x] Auto-check for updates on activation
- [x] Smart tool detection (auto-filter catalog by workspace tools)
- [x] Practice bundles (one-click install of curated item collections)
- [x] Search and filter (keyword search across all sources)
- [x] New content detection (badge and markers for new/removed items)
- [ ] Import/export

## Browsing Customizations

### Catalog Tree View

The catalog tree view displays customizations in a hierarchy:

1. **Source nodes** - Each configured repository appears as a top-level node
2. **Folder nodes** - If the source repository contains subfolders with AI tool configurations, folder nodes appear as an intermediate level (see "Folder Navigation" below)
3. **Category nodes** - Expanding a source (or folder) shows categories (Agents, Instructions, Skills, Prompts, Hooks, Commands, Rules, Modes)
4. **Item nodes** - Expanding a category shows individual customization items

Items display tool badges:
- **Copilot icon** - Items for GitHub Copilot (`.github/agents/`, `.github/instructions/`, etc.)
- **Claude icon** - Items for Claude Code (`.claude/agents/`, `.claude/rules/`, etc.)
- **AI icon** - Items with unknown tool affiliation

Each item also shows a brief description extracted from the file's first non-heading line (fetched lazily on first view). Installed items display a `$(check) installed` indicator instead.

### Folder Navigation

Source repositories can organize their customizations into subfolders (e.g., `frontend-team/`, `backend-team/`). When folders are detected, the catalog tree inserts a folder level between the source and category nodes:

**Source > Folder > Category > Items**

- Folder names are auto-formatted for display: dashes and underscores become spaces, and each word is title-cased (e.g., `frontend-team` displays as "Frontend Team").
- A **"Default"** folder appears when the repository has both subfolder items and root-level items. It groups root-level items (those not inside any subfolder).
- Empty folders (containing no recognized AI tool items) are hidden automatically.
- If a repository has no subfolders, the tree displays the original flat hierarchy: **Source > Category > Items**.

Folder detection is automatic -- repository maintainers do not need to add any configuration. Any first-level directory containing `.github/` or `.claude/` subdirectories qualifies as a folder.

When installing items from a subfolder, the folder prefix is stripped so the item lands in the same workspace location as if it came from the repository root.

### Default Source

When no sources are configured, the extension uses the default source: `https://github.com/jlacube/awesome-coding-assistants`

### Master Index

The extension can read master index JSON files from one or more configurable URLs to discover additional sources. Configure URLs in `awesome-coding-assistants.indexUrl`.

#### Multiple Index URLs (WP19)

The `indexUrl` setting accepts an array of strings. You can configure multiple index URLs to combine sources from different catalogs (e.g., a community index and a private enterprise index):

```jsonc
// settings.json
{
  "awesome-coding-assistants.indexUrl": [
    "https://example.com/community-index.json",
    "https://internal.corp.com/enterprise-index.json"
  ]
}
```

When multiple URLs are configured:

- All indexes are fetched in parallel for fast loading
- Source lists are union-merged across all indexes
- Duplicate sources (same URL and branch) are deduplicated -- the version from the earlier URL in the array wins
- If one index fails to load, the remaining indexes still work (partial failure is handled gracefully)
- If all indexes fail, the extension falls back to user-configured sources and the default source
- Only HTTPS URLs are accepted; non-HTTPS URLs are rejected with a warning

**Backward compatibility**: If you have a single string in your `indexUrl` setting from a previous version, it is automatically coerced to a single-element array at runtime. No manual migration is needed.

**Enterprise pre-configuration**: Administrators can set `indexUrl` in machine-level `settings.json` (via Intune, GPO, or image-based provisioning) to point users to a private catalog on first launch.

### Refreshing

Click the refresh icon in the view title bar (or run "Awesome Coding Assistants: Refresh Sources" from the command palette) to invalidate all caches and reload the catalog tree with fresh data from GitHub.

## Previewing Items

Before installing a customization, you can preview its content in a read-only editor tab.

### How to Preview

1. In the catalog tree view, find the item you want to preview
2. Click the **eye icon** that appears on hover next to the item name
3. A read-only editor tab opens showing the file's content

### Preview for Directory Items

For items that represent directories (e.g., Copilot skills), the preview automatically displays the primary file:
- **SKILL.md** (for Copilot skill directories)
- **README.md** (if no SKILL.md exists)
- The first `.md` file alphabetically (as a fallback)

If no previewable file is found, a message indicates this.

### Private Repository Preview

For items in private repositories, preview works if you have a valid GitHub token stored. Use "Add GitHub Token" to configure authentication.

### Error Handling

If a preview fetch fails (network error, authentication issue), an error notification appears: "Failed to fetch preview: {error details}".

### Caching

Preview content is cached in memory for the current session. Use the Refresh command to clear the preview cache and re-fetch content.

## Installing Customizations

Install customizations directly to your workspace with one click.

### How to Install

1. In the catalog tree view, find the item you want to install
2. Click the **download icon** that appears on hover next to the item name (or right-click and select "Install")
3. The item is downloaded and placed in the correct workspace directory

### Target Directories

Items are installed to the correct tool-specific directory automatically:

| Tool | Category | Target Directory |
|------|----------|------------------|
| Copilot | Agents | `.github/agents/` |
| Copilot | Instructions | `.github/instructions/` |
| Copilot | Skills | `.github/skills/` |
| Copilot | Prompts | `.github/prompts/` |
| Copilot | Hooks | `.github/hooks/` |
| Copilot | Chat Modes | `.github/chatmodes/` |
| Claude Code | Agents | `.claude/agents/` |
| Claude Code | Rules | `.claude/rules/` |
| Claude Code | Commands | `.claude/commands/` |
| Claude Code | Hooks | `.claude/hooks/` |

**CLAUDE.md special case**: When installing a CLAUDE.md file, you are prompted to choose between placing it at the project root (`CLAUDE.md`) or inside the `.claude/` directory (`.claude/CLAUDE.md`).

### Multi-Root Workspaces

If you have multiple workspace folders open, you will be prompted to select which folder to install to. Single-folder workspaces auto-select without prompting.

### Conflict Resolution

If a file already exists at the target location, you are prompted with three choices:

- **Overwrite** - Replace the existing file with the new version
- **Keep Existing** - Skip the file; no changes are made
- **Show Diff** - Open a side-by-side diff of the existing vs incoming file, then choose to overwrite or keep

Pressing Escape cancels and keeps the existing file.

### Cross-Folder Conflict Resolution (WP17)

When a source repository has multiple folders (e.g., `frontend-team/` and `backend-team/`), different folders may contain items with the same filename that would install to the same location in your workspace (e.g., both provide `.github/agents/helper.agent.md`).

When this conflict is detected during installation:

1. A **QuickPick dialog** appears listing all folder versions of the conflicting item
2. Each option shows the folder name and full source path (e.g., "Frontend Team/helper.agent.md")
3. Select the version you want to install
4. Press Escape to cancel the installation entirely -- no file is written

If you have already installed an item from one folder and attempt to install the same-named item from a different folder, the conflict dialog also appears, allowing you to choose which version to keep.

### Directory Items (Skills)

Some items (like Copilot skills and plugins) consist of multiple files in a directory. These are installed recursively, preserving the directory structure. A progress notification shows the installation status.

### Installation Tracking

Every installation is recorded in `.vscode/awesome-ca-manifest.json` in your workspace. This manifest tracks:
- Source repository and branch
- Full source path (including folder prefix for folder items) (WP17)
- Installed file paths (folder prefix stripped for workspace location) (WP17)
- Commit SHA at time of installation
- Installation timestamp

This manifest enables future update detection and uninstall functionality. For folder items, the manifest preserves both the original source path (for fetching updates) and the stripped workspace path (for locating installed files).

### Security

All file paths are validated before writing to prevent path traversal attacks. If an invalid path is detected, the installation is blocked with a security warning.

## Updating Customizations

The extension tracks the version (commit SHA) of each installed customization and can detect when upstream changes are available.

### Checking for Updates

1. Click the **sync icon** in the Catalog view title bar, or run "Check for Updates" from the Command Palette
2. The extension compares each installed item's recorded SHA with the latest commit SHA from GitHub
3. Items with available updates show an **update badge** in the tree view

### Auto-Check

By default, the extension automatically checks for updates:
- 5 seconds after activation (to not block startup)
- At a configurable interval (default: every 60 minutes)

Configure via settings:
- `awesome-coding-assistants.autoCheckUpdates` (default: `true`) - enable/disable auto-check
- `awesome-coding-assistants.autoCheckIntervalMinutes` (default: `60`, range: 5-1440)

### Applying an Update

1. Click the **download icon** on an item with an update badge
2. A diff view opens showing your installed version vs the upstream version
3. Choose **Accept Update** to apply the new version, or **Reject** to keep your current file
4. On accept, the file is overwritten and the manifest is updated with the new version

## Uninstalling Customizations

1. Right-click an installed item in the tree view and select **Uninstall**
2. Confirm the deletion in the modal dialog
3. The file(s) are deleted from your workspace and the manifest entry is removed
4. The tree view refreshes to remove the installed badge

If you have already manually deleted the file, uninstall will still clean up the manifest entry.

## Smart Tool Detection

The extension automatically detects which AI coding tools are configured in your workspace and filters the catalog to show only relevant items.

### How It Works

When you open the catalog, the extension scans your workspace for tool-specific marker files:

| Tool | Detected When |
|------|--------------|
| GitHub Copilot | `.github/agents/` directory or `.github/copilot-instructions.md` exists |
| Claude Code | `.claude/` directory or `CLAUDE.md` at workspace root exists |

If tool markers are found, the catalog tree only displays items compatible with the detected tools. Categories with no matching items are hidden.

### Show All Tools

To see all available items regardless of workspace detection:

1. Click the **filter icon** in the Catalog view title bar, or run "Show All Tools" from the Command Palette
2. A notification confirms: "Showing all tools"
3. Click again (now labeled "Show Detected Tools Only") to re-enable filtering: "Filtering by detected tools"

The toggle persists as a workspace-level setting (`awesome-coding-assistants.showAllTools`).

### No Tools Detected

When no AI tool markers are found in the workspace, the catalog shows all items by default (no filtering is applied).

### Workspace Changes

The extension automatically refreshes tool detection when workspace folders are added or removed.

## New Content Detection

The extension detects new and removed items in your configured sources and highlights them in the catalog tree.

### How It Works

When the extension auto-checks for updates (on activation and at configurable intervals), it compares the current source tree against a stored baseline. New items (added since the last check) and removed items (present in the baseline but no longer in the source) are tracked.

### Badge and Notifications

- A **badge** appears on both the Catalog Activity Bar icon and the Explorer panel view, showing the combined count of new items, removed items, and available updates.
- The badge tooltip breaks down the counts: e.g., "2 new, 1 removed, 3 updates".
- An information notification appears when changes are detected: e.g., "3 new items, 1 removed, 2 updates available."

### New Item Markers

When you expand a category, new items appear with a **sparkle icon** and "new" description. Expanding a category automatically marks those items as seen, reducing the badge count.

### Removed Item Markers

Items that have been removed from the upstream source appear as synthetic entries with a **warning icon** and "removed upstream" description. If a removed item is installed locally, it shows "removed upstream - installed" and you can uninstall it. Removed items that are not installed are informational only and cannot be clicked.

### Mark All as Seen

To dismiss all new and removed item markers at once, click **Mark All as Seen** in the Catalog view title bar. This clears all new/removed tracking data and resets the badge.

### Configuration

- `awesome-coding-assistants.newContentDetection` (default: `true`) -- Enable or disable new content detection.

## Practice Bundles

Org leads can define named collections of customizations ("practice bundles") in source repos. Users can install all items in a bundle with one click.

### How Bundles Work

Bundles are JSON files stored in the `bundles/` directory of a source repo. Each bundle lists a set of customization items to install together. For example, a "Team Onboarding" bundle might include agents, prompts, and rules that every new team member should have.

### Browsing Bundles

If a source repository contains a `bundles/` directory with `.json` files, a **Bundles** category appears under that source in the catalog tree. Expanding it shows each bundle with a count badge (e.g., "5 items"). Expanding a bundle shows its individual items with tool and category info.

### Installing a Bundle

1. Find a bundle in the catalog tree under the "Bundles" category
2. Click the **Install Bundle** action (package icon) on the bundle item, or right-click and select "Install Bundle"
3. Select the target workspace folder (if multi-root)
4. A progress notification shows installation status: "Installing bundle '{name}': {current}/{total}"
5. After completion, a summary notification shows how many items were installed

### Cross-Source Bundles

A bundle can reference items from other configured source repos. If a referenced source is not configured, a warning is shown and that item is skipped.

### Required vs Optional Items

- **Required items** (default): if installation fails, remaining items are not installed
- **Optional items**: if installation fails, the bundle continues with remaining items

## Commands

Access commands via Cmd/Ctrl+Shift+P and search for "Awesome Coding Assistants":

| Command | Description |
|---------|-------------|
| Refresh Sources | Refresh all configured sources |
| Preview Item | Preview an item's content |
| Install Item | Install an item to your workspace |
| Update Item | Update an installed item |
| Uninstall Item | Remove an installed item |
| Check for Updates | Check all installed items for updates |
| Add GitHub Token | Store a GitHub personal access token |
| Remove GitHub Token | Remove a stored token |
| Clear Cache | Clear all cached data |
| Toggle Show All Tools | Show/hide items for all tools ("Show All Tools" / "Show Detected Tools Only") |
| Install Bundle | Install all items in a practice bundle |
| Search Customizations | Search the catalog by keyword |
| Clear Search | Remove the active search filter |
| Mark All as Seen | Dismiss all new/removed content markers |

## Search and Filter

Use the Search command to quickly find customizations across all configured sources without manually expanding categories.

### Searching

1. Click the **Search** icon (magnifying glass) in the tree view title bar, or run the command **Awesome Coding Assistants: Search Customizations** from the Command Palette.
2. Type a keyword or phrase and press Enter.
3. The tree narrows to show only items matching your query. Categories with no matches are hidden.
4. Multi-word queries: all words must match (AND logic). For example, "copilot agents" shows only Copilot agent items.

### What is Searched

- Item name (e.g., "TypeScript Best Practices")
- Item description
- File path (e.g., `.github/agents/typescript-review.agent.md`)
- Tool type ("copilot" or "claude-code")
- Category ("agents", "prompts", "rules", etc.)

### Clearing the Search

- Click the **Clear Search** button in the tree view title bar (visible only when a search is active).
- Or run the command **Awesome Coding Assistants: Clear Search** from the Command Palette.
- The full unfiltered tree is restored.

### Empty Results

If no items match your query, a "No items match '{query}'" message is displayed in the tree.

## Troubleshooting

### Extension not showing in Activity Bar

Ensure the extension is installed and enabled. Check the Extensions view (Ctrl+Shift+X).

### Commands not working

Commands are being implemented incrementally. Check the Output panel ("Awesome Coding Assistants" channel) for status messages.
