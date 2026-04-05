# Changelog

## [0.3.7] - 2026-04-05

### Fixed

- New content notifications no longer count multiple times when the same repository is listed with different branches. Each branch now maintains its own independent baseline.
- Multiple files within the same skill directory (e.g., SKILL.md, README.md, templates/) now count as a single notification instead of one per file.
- "Mark all seen" now properly clears notifications without them reappearing on the next auto-check.

## [0.3.4] - 2026-04-01

### Fixed

- Skill subfolders no longer appear as separate skills in the catalog tree. Skills with nested directories (e.g., `templates/`, `lib/`) are now correctly deduplicated under the skill root folder name.
- `.gitkeep` and `.gitignore` placeholder files no longer appear as catalog items.

## [0.3.3] - 2026-04-01

### Changed

- Reorganized SDD folders into `.sdd/` directory structure.
- Added VS Code tasks for publishing and packaging the extension.

## [0.3.1] - Initial tracked release

- Universal browser, installer, and lifecycle manager for AI coding assistant customizations.
