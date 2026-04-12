# Per-Folder Segregation & Interactive Onboarding - Brainstorming Brief

## The Idea

Two complementary features for the Awesome Coding Assistants VS Code extension:

1. **Per-Folder Segregation**: Source repositories can organize their agents, prompts, and other items into named subfolders (e.g., `frontend-team/`, `backend-team/`). The extension auto-discovers these folders and presents them as a grouping level in the catalog tree, while stripping the folder prefix on install so items land in the standard workspace locations.

2. **Interactive Onboarding Walkthrough**: A VS Code Walkthrough that guides new users through configuring their source URL and browsing the catalog. Supports multiple index URLs for enterprise teams, with transparent migration from the current single-string setting.

Both features ship in the same release. Neither depends on the other, but they complement each other: the walkthrough helps users configure sources (including multi-source enterprise setups), and folder segregation makes those sources more organized.

## Problem & Opportunity

**Folder Segregation**: Teams sharing a single source repository lack a way to organize items by team, project, or concern. A repo with 50+ agents/prompts becomes a flat, overwhelming list. There is no existing mechanism to group items within a source - the extension treats all content at the repo root as a flat structure. The `templates/` prefix stripping in `classifyItem()` was a test-only workaround, not a general solution.

**Onboarding**: New users install the extension and immediately see the default community catalog. Enterprise users need to configure a private source URL, but there is no guided path to do so. The extension relies on users finding the settings page independently. There is also no mechanism to configure multiple index URLs for organizations that maintain both private and community sources.

## Competitive Landscape

| Tool/Extension | Strengths | Weaknesses | Differentiation Opportunity |
|---------------|-----------|------------|---------------------------|
| VS Code Extension Packs | Built-in grouping mechanism | Only groups extensions, not individual config items | Our folder system groups agents/prompts within a single source |
| GitHub Template Repos | Familiar to developers | One repo = one template, no sub-grouping | We allow multiple groups within one source repo |
| Yeoman Generators | Rich scaffolding with prompts | Heavyweight, external tool, no VS Code integration | Lightweight, native VS Code tree with auto-discovery |
| VS Code Snippets repos | Can organize by folder | No install/update lifecycle, manual copy | Full lifecycle management (install, update, uninstall) |
| Copilot Extensions marketplace | Official distribution channel | Closed ecosystem, limited to Copilot | Open source repos, works with Copilot + Claude Code |

## Failed Predecessors

No direct failed predecessors identified in this specific niche. The `templates/` prefix in the existing codebase was an attempt at a similar concept for testing purposes, but was never generalized for production use. The lesson: the mechanism needs to be generic, auto-discovered, and not hardcoded.

## Vision

Source repository maintainers organize items into clear groups that make sense for their teams. A frontend team sees their agents grouped under "Frontend Team", a backend team under "Backend Team". Enterprise users install the extension and are immediately guided to configure their private source, with the option to also keep the community catalog. The experience is polished and requires no documentation reading.

## Target Users

**Repository Maintainers**: Teams maintaining shared source repos with many items. They want to organize items into logical groups without changing the consumer experience.

**Enterprise Admins**: IT administrators deploying the extension across an organization. They pre-configure the private index URL via managed settings (Intune/GPO) and want users to have a guided first-run experience.

**New Individual Users**: Developers installing the extension for the first time. They want to quickly understand what the extension does and start browsing available items.

## Core Value Proposition

Organized, guided access to coding assistant configurations - from first install to daily use - across both community and enterprise source repositories.

## Key Capabilities

### P1 - Must-Have (MVP)

Both features are equal priority and ship together.

