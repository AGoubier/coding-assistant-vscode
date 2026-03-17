# Awesome Coding Assistants - Configuration Guide

## Extension Settings

All settings are under the `awesome-coding-assistants` namespace.

### `awesome-coding-assistants.sources`

- **Type**: array of objects
- **Default**: `[]`
- **Description**: Configured source repositories for AI coding assistant customizations.

Each source object:

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `url` | string | Yes | - | GitHub repository URL (e.g., `https://github.com/owner/repo`) |
| `name` | string | Yes | - | Display name for this source |
| `branch` | string | No | `main` | Branch to read from |
| `authTokenKey` | string | No | - | SecretStorage key for GitHub PAT (for private repos) |

### `awesome-coding-assistants.indexUrl`

- **Type**: string
- **Default**: `https://raw.githubusercontent.com/jlacube/awesome-coding-assistants/main/index.json`
- **Description**: URL to the master index JSON file listing available source repositories.

### `awesome-coding-assistants.cacheExpirationMinutes`

- **Type**: integer
- **Default**: `1440` (24 hours)
- **Range**: 5 - 43200
- **Description**: Cache expiration time in minutes.

### `awesome-coding-assistants.showAllTools`

- **Type**: boolean
- **Default**: `false`
- **Description**: Show all tools regardless of workspace detection. When false, only tools detected in the workspace are shown.

### `awesome-coding-assistants.autoCheckUpdates`

- **Type**: boolean
- **Default**: `true`
- **Description**: Automatically check for updates when the extension activates.

### `awesome-coding-assistants.autoCheckIntervalMinutes`

- **Type**: integer
- **Default**: `60`
- **Range**: 5 - 1440
- **Description**: Interval in minutes between automatic update checks.

### `awesome-coding-assistants.newContentDetection`

- **Type**: boolean
- **Default**: `true`
- **Description**: Enable detection of new and removed items in source repositories. When enabled, the extension compares source trees against a stored baseline during auto-checks and highlights new/removed items in the catalog tree with a badge count.

## Environment Variables

No environment variables are required. GitHub authentication is handled via VS Code SecretStorage (managed by the "Add GitHub Token" command).
