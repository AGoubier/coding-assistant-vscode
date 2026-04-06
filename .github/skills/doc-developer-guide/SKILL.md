---
name: doc-developer-guide
description: "Developer guide documentation skill. Produces and updates developer-facing documentation with setup instructions, conventions, and contribution guidelines in .sdd/docs/developer-guide.md."
argument-hint: "Invoked by Docs Agent Coordinator - do not call directly"
---

# doc-developer-guide - Developer Guide Documentation Skill

This skill is invoked by the Docs Agent Coordinator as a subagent. It produces and updates `.sdd/docs/developer-guide.md` with development environment setup, project structure overview, coding conventions in use, testing approach and commands, and how to add new features following the project's patterns. The skill reads the spec, WP, contract files, and the actual codebase to generate accurate developer-facing documentation.

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
| **Target file** | `.sdd/docs/developer-guide.md` |
| **Action** | Create if missing; update incrementally if existing |
| **Content** | Development environment setup, project structure, coding conventions, testing approach, adding new features |

## Execution Sequence (FR-006)

1. **Read SKILL.md** -- Load this file for documentation generation instructions
2. **Read existing docs** -- Read `.sdd/docs/developer-guide.md` if it exists to understand current content
3. **Read source material** -- Read the WP file, spec, contract files, and implementation source files for content
4. **Write documentation** -- Update or create `.sdd/docs/developer-guide.md` incrementally (do NOT recreate from scratch)

## Constraints

- Do NOT modify spec files, plan files, contract files, or implementation source files
- Do NOT recreate developer-guide.md from scratch on incremental updates -- preserve existing content
- Use plain ASCII only -- no em dashes, smart quotes, or curly apostrophes
- Follow the canonical section order defined below
- Setup instructions MUST be derived from actual project files, NOT invented

---

## Section 1 -- Development Environment Setup (FR-015.1)

Generate development environment setup instructions from actual project files.

### Instructions

1. Scan the project root for dependency/build files to determine the technology stack:
   - `package.json` (Node.js/npm/yarn)
   - `requirements.txt`, `pyproject.toml`, `setup.py`, `Pipfile` (Python)
   - `go.mod` (Go)
   - `Cargo.toml` (Rust)
   - `pom.xml`, `build.gradle` (Java)
   - `.tool-versions`, `.nvmrc`, `.python-version` (version managers)
2. For each detected technology:
   a. Document the required runtime version (from version files or engine fields)
   b. Document the install command for dependencies
   c. Document any environment variable setup (from `.env.example`, `.env.template`, or spec)
   d. Document any required system-level tools (database, cache, message queue)
3. If no dependency files are detected, document the project as a documentation-only or markdown-only project
4. Read the spec for any additional setup requirements not captured by project files
5. Include both first-time setup and how to update an existing environment

### Output Format

```markdown
# Developer Guide

## Development Environment Setup

### Prerequisites

- <runtime> version <version> or later
- <package manager> (included with <runtime>)

### First-Time Setup

1. Clone the repository:
   ```
   git clone <repo-url>
   cd <project-name>
   ```

2. Install dependencies:
   ```
   <install command>
   ```

3. Set up environment variables:
   ```
   cp .env.example .env
   # Edit .env with your values
   ```

### Updating Your Environment

After pulling new changes:
```
<update command>
```
```

---

## Section 2 -- Project Structure Overview (FR-015.2)

Generate a project structure overview from the actual codebase.

### Instructions

1. Use `list_dir` on the project root to discover the top-level structure
2. Recurse into key directories to show the layout (2-3 levels deep)
3. For each directory and key file:
   a. Add a brief annotation explaining its purpose
   b. Note which directories contain the most important code
   c. Explain the organizational pattern (e.g., "feature-based", "layer-based", "domain-driven")
4. Do NOT copy the directory structure from the spec -- the actual codebase is the source of truth
5. Exclude non-project directories (e.g., `node_modules/`, `.git/`, `__pycache__/`, `dist/`, `build/`)
6. Highlight where new developers should start reading code

### Output Format