**Folder Segregation:**
- Auto-discover folders in source repos by structural detection (folder contains `.github/` or `.claude/` subdirectories)
- Display folders as a grouping level in the catalog tree: Source > Folder > Tool > Category > Items
- When no folders exist, display current hierarchy unchanged: Source > Tool > Category > Items
- When folders AND root-level items coexist, root items appear under a virtual "Default" folder
- Strip folder prefix on install - items land in standard workspace locations regardless of source folder
- Track full source path (including folder prefix) in manifest for update/uninstall lifecycle
- Auto-format folder names for display (dashes/underscores to spaces, title case)
- Hide folders with no recognized content (empty folders)
- Handle cross-folder name conflicts with user choice prompt
- Search works within and across folders
- Unify the existing `templates/` prefix stripping into the folder system

**Interactive Onboarding:**
- VS Code Walkthrough with 2 steps:
  - Step 1: "Configure Your Source" - button opens the indexUrl setting; completionEvent: `onSettingChanged:awesome-coding-assistants.indexUrl`
  - Step 2: "Browse the Catalog" - button opens the catalog view; completionEvent: `onView:awesomeCodingAssistants.catalog`
- Walkthrough auto-opens until completed (VS Code handles completion state)
- Change `indexUrl` setting to accept both string and string array (dual-type with runtime coercion)
- Union merge with dedup when multiple index URLs are configured (dedup by source URL@branch key)
- Multiple re-access points: command palette command + Help menu entry
- Enterprise pre-configuration via VS Code managed settings (Intune/GPO/MDM policies)

### P2 - Important (next increment)

- Folder-level badges for new/updated content
- Folder-level install/uninstall all
- Walkthrough localization (l10n)
- Index URL validation with error diagnostics in Settings UI

### P3 - Nice-to-Have (future)

- Nested folders (multi-level hierarchy)
- Folder descriptions from metadata files
- Walkthrough step for workspace tool detection ("You already have Copilot agents installed")
- Analytics on walkthrough completion rates

## Decision Log

| Decision | Chosen Approach | Alternatives Considered | Rationale |
|----------|----------------|------------------------|-----------|
| Folder location | Source repo side (remote) | Local workspace side | Folders organize the source catalog, not the installation target. Items always install to standard workspace paths. |
| Folder depth | Single-level only | Multi-level nesting | Keeps the tree manageable. Multi-level can be added later as P3. |
| Folder detection | Structural (contains .github/ or .claude/) | Explicit allowlist; Any directory is a folder | Structural detection is precise and avoids false positives from unrelated directories. |
| Root items display | "Default" folder when folders exist; flat when no folders | Always show "Default"; Root items at folder level; Hide root items | Fully backward compatible for repos without folders, clean grouping when folders exist. |
| Folder name display | Auto-formatted (title case, replace dashes/underscores) | Raw from repo; Metadata-driven name | Good enough without extra files. Metadata-driven can be added as P3. |
| Empty folders | Hidden | Shown | Reduces clutter. Users don't need to see empty organizational structure. |
| templates/ prefix | Unified into folder system | Keep special; Remove entirely | templates/ was test-only and the folder system generalizes the concept. Cleaner codebase. |
| Cross-folder conflicts | User picks which to install | Auto-rename; Block install | Consistent with existing conflict handling patterns in the extension. |
| Index metadata for folders | Pure auto-discovery (no metadata) | Index.json folder field; Folder manifest file | Zero configuration for repo maintainers. Just create a folder with the right structure. |
| Performance approach | Single-pass (no optimization) | Lazy loading; Caching folder structure | The GitHub tree API already returns flat entries. Classification is cheap. |
| Onboarding mechanism | VS Code Walkthrough API | Notifications; Custom webview; Info bar | Native VS Code UX, auto-opens on install, built-in completion tracking, accessible from Help menu. |
| Walkthrough steps | 2 steps (configure + browse) | 3 steps (configure + browse + install); 1 step (configure only) | Minimal but covers the two essential actions. More steps can be added later. |
| Walkthrough trigger | Auto-open until completed | First install only; Never auto-open | VS Code natively handles "completed" state. Ensures users complete onboarding even if they dismissed it initially. |
| indexUrl type | Dual-type (string OR array) with runtime coercion | Delimited string; New separate setting | Transparent migration - existing string configs keep working. Code normalizes to array internally. |
| Multiple index merge | Union merge with dedup by URL@branch | Independent (allow dups); Priority-based | Dedup prevents confusion from seeing the same source twice. Union ensures all sources are visible. |
| Default URL in walkthrough | User chooses whether to keep community source | Always keep; Always remove | Respects user autonomy. Enterprise users may want to remove community source. |
| Walkthrough re-access | Command palette + Help menu | Command palette only; Status bar; Activity bar | Multiple access points increase discoverability without being intrusive. |
| Enterprise configuration | VS Code managed settings (Intune/GPO) | Separate config file; Environment variables | Leverages existing VS Code enterprise infrastructure. No custom tooling needed. |

