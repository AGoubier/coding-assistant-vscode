---
name: doc-user-guide
description: "User guide documentation skill. Produces and updates end-user documentation with feature descriptions, usage instructions, and workflows in .sdd/docs/user-guide.md."
argument-hint: "Invoked by Docs Agent Coordinator - do not call directly"
---

# doc-user-guide - User Guide Documentation Skill

This skill is invoked by the Docs Agent Coordinator as a subagent. It produces and updates `.sdd/docs/user-guide.md` with feature descriptions from user stories, step-by-step usage instructions, configuration options from config schema contracts, common workflows, and troubleshooting for expected error scenarios. The skill reads the spec, WP, contract files, and the actual codebase to generate accurate user-facing documentation.

## Input Contract (FR-005)

This skill receives the following 7 inputs via the coordinator's subagent prompt, as defined in `DOC-SKILL-CONTRACT.md`:

| # | Input | Type | Description |
|---|-------|------|-------------|
| 1 | `skill_path` | Path | Path to this SKILL.md file |
| 2 | `wp_path` | Path | Path to the approved WP file and its task list |
| 3 | `spec_path` | Path | Path to the spec file; includes contract files directory (`.sdd/plans/contracts/<WP-slug>/`) |
| 4 | `source_files` | List(Path) | Implementation source files modified by the WP |
| 5 | `docs_dir` | Path | Path to existing documentation directory (`.sdd/docs/`) for incremental updates |
| 6 | `patterns` | Text | Active doc-domain patterns to avoid (from `.sdd/reviews/doc-patterns.md`) |
| 7 | `contracts_dir` | Path | Path to contract files for this WP (`.sdd/plans/contracts/<WP-slug>/`) |

## Output Contract

| Field | Value |
|-------|-------|
| **Target file** | `.sdd/docs/user-guide.md` |
| **Action** | Create if missing; update incrementally if existing |
| **Content** | Feature descriptions, usage instructions, configuration options, common workflows, troubleshooting |

## Execution Sequence (FR-006)

1. **Read SKILL.md** -- Load this file for documentation generation instructions
2. **Read existing docs** -- Read `.sdd/docs/user-guide.md` if it exists to understand current content
3. **Read source material** -- Read the WP file, spec, contract files, and implementation source files for content. Read multiple independent files in parallel.
4. **Write documentation** -- Update or create `.sdd/docs/user-guide.md` incrementally (do NOT recreate from scratch)

## Constraints

- Do NOT modify spec files, plan files, contract files, or implementation source files
- Do NOT recreate user-guide.md from scratch on incremental updates -- preserve existing content
- Use plain ASCII only -- no em dashes, smart quotes, or curly apostrophes
- Follow the canonical section order defined below
- Feature descriptions MUST be derived from user stories and FR descriptions, NOT invented

---

## Section 1 -- Feature Descriptions (FR-014.1)

Generate feature description sections from user stories and functional requirements in the spec.

### Instructions

1. Read the spec file at `spec_path`
2. Locate user stories (typically in Section 3, 5, or a "User Stories" section) and functional requirements (Section 4)
3. For each user-facing feature identified:
   a. Write a short title describing the feature
   b. Write a 1-3 paragraph description explaining what the feature does from the user's perspective
   c. Explain the user benefit or problem it solves
4. If user stories exist, derive feature descriptions from them (US-XX -> feature)
5. If user stories do not exist for all features, also derive feature descriptions from FR descriptions (FR-XXX -> feature)
6. Do NOT document internal/technical features that have no user-facing impact
7. Group related features into logical categories

### Output Format

```markdown
# User Guide

## Features

### <Feature Name>

<description of the feature from the user's perspective>

**What it does**: <concise summary>
**When to use it**: <usage context>
```

---

## Section 2 -- Step-by-Step Usage Instructions (FR-014.2)

Generate step-by-step instructions for using each feature.

### Instructions

1. Read the spec for usage flows, preconditions, and expected behaviors
2. Read the WP tasks and acceptance criteria for detailed feature behaviors
3. For each feature documented in Section 1:
   a. Write numbered step-by-step instructions for the primary usage path
   b. Include any prerequisites or setup steps needed before using the feature
   c. Describe expected outcomes after each significant step
   d. Note any required inputs or parameters
4. Keep instructions concise -- one action per step
5. Use imperative mood ("Click the button", "Run the command", not "You should click the button")

### Output Format

```markdown
## Usage Instructions

### <Feature Name>

**Prerequisites**: <what must be in place before starting>

1. <First step>
2. <Second step>
3. <Third step>

**Expected result**: <what the user should see after completing the steps>
```

---

## Section 3 -- Configuration Options (FR-014.3)

Generate configuration documentation from config schema contracts and source code.

### Instructions

1. Check for configuration information:
   a. Look in `.sdd/plans/contracts/<WP-slug>/` for any config-related contract files
   b. Look in `.sdd/plans/contracts/shared/` for shared config schemas
   c. Check the spec for configuration sections (typically Section 9 or a "Configuration" section)
   d. Search the source code for environment variable reads and config file parsing
2. If config schema contracts exist:
   a. Extract each configuration option with its name, type, default value, and description
   b. Group options by category (e.g., general, security, performance, display)
   c. Note which options are required vs optional
   d. Document valid value ranges or enum values
