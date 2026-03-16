# Awesome Coding Assistants

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/jlacube.awesome-coding-assistants?label=VS%20Code%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=jlacube.awesome-coding-assistants)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE.md)

> Inspired by [Awesome Copilot](https://github.com/timheuer/vscode-awesome-copilot) by [Tim Heuer](https://github.com/timheuer) - the original VS Code extension for browsing and downloading GitHub Copilot customizations from the [awesome-copilot](https://github.com/github/awesome-copilot) repository.

**Browse, preview, install, and manage AI coding assistant customizations - all from within VS Code.**

Awesome Coding Assistants is a universal catalog and lifecycle manager for customizations across multiple AI coding tools. Discover community-contributed agents, prompts, instructions, skills, rules, modes, and more - then install them into your workspace with a single click.

---

## Supported Tools

| Tool | Status | Categories |
|------|--------|------------|
| **GitHub Copilot** | Fully supported | Agents, Instructions, Skills, Prompts, Hooks, Modes |
| **Claude Code** | Fully supported | Agents, Rules, Commands, Hooks |
| **Kiro** | Planned | - |
| **KiloCode** | Planned | - |
| **OpenCode** | Planned | - |

## Features

### Browse & Discover

- **Catalog tree view** in the Activity Bar and Explorer sidebar
- Browse customizations organized by source, category, and tool
- **Smart tool detection** - automatically shows items relevant to tools detected in your workspace
- **Search** across all sources with multi-word filtering
- **Master index** support - discover sources from a curated community index

### Preview & Install

- **Preview** any customization in a read-only editor before installing
- **One-click install** places files in the correct tool-specific location:
  - Copilot agents to `.github/agents/`
  - Copilot instructions to `.github/instructions/`
  - Copilot skills to `.github/skills/`
  - Claude rules to `.claude/` or project root
  - And more...
- **Conflict resolution** - prompted to overwrite, keep, or diff when a file already exists
- **Multi-root workspace** support with folder selection

### Lifecycle Management

- **Automatic update detection** checks for upstream changes on a configurable interval
- **Visual update badges** on items with available updates
- **Diff-based updates** - review changes before applying
- **Clean uninstall** removes files and cleans up the installation manifest
- **Installation tracking** via a local manifest with commit SHA, timestamps, and metadata

### Bundles

Install curated sets of customizations in one action:

- **Practice bundles** group related items across tools and categories
- **Cross-source bundles** can reference items from different repositories
- **Required vs optional items** - bundles gracefully handle partial failures

### Private Repositories

- **GitHub token management** via VS Code's SecretStorage (encrypted)
- Access private source repositories with personal access tokens
- Tokens are never logged or exposed

---

## Getting Started

### 1. Install the Extension

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jlacube.awesome-coding-assistants) or search for "Awesome Coding Assistants" in the Extensions view.

### 2. Browse the Catalog

Open the **Awesome Coding Assistants** view from the Activity Bar (constellation icon) or find it collapsed in the Explorer sidebar. The extension ships with a default community source.

### 3. Add Custom Sources

Add your own source repositories in Settings:

```jsonc
// settings.json
"awesome-coding-assistants.sources": [
  {
    "url": "https://github.com/your-org/your-customizations",
    "name": "My Team's Customizations",
    "branch": "main"
  }
]
```

For private repos, first run **Awesome Coding Assistants: Add GitHub Token** from the Command Palette, then reference the token key:

```jsonc
{
  "url": "https://github.com/your-org/private-repo",
  "name": "Private Customizations",
  "authTokenKey": "my-github-token"
}
```

### 4. Install Customizations

Click the **preview** (eye) icon to inspect a customization, then click **install** (cloud download) to add it to your workspace.

---

## Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `awesome-coding-assistants.sources` | array | `[]` | Source repositories to browse |
| `awesome-coding-assistants.indexUrl` | string | Community index URL | Master index JSON URL for source discovery |
| `awesome-coding-assistants.cacheExpirationMinutes` | integer | `1440` (24h) | Cache expiration in minutes (5 - 43200) |
| `awesome-coding-assistants.showAllTools` | boolean | `false` | Show items for all tools, not just detected ones |
| `awesome-coding-assistants.autoCheckUpdates` | boolean | `true` | Automatically check for updates on activation |
| `awesome-coding-assistants.autoCheckIntervalMinutes` | integer | `60` | Auto-check interval in minutes (5 - 1440) |

---

## Commands

All commands are available from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Description |
|---------|-------------|
| **Refresh Sources** | Reload all sources and refresh the catalog |
| **Search Customizations** | Filter items across all sources |
| **Check for Updates** | Scan installed items for upstream changes |
| **Toggle Show All Tools** | Show/hide items for undetected tools |
| **Add GitHub Token** | Store a token for private repo access |
| **Remove GitHub Token** | Delete a stored token |
| **Clear Cache** | Force re-fetch all source data |

---

## Creating a Source Repository

A source repository is any GitHub repo containing AI coding assistant customization files. The extension auto-detects items based on file paths and conventions:

```
your-source-repo/
  .github/
    agents/          # Copilot agent definitions (.agent.md)
    instructions/    # Copilot instructions (.instructions.md)
    skills/          # Copilot skill packages (SKILL.md)
    prompts/         # Copilot prompt files (.prompt.md)
    hooks/           # Copilot hooks (.json)
    chatmodes/       # Copilot chat modes
  .claude/
    agents/          # Claude Code agents
    rules/           # Claude Code rules
    commands/        # Claude Code slash commands
  .awesome-bundles/  # Optional practice bundles (JSON)
```

### Master Index

Maintain a curated `index.json` listing multiple sources:

```json
{
  "$schema": "https://raw.githubusercontent.com/jlacube/awesome-coding-assistants/main/index.schema.json",
  "version": "1.0.0",
  "sources": [
    {
      "url": "https://github.com/example/copilot-customizations",
      "name": "Example Copilot Pack",
      "description": "A collection of Copilot agents and instructions",
      "tools": ["copilot"],
      "categories": ["agents", "instructions"]
    }
  ]
}
```

---

## Requirements

- VS Code 1.85.0 or later
- Internet access to fetch source repositories from GitHub

---

## Contributing

Contributions are welcome! Whether it's a bug fix, a new feature, or a community source to add to the index.

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

---

## License

This project is licensed under the [MIT License](LICENSE.md).