## Out of Scope

- **Nested folders** (multi-level hierarchy): Deferred to P3. Single-level covers the primary use case.
- **Folder access control / permissions**: Out of scope - this is a catalog browsing concern, not a security boundary.
- **Automatic migration of existing installs**: Items already installed from a repo that later adds folders keep their existing manifest entries.
- **Folder ordering / custom sort**: Folders display in alphabetical order. Custom ordering is not addressed.
- **Walkthrough customization per source**: Each source cannot define its own walkthrough steps.
- **Notification-based onboarding**: Only the Walkthrough mechanism is used. No toast notifications for first-run.

## Assumptions & Risks

| Assumption | Risk if Wrong |
|-----------|---------------|
| Source repos use single-level folders | If repos need deeper nesting, the single-level constraint would require refactoring |
| VS Code Walkthrough API supports onSettingChanged completion events | If not supported, need alternative completion detection |
| Structural detection (folder contains .github/ or .claude/) has no false positives | Repos with documentation or example directories matching the pattern could create phantom folders |
| indexUrl dual-type (string or array) works with VS Code Settings UI | JSON schema might not cleanly render a oneOf type in the settings editor |
| Enterprise managed settings override user settings | Depends on VS Code policy scope support for custom extensions |
| Union merge with dedup is deterministic | If two indexes define the same source with different metadata (name, description), merge order matters |

## Research Findings

