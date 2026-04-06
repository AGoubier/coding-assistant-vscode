---
name: doc-changelog
description: "Changelog documentation skill. Prepends changelog entries for approved work packages to .sdd/docs/CHANGELOG.md with WP identifier, date, changes, and breaking changes."
argument-hint: "Invoked by Docs Agent Coordinator - do not call directly"
---

# doc-changelog - Changelog Documentation Skill

This skill is invoked by the Docs Agent Coordinator as a subagent. It prepends a changelog entry to `.sdd/docs/CHANGELOG.md` for the approved work package. Each entry includes the WP identifier and title, date, list of changes derived from the WP task list, breaking changes (if any), and dependencies added or changed. Entries are prepended (newest first) so the most recent WP always appears first after the file header.

## Input Contract (FR-005)

This skill receives the following 6 inputs via the coordinator's subagent prompt, as defined in `DOC-SKILL-CONTRACT.md`:

| # | Input | Type | Description |
|---|-------|------|-------------|
| 1 | `skill_path` | Path | Path to this SKILL.md file |
| 2 | `wp_path` | Path | Path to the approved WP file and its task list |
| 3 | `spec_path` | Path | Path to the spec file; includes contract files directory (`.sdd/plans/contracts/<WP-slug>/`) |
| 4 | `source_files` | List(Path) | Implementation source files modified by the WP |
| 5 | `docs_dir` | Path | Path to existing documentation directory (`.sdd/docs/`) for incremental updates |
| 6 | `patterns` | Text | Active doc-domain patterns to avoid (from `.sdd/reviews/doc-patterns.md`) |

## Output Contract

| Field | Value |
|-------|-------|
| **Target file** | `.sdd/docs/CHANGELOG.md` |
| **Action** | Create if missing; prepend new entry if existing (newest first) |
| **Content** | WP identifier, date, changes, breaking changes, dependencies |

## Execution Sequence (FR-006)

1. **Read SKILL.md** -- Load this file for changelog generation instructions
2. **Read existing docs** -- Read `.sdd/docs/CHANGELOG.md` if it exists to understand current content and identify the insertion point
3. **Read source material** -- Read the WP file, spec, contract files, and implementation source files for content
4. **Write documentation** -- Prepend a new changelog entry after the file header, before existing entries (do NOT append to the end)

## Constraints

- Do NOT modify spec files, plan files, contract files, or implementation source files
- Do NOT append entries to the end of CHANGELOG.md -- always prepend (newest first) (FR-017)
- Do NOT recreate CHANGELOG.md from scratch -- preserve all existing entries
- Use plain ASCII only -- no em dashes, smart quotes, or curly apostrophes
- Follow the canonical entry format defined below

---

## Step 1 -- Read the WP File (FR-016)

Read the WP file at `wp_path` to extract the information needed for the changelog entry.

### Instructions

1. Read the WP file in full using `read_file`
2. Extract the following from the WP:
   - **WP identifier**: The WP ID from the filename or header (e.g., "WP03")
   - **WP title**: The title from the WP header (e.g., "Spec Adherence Review Skill")
   - **Task list**: All tasks with their descriptions
   - **Implementation notes**: Any notes about breaking changes, new dependencies, or significant changes
   - **Depends on**: Dependencies listed in the WP metadata
3. Read the spec file at `spec_path` to understand the feature context for writing user-meaningful change descriptions

---

## Step 2 -- Generate Change Descriptions (FR-016.3)

Transform WP task descriptions into user-meaningful changelog entries.

### Instructions

1. For each task in the WP task list, write a concise, user-meaningful change description
2. Change descriptions SHALL be written from the user's perspective, NOT as raw task titles
   - **Good**: "Added JWT refresh endpoint for automatic token renewal"
   - **Bad**: "T03-02 - Write JWT refresh endpoint implementation"
3. Group related tasks into a single change entry if they describe parts of the same feature
4. Omit purely internal tasks that have no user-visible impact (e.g., "Verify encoding compliance") unless the WP consists entirely of internal changes
5. Order changes from most significant to least significant

### Transformation Rules