```markdown
## Project Structure

```
project-root/
  src/                    # Source code
    components/           # UI components
    services/             # Business logic
    utils/                # Shared utilities
  tests/                  # Test files
    unit/                 # Unit tests
    integration/          # Integration tests
  .sdd/                   # SDD pipeline artifacts
    specs/                # Specification files
    plans/                # Work packages and contracts
    docs/                 # Generated documentation
```

### Key Directories

- **`src/`**: Main source code. Start here to understand the codebase.
- **`tests/`**: All test files, organized by type.
- **`.sdd/`**: Pipeline artifacts -- specs, plans, and generated docs.
```

---

## Section 3 -- Coding Conventions (FR-015.3)

Document the coding conventions in use, derived from the actual codebase.

### Instructions

1. Examine the codebase for existing patterns and conventions:
   a. **Naming conventions**: Check variable, function, class, and file naming (camelCase, snake_case, PascalCase, kebab-case)
   b. **File organization**: Check how files are grouped (by feature, by layer, by type)
   c. **Import style**: Check imports (relative vs absolute, named vs default, sorted)
   d. **Error handling**: Check the error handling pattern (try/catch, Result types, error returns, custom error classes)
   e. **Logging**: Check if and how logging is done
2. Check for linting/formatting configuration files:
   - `.eslintrc`, `.eslintrc.json`, `.eslintrc.js` (ESLint)
   - `.prettierrc`, `.prettierrc.json` (Prettier)
   - `pyproject.toml` for `[tool.ruff]`, `[tool.black]`, `[tool.isort]` (Python formatters)
   - `.editorconfig` (EditorConfig)
   - `rustfmt.toml` (Rust)
3. Read the spec for any prescribed conventions (typically in Section 9 or Section 12)
4. Document only conventions that are actually observed in the codebase or enforced by tooling
5. If the WP modifies conventions, update this section to reflect the new conventions

### Output Format

```markdown
## Coding Conventions

### Naming

- **Variables and functions**: `<convention>` (e.g., `camelCase`)
- **Classes and types**: `<convention>` (e.g., `PascalCase`)
- **Files**: `<convention>` (e.g., `kebab-case.ts`)
- **Constants**: `<convention>` (e.g., `UPPER_SNAKE_CASE`)

### File Organization

<description of how files are organized>

### Error Handling

<description of the error handling pattern used in the codebase>

### Formatting

<linting/formatting tools in use and their configuration>
```

---

## Section 4 -- Testing Approach and Commands (FR-015.4)

Document the testing approach, test structure, and commands.

### Instructions

1. Scan for test configuration and test files:
   a. Check `package.json` scripts for test commands (e.g., `test`, `test:unit`, `test:integration`, `test:coverage`)
   b. Check for test config files (`jest.config.*`, `vitest.config.*`, `pytest.ini`, `pyproject.toml [tool.pytest]`, `.mocharc.*`)
   c. Check for test directories (`tests/`, `test/`, `__tests__/`, `spec/`) and their structure
   d. Check for coverage configuration (`jest --coverage`, `pytest --cov`, `go test -cover`)
2. Determine the testing approach from existing tests:
   a. Test organization (unit vs integration vs e2e)
   b. Test naming conventions (e.g., `*.test.ts`, `test_*.py`, `*_test.go`)
   c. Test patterns (arrange-act-assert, given-when-then, BDD)
   d. Mocking approach (manual mocks, mock libraries, dependency injection)
3. Read the spec for any testing requirements (coverage thresholds, BDD scenarios)
4. Document the commands to run tests at different levels

### Output Format

```markdown
## Testing

### Test Structure

- **Unit tests**: `<location>` -- Test individual functions and modules in isolation
- **Integration tests**: `<location>` -- Test component interactions and boundaries

### Running Tests

```bash
# Run all tests
<command>

# Run unit tests only
<command>

# Run integration tests only
<command>

# Run tests with coverage
<command>
```

### Coverage Thresholds

- Code coverage: <threshold>%
- Branch coverage: <threshold>%

### Writing New Tests

<brief guide on how to write tests following the project's patterns>
```

---

## Section 5 -- Adding New Features (FR-015.5)

