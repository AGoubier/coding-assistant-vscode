# Doc Skill Contract

This document defines the common input/output contract that all documentation skills (`doc-*/SKILL.md`) must follow. It serves as the developer guide for creating new doc skills.

Reference: FR-005, FR-006 of `.sdd/specs/007-docs-agent.spec.md`

---

## 1. Inputs (FR-005)

Every doc skill receives the following 6 inputs in its subagent prompt from the coordinator:

| # | Input | Type | Description |
|---|-------|------|-------------|
| 1 | `skill_path` | Path | Path to this skill's SKILL.md file |
| 2 | `wp_path` | Path | Path to the approved WP file and its task list |
| 3 | `spec_path` | Path | Path to the spec file; includes contract files directory (`.sdd/plans/contracts/<WP-slug>/`) |
| 4 | `source_files` | List(Path) | Implementation source files modified by the WP |
| 5 | `docs_dir` | Path | Path to existing documentation directory (`.sdd/docs/`) for incremental updates |
| 6 | `patterns` | Text | Active doc-domain patterns to avoid (from `.sdd/reviews/doc-patterns.md`) |

---

## 2. Execution Sequence (FR-006)

Every doc skill SHALL execute these 4 steps in order:

1. **Read SKILL.md** - Load its own SKILL.md to get documentation generation instructions
2. **Read existing docs** - Read the current documentation files in `.sdd/docs/` to understand what already exists
3. **Read source material** - Read the WP file, spec, contract files, and implementation source files for content
4. **Write documentation** - Update or create documentation files incrementally (do NOT recreate from scratch)

---

## 3. Output Contract

Each skill SHALL produce one of the following:

| Skill | Output File | Content |
|-------|------------|---------|
| `doc-architecture` | `.sdd/docs/architecture.md` | System design, components, decisions |
| `doc-api-reference` | `.sdd/docs/api-reference.md` | Endpoint docs from contracts |
| `doc-user-guide` | `.sdd/docs/user-guide.md` | Feature usage instructions |
| `doc-developer-guide` | `.sdd/docs/developer-guide.md` | Dev setup, conventions |
| `doc-changelog` | `.sdd/docs/CHANGELOG.md` | Version history entries (prepended, newest first) |
| `doc-inline-code` | Source files (`*.ts`, `*.py`, `*.go`, `*.rs`) | Docstrings and comments in source files |

### 3.1 Incremental Updates

Skills update existing documentation files -- they do NOT recreate docs from scratch each time (FR-006). When updating:

- Update only sections affected by the current WP
- Preserve existing content in unrelated sections
- Add new sections as needed for new features or components

### 3.2 Inline Code Output

The `doc-inline-code` skill updates source files directly. It SHALL NOT modify implementation logic; only documentary content (docstrings, comments, type annotations) may be added or updated (FR-019).

---

## 4. Error Handling (FR-007)

- If a skill fails, the coordinator logs the failure and continues to the next skill.
- Doc generation is best-effort; a failed changelog does not prevent API docs.
- If no contract files exist for the WP, `doc-api-reference` SHALL skip API doc generation and log that no contracts were found (FR-013).

---

## 5. Skill Dispatch Order (FR-004)

The coordinator dispatches doc skills in this canonical order:

| Order | Skill | Purpose |
|-------|-------|---------|
| 1 | `doc-architecture` | Architecture overview, component diagrams, design decisions |
| 2 | `doc-api-reference` | API endpoint documentation from contracts |
| 3 | `doc-user-guide` | End-user documentation for features |
| 4 | `doc-developer-guide` | Development setup, conventions, contributing |
| 5 | `doc-changelog` | Changelog entry for the WP |
| 6 | `doc-inline-code` | Code comments and docstrings in source files |

Skills not present are skipped without error. Skills present but not in this list are dispatched after all known skills, in alphabetical order.

---

## 6. Skill Directory Structure

Each skill lives in `.github/skills/doc-<name>/` and must contain at minimum a `SKILL.md` file with valid YAML frontmatter:

```yaml
---
name: doc-<name>
description: "<one-line purpose, 1-500 characters>"
argument-hint: "Invoked by Docs Agent Coordinator - do not call directly"
---
```

The coordinator discovers skills by globbing `.github/skills/doc-*/SKILL.md` (FR-003).

---
