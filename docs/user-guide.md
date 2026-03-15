# Awesome Coding Assistants - User Guide

## Overview

Awesome Coding Assistants is a VS Code extension that lets you discover, install, and manage AI coding assistant customizations (agents, skills, prompts, slash commands, and more) from GitHub-hosted repositories. It supports customizations for multiple AI tools including GitHub Copilot, Claude Code, and more.

## Getting Started

After installing the extension, you will see an "Awesome Coding Assistants" icon in the Activity Bar (left sidebar). Click it to open the Catalog view.

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
- [ ] Update and uninstall
- [ ] Update notifications
- [ ] Search and filter
- [ ] Import/export

## Browsing Customizations

### Catalog Tree View

The catalog tree view displays customizations in a hierarchy:

1. **Source nodes** - Each configured repository appears as a top-level node
2. **Category nodes** - Expanding a source shows categories (Agents, Instructions, Skills, Prompts, Hooks, Commands, Rules, Modes, Plugins, Workflows)
3. **Item nodes** - Expanding a category shows individual customization items

Items display tool badges:
- **Copilot icon** - Items for GitHub Copilot (`.github/agents/`, `.github/instructions/`, etc.)
- **Claude icon** - Items for Claude Code (`.claude/agents/`, `.claude/rules/`, etc.)
- **AI icon** - Items with unknown tool affiliation

Each item also shows a brief description extracted from the file's first non-heading line (fetched lazily on first view). Installed items display a `$(check) installed` indicator instead.

### Default Source

When no sources are configured, the extension uses the default source: `https://github.com/jlacube/awesome-coding-assistants`

### Master Index

The extension can read a master index JSON file from a configurable URL to discover additional sources. Configure the URL in `awesome-coding-assistants.indexUrl`.

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

**CLAUDE.md special case**: When installing a CLAUDE.md file, you are prompted to choose between placing it at the project root (`CLAUDE.md`) or inside the `.claude/` directory (`.claude/CLAUDE.md`).

### Multi-Root Workspaces

If you have multiple workspace folders open, you will be prompted to select which folder to install to. Single-folder workspaces auto-select without prompting.

### Conflict Resolution

If a file already exists at the target location, you are prompted with three choices:

- **Overwrite** - Replace the existing file with the new version
- **Keep Existing** - Skip the file; no changes are made
- **Show Diff** - Open a side-by-side diff of the existing vs incoming file, then choose to overwrite or keep

Pressing Escape cancels and keeps the existing file.

### Directory Items (Skills)

Some items (like Copilot skills and plugins) consist of multiple files in a directory. These are installed recursively, preserving the directory structure. A progress notification shows the installation status.

### Installation Tracking

Every installation is recorded in `.vscode/awesome-ca-manifest.json` in your workspace. This manifest tracks:
- Source repository and branch
- Installed file paths
- Commit SHA at time of installation
- Installation timestamp

This manifest enables future update detection and uninstall functionality.

### Security

All file paths are validated before writing to prevent path traversal attacks. If an invalid path is detected, the installation is blocked with a security warning.

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
| Toggle Show All Tools | Show/hide items for all tools |

## Troubleshooting

### Extension not showing in Activity Bar

Ensure the extension is installed and enabled. Check the Extensions view (Ctrl+Shift+X).

### Commands not working

Commands are being implemented incrementally. Check the Output panel ("Awesome Coding Assistants" channel) for status messages.