Document how to add new features following the project's established patterns.

### Instructions

1. Examine the project's architecture to identify the pattern for adding new features:
   a. Where do new source files go? (directory convention)
   b. What files need to be created? (component, test, type definitions, etc.)
   c. What existing files need to be modified? (registries, routers, index files, etc.)
   d. What is the typical development workflow? (branch, implement, test, PR)
2. Read the spec for any prescribed development workflow (SDD pipeline, skill-based architecture)
3. If the project uses a skill-based architecture (like this one):
   a. Document how to add a new skill
   b. Document how the coordinator discovers and dispatches skills
   c. Document integration patterns
4. Provide a concrete example based on the most recent feature addition
5. Reference any relevant spec sections or design decisions

### Output Format

```markdown
## Adding New Features

### Development Workflow

1. <Step 1 of the workflow>
2. <Step 2 of the workflow>
3. <Step 3 of the workflow>

### File Checklist

When adding a new <component type>, create or modify these files:

- [ ] `<path>` -- <purpose>
- [ ] `<path>` -- <purpose>
- [ ] `<path>` -- <purpose>

### Example: Adding a New <Component Type>

<walkthrough of adding a real feature, referencing actual project files>

### Patterns to Follow

- <pattern 1>
- <pattern 2>
```

---

## Incremental Update Protocol (FR-011)

When `developer-guide.md` already exists with content from prior work packages, the skill SHALL update incrementally:

### Rules

1. **Read before write** -- Always read the existing `developer-guide.md` content before making any changes
2. **Identify sections by heading** -- Use the canonical heading hierarchy (## Development Environment Setup, ## Project Structure, ## Coding Conventions, ## Testing, ## Adding New Features) to locate sections
3. **Update only affected sections** -- Determine which sections are affected by the current WP's changes:
   - If the WP changes dependencies or setup requirements, update Development Environment Setup
   - If the WP adds new directories or reorganizes files, update Project Structure
   - If the WP introduces new conventions or changes existing ones, update Coding Conventions
   - If the WP changes testing approach or adds new test types, update Testing
   - If the WP introduces new feature patterns, update Adding New Features
4. **Preserve unaffected sections** -- Sections not related to the current WP's changes SHALL remain unchanged
5. **Merge, do not replace** -- Within affected sections, add new content alongside existing content rather than replacing it
6. **Project Structure is always refreshed** -- The Project Structure section is always regenerated from the actual codebase since any WP may add or remove files. This is the only section that may be fully rewritten on each update.
7. **Add WP attribution** -- When adding new content to a section, note which WP introduced the change:
   ```markdown
   ### New Convention: <Title> (WP03)
   ```

### Incremental Update Sequence

1. Read existing `developer-guide.md` into memory
2. Parse into sections by `##` headings
3. For each canonical section:
   a. If the section does not exist, create it with content from the current WP
   b. If the section exists and is affected by the current WP, merge new content
   c. If the section exists and is NOT affected, leave it unchanged
4. Write the updated content back to `developer-guide.md`
5. Verify no content from prior WPs was lost by comparing section counts before and after

### Error Handling

- If `developer-guide.md` does not exist, create it from scratch with all 5 sections
- If `developer-guide.md` exists but has non-standard headings, preserve non-standard content in an "Additional Notes" section at the end
- If parsing fails, log a warning and regenerate the full file (last resort)

### No Updates Handling

If the current WP adds no developer-facing changes (no new dependencies, no new directories, no convention changes, no testing changes):
1. Log: "WP<NN> introduces no developer-facing changes. Skipping developer guide update."
2. Do NOT modify `developer-guide.md`
3. Exit the skill cleanly with no changes

---

## Quality Checklist

Before completing, verify:

- [ ] Development setup is derived from actual project files (package.json, requirements.txt, etc.)
- [ ] Project structure reflects the actual codebase (not the spec)
- [ ] Coding conventions are observed in the codebase or enforced by tooling
- [ ] Testing section includes runnable commands
- [ ] Adding new features section provides a concrete example
- [ ] Incremental updates preserve prior WP content
- [ ] No em dashes, smart quotes, or curly apostrophes in output
