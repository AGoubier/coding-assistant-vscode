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
- [ ] Source repository configuration and browsing
- [ ] Item preview, install, update, uninstall
- [ ] Tool detection (Copilot, Claude Code, etc.)
- [ ] Update notifications
- [ ] Search and filter
- [ ] Import/export

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