| Task description pattern | Changelog entry style |
|--------------------------|----------------------|
| "Create ... SKILL.md structure" | "Added [skill name] skill for [purpose]" |
| "Write ... logic" | "Implemented [feature] with [key capability]" |
| "Add ... constraint" | "Added [constraint] to ensure [benefit]" |
| "Verify ... integration" | Omit unless it reveals a user-visible integration point |
| "Fix ... bug" | "Fixed [what was broken] that caused [symptom]" |
| "Refactor ..." | "Improved [what] for [benefit]" or omit if no user impact |

---

## Step 3 -- Identify Breaking Changes (FR-016.4)

Determine if the WP introduces any breaking changes.

### Instructions

1. Check the WP's implementation notes and task descriptions for indicators of breaking changes:
   - API signature changes that affect existing callers
   - Removed or renamed public functions, methods, or endpoints
   - Changed configuration format or required environment variables
   - Data model changes that require migration
   - Removed features or deprecated functionality that was previously available
2. If breaking changes exist, list each one with:
   - What changed
   - What the previous behavior was
   - What the new behavior is
   - Migration steps (if applicable)
3. If no breaking changes exist, omit the "Breaking Changes" subsection entirely

---

## Step 4 -- Identify Dependency Changes (FR-016.5)

Determine if the WP adds or changes any dependencies.

### Instructions

1. Check the WP's task descriptions and implementation notes for dependency changes:
   - New runtime dependencies added (npm packages, pip packages, Go modules, Rust crates)
   - Existing dependency version changes
   - Removed dependencies
   - New dev-only dependencies
2. Check source files for changes to dependency files (`package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, etc.)
3. If dependency changes exist, list each one with the package name and version
4. If no dependency changes exist, omit the "Dependencies" subsection entirely

---

## Step 5 -- Determine Insertion Point (FR-017)

Identify where to insert the new changelog entry in the existing CHANGELOG.md file.

### Instructions

1. Read the existing `.sdd/docs/CHANGELOG.md` file
2. If the file does not exist, create it with a file header and the new entry
3. If the file exists, identify the insertion point:
   - The file header is everything before the first changelog entry (typically the `# Changelog` heading and any introductory text)
   - The first existing entry starts at the first `## ` heading that follows the file header
4. Insert the new entry AFTER the file header and BEFORE the first existing entry
5. Existing entries SHALL be preserved in their original order below the new entry
6. The result: newest entry is always first after the file header

### File Structure

```markdown
# Changelog

All notable changes to this project are documented in this file. Entries are ordered newest first.

---

## [WP<NN>] - <Title> (<YYYY-MM-DD>)    <-- NEW ENTRY (prepended here)

<entry content>

---

## [WP<NN-1>] - <Title> (<YYYY-MM-DD>)  <-- Previous entry (preserved)

<previous entry content>
```

---

## Step 6 -- Write the Changelog Entry (FR-016.1, FR-016.2)

Assemble and write the complete changelog entry.

### Instructions

1. Assemble the entry using the canonical format below
2. Include the current date in `YYYY-MM-DD` format (FR-016.2)
3. Include the WP identifier and title (FR-016.1)
4. Include the list of changes (FR-016.3)
5. Include breaking changes subsection only if breaking changes exist (FR-016.4)
6. Include dependencies subsection only if dependency changes exist (FR-016.5)
7. Prepend the entry to CHANGELOG.md at the insertion point identified in Step 5

### Canonical Entry Format

```markdown
## [WP<NN>] - <WP Title> (<YYYY-MM-DD>)

### Changes

- <user-meaningful change description 1>
- <user-meaningful change description 2>
- <user-meaningful change description 3>

### Breaking Changes

- **<what changed>**: <previous behavior> -> <new behavior>. Migration: <steps>.

### Dependencies

- Added `<package>@<version>` for <purpose>
- Updated `<package>` from <old-version> to <new-version>
- Removed `<package>` (no longer needed because <reason>)
```

### Rules

- The "Breaking Changes" subsection SHALL be omitted if there are no breaking changes
- The "Dependencies" subsection SHALL be omitted if there are no dependency changes
- Each change description SHALL be a single line starting with `- `
- Change descriptions SHALL NOT include task IDs (e.g., "T03-02") -- they are user-facing
- The entry SHALL end with a `---` horizontal rule separator before the next entry
