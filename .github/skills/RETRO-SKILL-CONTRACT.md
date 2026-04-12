# Retro Skill Contract

This document defines the common input/output contract that all retro-spec skills (`retro-*/SKILL.md`) must follow. It serves as the developer guide for creating new retro skills.

> **Note**: This contract is self-referencing — it defines the internal protocol for the retro-spec pipeline.
> It does not trace to external specification FRs because the retro-spec agent is a bootstrapping tool
> that reverse-engineers existing code into specifications.

---

## 1. Inputs

Every retro skill receives the following inputs in its subagent prompt from the coordinator:

| # | Input | Type | Description |
|---|-------|------|-------------|
| 1 | `skill_path` | Path | Path to this skill's SKILL.md file |
| 2 | `accumulator_path` | Path | Path to the spec file being built (project or module level) |
| 3 | `artifacts_dir` | Path | Path to the companion artifacts directory (`.sdd/retro/artifacts/<project-name>/`) |
| 4 | `discovery_manifest_path` | Path | Path to the discovery manifest (`.sdd/retro/discovery-manifest.md`) |
| 5 | `source_path` | Path | Path to the legacy source code being analyzed |
| 6 | `target_language` | String | The programming language for companion artifacts (for reimplementation, NOT the legacy language) |
| 7 | `project_name` | String | Name of the project being analyzed |
| 8 | `module_filter` | String | Which modules to analyze (`"all"` or comma-separated list) |

> **Exception -- `retro-discovery`**: Receives only 3 inputs (`skill_path`, `codebase_path`, `output_path`) because it bootstraps the pipeline before accumulators, manifests, or artifacts exist. Note: the output path is hardcoded to `.sdd/retro/discovery-manifest.md` in the agent dispatch template.

> **Exception — `retro-assembly`**: Replaces `module_filter` with `scope` (full/project/overview) and adds `all_project_specs` (paths to all project-level accumulators) because it operates across all projects.

---

## 2. Execution Sequence

Every retro skill SHALL execute these 5 steps in order:

1. **Read SKILL.md** -- Load its own SKILL.md to get extraction instructions and guidelines
2. **Read discovery manifest** -- Read the discovery manifest to understand project/module topology
3. **Read accumulator** -- Read the current accumulator to understand what earlier skills have extracted
4. **Analyze source code** -- Statically analyze the legacy source code at `source_path` (NEVER execute it). Use `#tool:search/searchSubagent` for broad codebase exploration and `#tool:search/usages` to trace symbol references and dependency graphs. Read multiple files in parallel.
5. **Write extraction results** -- Write findings to the accumulator and produce companion artifacts

---

## 3. Output Format

Each skill SHALL write its sections to the accumulator file using the standard spec template format:

- **Numbered headings**: Use the section numbers assigned to this skill
- **FR-XXX identifiers**: Each inferred functional requirement gets a unique `FR-XXX` identifier
- **SHALL statements**: Requirements use `SHALL` obligation language
- **Confidence markers**: Every inferred requirement carries `[INFERRED: HIGH/MEDIUM/LOW]` or `[AMBIGUOUS: reason]`
- **Source references**: Every extraction cites the source file and line range: `Source: <file>:<start_line>-<end_line>`

---

## 4. Constraints

### 4.1 Read-Only Analysis

Skills SHALL NEVER modify, execute, or build the legacy codebase. All analysis is static:
- Read source files with `read_file`
- Search with `grep_search`, `file_search`, `semantic_search`
- List directories with `list_dir`
- NEVER run `npm install`, `pip install`, `make`, test commands, or any build/execution commands against the legacy code

### 4.2 No Modification of Prior Sections

Skills SHALL NOT modify sections written by earlier skills. If a skill discovers an inconsistency with a prior section, it SHALL:
1. Add an inline marker: `[CROSS-REF ISSUE: <description>]`
2. Continue writing its own section

### 4.3 Evidence-Based Extraction

Every claim in the output SHALL cite specific source evidence:
- File path and line range for code-derived claims
- Test file and test name for test-derived claims
- Config file for configuration-derived claims
- `[NO SOURCE EVIDENCE]` when a claim is inferred from absence of code (e.g., missing validation)

### 4.4 Binary/Minified Code

If a skill encounters binary files, minified code, or generated code, it SHALL skip them with:
`[SKIPPED: <reason> at <path>]`

### 4.5 MODULE-DEEP Mode (`retro-business-logic`)

The `retro-business-logic` skill supports an extended extraction mode triggered when the dispatch prompt contains `Extraction depth: MODULE-DEEP`. This mode performs exhaustive per-function code-path tracing within a single module and produces additional subsections (4B–4E: Business Rules, Decision Logic, Computed Values, Side Effects). Other skills are not affected by MODULE-DEEP.

### 4.6 Test Annotations (`retro-test-analysis`)

The `retro-test-analysis` skill adds inline annotations to prior sections' requirements using `[TEST VALIDATED: <test_file>:<test_name>]` or `[NO TEST COVERAGE]`. This is a controlled exception to §4.2 — annotations are additive metadata, not content modifications.

---

## 5. Companion Artifact Manifest

Skills that produce companion artifact files SHALL include a manifest comment at the top of each file:

```
// Generated by: retro-<skill-name> skill (retro-spec)
// Source legacy code: <source_path>
// Target language: <language>
// Confidence: <overall confidence for this artifact>
// DO NOT EDIT MANUALLY -- regenerated on retro-spec re-run
```

Comment syntax varies by target language:
- TypeScript/JavaScript: `//`
- Python: `#`
- Go: `//`
- Rust: `//`
- Java: `//`
- C#: `//`

---

## 6. Skill Directory Structure

Each skill lives in `.github/skills/retro-<name>/` and must contain at minimum a `SKILL.md` file with valid YAML frontmatter:

```yaml
---
name: retro-<name>
description: "<one-line purpose, 1-500 characters>"
---
```

The coordinator discovers skills by scanning `retro-*/SKILL.md` via glob and dispatches them in the canonical order defined in the agent workflow.

---

## 7. Canonical Skill Dispatch Order

| Phase | Order | Skill | Produces | Project-level | Module-level |
|-------|-------|-------|----------|--------------|-------------|
| Discovery | 0 | `retro-discovery` | Discovery manifest | Yes | No |
| Extraction | 1 | `retro-architecture` | Section 9, dependency graphs | Yes | No (project-level only) |
| Extraction | 2 | `retro-data-model` | Section 7, data-schema artifacts | Yes | Yes |
| Extraction | 3 | `retro-api-contracts` | Section 8, API/interface artifacts | Yes | Yes |
| Extraction | 4 | `retro-business-logic` | Sections 4, 5, 6, state-machine artifacts | Yes | Yes |
| Extraction | 5 | `retro-cross-cutting` | Sections 10, 12, 13, error-catalog artifacts | Yes | Yes |
| Validation | 6 | `retro-test-analysis` | Section 11, coverage mapping | Yes (post-loop) | No |
| Assembly | 7 | `retro-assembly` | Final 18-section specs, global view | Yes | Yes |

Skills not present are skipped. Skills present but not in this list are dispatched after all known skills, in alphabetical order.

**Module-level dispatches** receive both `accumulator_path` (the module-level spec) and `project_spec_path` (the parent project-level spec) so skills can reference project-wide context.
