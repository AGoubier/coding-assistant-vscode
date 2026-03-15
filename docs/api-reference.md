# Awesome Coding Assistants - API Reference

## Commands

| Command ID | Title | Description |
|------------|-------|-------------|
| `awesome-coding-assistants.refresh` | Refresh Sources | Invalidate cache and refetch all sources |
| `awesome-coding-assistants.preview` | Preview Item | Open item content in read-only editor |
| `awesome-coding-assistants.install` | Install Item | Download item to workspace |
| `awesome-coding-assistants.update` | Update Item | Download latest version of installed item |
| `awesome-coding-assistants.uninstall` | Uninstall Item | Remove installed item from workspace |
| `awesome-coding-assistants.checkUpdates` | Check for Updates | Scan all installed items for available updates |
| `awesome-coding-assistants.addToken` | Add GitHub Token | Store a personal access token in SecretStorage |
| `awesome-coding-assistants.removeToken` | Remove GitHub Token | Delete a stored token from SecretStorage |
| `awesome-coding-assistants.clearCache` | Clear Cache | Purge all cached data |
| `awesome-coding-assistants.showAllTools` | Toggle Show All Tools | Toggle tool filter on/off |

All commands are currently registered as stubs. They will be implemented in subsequent work packages.

## Extension API

### `activate(context: vscode.ExtensionContext): void`

Entry point called by VS Code when the extension activates. Creates the log output channel and registers all command stubs.

### `deactivate(): void`

Called when the extension is deactivated. Currently a no-op.

## Tree View Context Values

| Context Value | Description |
|--------------|-------------|
| `catalogItem.source` | A source repository node |
| `catalogItem.category` | A category grouping node |
| `catalogItem.item` | An installable item (not installed) |
| `catalogItem.installed` | An installed item |
| `catalogItem.updateAvailable` | An installed item with an update available |
