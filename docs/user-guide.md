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
- [ ] Item preview, install, update, uninstall
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