**VS Code Walkthrough API** ([Contribution Points Reference](https://code.visualstudio.com/api/references/contribution-points#contributes.walkthroughs), consulted 2025-07-14):
- Walkthroughs are defined in `contributes.walkthroughs` in package.json
- Each walkthrough has an id, title, description, and array of steps
- Steps support `completionEvents`: `onCommand:`, `onSettingChanged:`, `onView:`, `onContext:`, `onLink:`, `extensionInstalled:`
- Media can be markdown (`.md`) or images (`.png`, `.svg`)
- `when` clauses control conditional display (e.g., per-platform steps)
- Walkthroughs auto-open once on extension install and remain accessible via Help > Get Started

**VS Code Enterprise Deployment** ([Enterprise Setup Docs](https://code.visualstudio.com/docs/setup/enterprise), consulted 2025-07-14):
- Extensions can be pre-installed and managed via Intune, GPO, or MDM policies
- Configuration settings can be enforced via managed default settings
- VS Code supports policy-driven configuration that prevents user override
- Custom extensions can leverage the same managed settings infrastructure

**Getting Started Sample** ([microsoft/vscode-extension-samples](https://github.com/microsoft/vscode-extension-samples/tree/main/getting-started-sample), consulted 2025-07-14):
- Reference implementation shows walkthrough with command registration
- Steps use markdown media files for rich content
- Commands are registered in extension.ts and linked via `command:` URIs in walkthrough media
- Minimal structure: package.json contributes + media files + command handlers

**Current Codebase Analysis** (direct code review):
- `classifyItem()` in toolDetector.ts strips `templates/` prefix - this generalizes into folder detection
- `sourceKey()` in sourceRegistry.ts uses `url@branch` format - stable dedup key
- GitHubTreeEntry[] is already a flat array - folder detection adds no API calls
- Manifest uses `installationId` format `url@branch#path` - full path including folder prefix preserves uniqueness
- CatalogTreeProvider already supports hierarchical tree rendering - adding a folder level is straightforward

## Risk Assessment

| Risk | Likelihood | Impact | Source |
|------|-----------|--------|--------|
| JSON Schema oneOf (string or array) renders poorly in VS Code Settings UI | medium | medium | [VS Code Settings Editor](https://code.visualstudio.com/docs/editor/settings) |
| Structural detection false positives from docs/examples directories | low | low | Codebase analysis |
| Walkthrough completion events not firing for setting changes via managed policies | low | high | [VS Code Walkthrough API](https://code.visualstudio.com/api/references/contribution-points#contributes.walkthroughs) |
| Enterprise managed settings not supported for custom extension settings | low | high | [VS Code Enterprise Docs](https://code.visualstudio.com/docs/setup/enterprise) |
| Tree view performance with many folders and items | low | low | Codebase analysis - single-pass classification is cheap |

## Technical Feasibility

| Item | Status | Evidence | Source |
|------|--------|----------|--------|
| Folder auto-discovery from GitHubTreeEntry[] | Confirmed feasible | Flat tree entries already contain full paths; grouping by first segment is trivial | Codebase: catalogTree.ts, toolDetector.ts |
| VS Code Walkthrough contribution | Confirmed feasible | Well-documented API with reference sample and stable since VS Code 1.60 | [Contribution Points](https://code.visualstudio.com/api/references/contribution-points#contributes.walkthroughs) |
| Dual-type indexUrl setting | Needs validation | VS Code Settings UI JSON Schema support for oneOf needs testing | N/A |
| Managed settings for enterprise | Needs validation | Documented for built-in settings; custom extension settings need verification | [Enterprise Docs](https://code.visualstudio.com/docs/setup/enterprise) |
| onSettingChanged completion event | Confirmed feasible | Documented in walkthrough API reference | [Contribution Points](https://code.visualstudio.com/api/references/contribution-points#contributes.walkthroughs) |
| Union merge of multiple index sources | Confirmed feasible | sourceRegistry.ts already merges master index + user sources with dedup | Codebase: sourceRegistry.ts |

## Open Questions

1. **JSON Schema oneOf rendering**: How does VS Code's Settings UI render a setting that accepts both string and string[]? Does it show a clean input or a confusing JSON editor? Needs hands-on testing.
2. **Managed settings for custom extensions**: Can enterprise admins set `awesome-coding-assistants.indexUrl` via Intune/GPO policies? Needs verification with actual MDM deployment.
3. **Merge order for duplicate sources**: When two indexes define the same source (same URL@branch), which metadata (name, description, categories) wins? First-seen or last-seen?
4. **Walkthrough media format**: Should the walkthrough steps use markdown files (richer content, can embed command links) or static images (simpler, no maintenance)?
5. **Folder detection edge case**: How to handle repos where `.github/` or `.claude/` appears at multiple levels (e.g., `team1/.github/agents/` AND `team1/subproject/.github/agents/`)? Current design limits to single-level, but detection needs to handle deeper structures gracefully.

## Session Summary

- Rounds of Q&A: 10
- Topics explored: folder location (remote vs local), folder depth, detection algorithm, backward compatibility, tree hierarchy, root items display, folder naming, empty folders, cross-folder conflicts, index metadata, performance, templates/ unification, walkthrough mechanism, walkthrough steps, walkthrough trigger, indexUrl migration, multiple index merge, enterprise configuration, default URL handling, walkthrough re-access, MVP scope, priority ranking
- Alternatives generated: 35+ (across all decision points)
- Key pivot points: Round 2 - critical clarification that folders are on the SOURCE REPO side, not local workspace. Round 10 - refined "Default" folder to only appear when real folders exist alongside root items.

## Next Step

Hand off to the Spec Architect agent to translate this brief into a formal specification.