3. If no config schema contracts exist:
   a. Derive configuration options from spec descriptions of configurable behavior
   b. Check actual codebase for configuration files (e.g., `.env`, `config.yaml`, `settings.json`)
4. If the WP adds no configurable features, note that no configuration is needed and exit this section cleanly

### Output Format

```markdown
## Configuration

### <Category>

| Option | Type | Default | Required | Description |
|--------|------|---------|----------|-------------|
| `<name>` | `<type>` | `<default>` | Yes/No | <description> |
```

---

## Section 4 -- Common Workflows (FR-014.4)

Generate workflow descriptions for common user tasks that span multiple features.

### Instructions

1. Read the spec for user flows and acceptance scenarios (typically in Sections 3, 5, or 11)
2. Read the WP tasks for end-to-end workflows that combine multiple operations
3. Identify workflows that:
   a. Span multiple features or steps
   b. Represent common use cases (the "happy path" scenarios)
   c. Would benefit from a guided walkthrough
4. For each workflow:
   a. Write a title describing the goal (e.g., "Setting up a new project", "Running your first review")
   b. List the features involved
   c. Write numbered steps describing the full workflow from start to finish
   d. Include decision points (if/then branches) where the user may need to choose
5. If the WP adds no user-facing workflows, note that and exit this section cleanly

### Output Format

```markdown
## Common Workflows

### <Workflow Name>

<brief description of the workflow and when to use it>

**Features involved**: <list of features used in this workflow>

1. <First step>
2. <Second step>
   - If <condition>: <alternative step>
3. <Third step>

**Result**: <what the user achieves after completing the workflow>
```

---

## Section 5 -- Troubleshooting (FR-014.5)

Generate troubleshooting documentation for expected error scenarios.

### Instructions

1. Read the spec for error behaviors, error messages, and error recovery procedures
2. Read contract files for error catalogs (`error-catalog.<ext>`) if they exist
3. Read the WP tasks for error handling acceptance criteria
4. For each expected error scenario:
   a. Describe the symptom the user will see (error message, unexpected behavior)
   b. Explain the likely cause
   c. Provide step-by-step resolution instructions
   d. Note any preventive measures
5. Group errors by category (e.g., setup errors, runtime errors, configuration errors)
6. If the WP introduces no user-facing error scenarios, note that and exit this section cleanly
7. Focus on errors the end user encounters -- do NOT document internal/developer errors

### Output Format

```markdown
## Troubleshooting

### <Error Category>

#### <Error symptom or message>

**Cause**: <why this error occurs>

**Resolution**:
1. <First fix step>
2. <Second fix step>

**Prevention**: <how to avoid this error in the future>
```

---

## Incremental Update Protocol (FR-011)

When `user-guide.md` already exists with content from prior work packages, the skill SHALL update incrementally:

### Rules

1. **Read before write** -- Always read the existing `user-guide.md` content before making any changes
2. **Identify sections by heading** -- Use the canonical heading hierarchy (## Features, ## Usage Instructions, ## Configuration, ## Common Workflows, ## Troubleshooting) to locate sections
3. **Update only affected sections** -- Determine which sections are affected by the current WP's changes:
   - If the WP adds new user-facing features, update Features and Usage Instructions
   - If the WP introduces new configuration options, update Configuration
   - If the WP adds new workflows, update Common Workflows
   - If the WP introduces new error scenarios, update Troubleshooting
4. **Preserve unaffected sections** -- Sections not related to the current WP's changes SHALL remain unchanged
5. **Merge, do not replace** -- Within affected sections, add new content alongside existing content rather than replacing it. For example:
   - In Features: append new feature descriptions after existing ones
   - In Configuration: add new options to the existing table
   - In Troubleshooting: add new error entries after existing ones
6. **Add WP attribution** -- When adding new content to a section, note which WP introduced it:
   ```markdown
   ### <Feature Name> (WP03)
   ```

### Incremental Update Sequence

1. Read existing `user-guide.md` into memory
2. Parse into sections by `##` headings
3. For each canonical section:
   a. If the section does not exist, create it with content from the current WP
   b. If the section exists and is affected by the current WP, merge new content
   c. If the section exists and is NOT affected, leave it unchanged
4. Write the updated content back to `user-guide.md`
5. Verify no content from prior WPs was lost by comparing section counts before and after

### Error Handling

- If `user-guide.md` does not exist, create it from scratch with all 5 sections
- If `user-guide.md` exists but has non-standard headings, preserve non-standard content in an "Additional Notes" section at the end
- If parsing fails, log a warning and regenerate the full file (last resort)

### No Updates Handling

If the current WP adds no user-facing features, no configuration options, no workflows, and no error scenarios:
1. Log: "WP<NN> introduces no user-facing changes. Skipping user guide update."
2. Do NOT modify `user-guide.md`
3. Exit the skill cleanly with no changes

---

## Quality Checklist

Before completing, verify:

- [ ] Feature descriptions are present and derived from user stories or FRs
- [ ] Usage instructions use numbered steps with imperative mood
- [ ] Configuration options include name, type, default, and description
- [ ] Common workflows describe end-to-end user tasks
- [ ] Troubleshooting covers expected error scenarios with resolutions
- [ ] Incremental updates preserve prior WP content
- [ ] No em dashes, smart quotes, or curly apostrophes in output
