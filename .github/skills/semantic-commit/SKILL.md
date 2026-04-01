---
name: semantic-commit
description: "Analyze pending code changes and commit them in semantically grouped commits. Use when: committing code, grouping changes, splitting commits, organizing staged files, preparing atomic commits. Enforces that each commit is a single coherent unit of work -- functionally and technically meaningful."
argument-hint: "Optional scope hint (e.g. 'auth module changes') or leave blank to auto-detect"
---

# Semantic Commit

Analyze all pending code changes, partition them into semantically meaningful groups, and commit each group as a separate, atomic commit with a descriptive conventional-commit message.

## When to Use

- After completing implementation work that touched multiple concerns
- When `git status` shows a mix of unrelated changes across files
- Before submitting a PR to clean up the commit history
- When an agent (Coder, Orchestrator) needs to commit accumulated changes
- Anytime a user or agent says: "commit this", "commit changes", "clean up commits", "split commits"

## Principles

1. **One logical change per commit** - a commit should be explainable in a single sentence
2. **Functional cohesion** - group files that serve the same functional purpose (e.g. a feature endpoint + its tests + its docs)
3. **Technical cohesion** - group files that share the same technical concern when they do not belong to a single feature (e.g. dependency updates, linter config, CI pipeline)
4. **Atomic correctness** - each commit must leave the codebase in a valid state; never commit half a rename or a function call without the function definition
5. **No mixed concerns** - never combine a bug fix with a feature, a refactor with a config change, or test-only changes with source changes (unless the test is for the exact code being added in that commit)

## Commit Message Format

```
<type>(<scope>): <short imperative description>
```

| Field | Rules |
|-------|-------|
| `type` | `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`, `perf`, `ci`, `build` |
| `scope` | Module, component, or area touched (e.g. `auth`, `api`, `ci`, `deps`). Omit only if the change is truly cross-cutting. |
| `description` | Imperative mood, lowercase start, no period, max 72 characters. Describes *what* the commit does, not *why*. |

If a task or work-package ID is known, append it in parentheses: `feat(auth): add token refresh endpoint (WP03 T03-02)`

## Procedure

### Step 1 - Assess the working tree

```bash
git status
git diff --stat
git diff --stat --cached
```

Collect the full list of modified, added, deleted, and renamed files. Note which are staged vs unstaged.

### Step 2 - Read the diffs

For each changed file, read the diff to understand *what* changed:

```bash
git diff -- <file>          # unstaged
git diff --cached -- <file> # staged
```

Build a mental model of every discrete change: new function, moved class, updated config value, added test, fixed bug, etc.

### Step 3 - Identify semantic groups

Partition the changes into groups following these heuristics (in priority order):

| Priority | Grouping heuristic | Example |
|----------|--------------------|---------|
| 1 | **Feature slice** - source + test + docs for one feature | `auth/login.py` + `tests/test_login.py` + `docs/api-reference.md` (login section) |
| 2 | **Bug fix** - minimal set of files that fix one defect | `cart/pricing.py` + `tests/test_pricing.py` |
| 3 | **Refactor unit** - rename, extract, restructure one concept | `utils/helpers.py` (split) + `utils/string_helpers.py` + `utils/date_helpers.py` + all updated imports |
| 4 | **Config / tooling** - build, lint, CI, dependency changes | `pyproject.toml` + `.github/workflows/ci.yml` |
| 5 | **Documentation standalone** - docs not tied to a code change | `README.md` + `docs/setup-guide.md` |
| 6 | **Style / formatting** - whitespace, import sorting, linting | auto-formatted files with no logic changes |

**Splitting rules**:
- If a single file contains changes belonging to two groups (e.g. a bug fix AND a new feature in the same file), note this and ask the user whether to commit the file with the dominant group or to interactively stage hunks.
- If changes are too entangled to split cleanly, commit them together under the broader scope and note it in the commit body.

### Step 4 - Validate group integrity

For each group, verify:
- [ ] The group compiles/parses on its own (no broken imports, dangling references)
- [ ] Tests in the group pass in isolation with the rest of the codebase at HEAD
- [ ] No file appears in more than one group
- [ ] The commit message accurately describes exactly what this group does

If a group would break the build when applied alone, merge it with the group it depends on.

### Step 5 - Commit each group

For each group, in dependency order (foundational changes first):

```bash
# Reset staging area to start clean
git reset HEAD

# Stage only the files for this semantic group
git add <file1> <file2> ...

# Verify only intended files are staged
git diff --cached --stat

# Commit with a conventional message
git commit -m "<type>(<scope>): <description>"
```

**Critical rules**:
- NEVER use `git add .` or `git add -A` - always list files explicitly
- NEVER use `git add -p` without user confirmation - hunk splitting is interactive
- ALWAYS verify the staged diff before committing
- ALWAYS commit groups in dependency order so each commit leaves the repo valid
- If the user provided a task/WP ID, include it in the commit message

### Step 6 - Final verification

```bash
git log --oneline -<N>   # N = number of commits just made
```

Present the commit log to the user for confirmation.

## Edge Cases

| Situation | Action |
|-----------|--------|
| Only one logical change | Single commit - no need to split |
| All changes are in one file | Single commit unless the diff clearly shows unrelated hunks |
| Merge conflicts present | Stop and alert the user - do not commit on top of conflicts |
| Uncommitted .env or secrets | NEVER commit - warn the user and skip those files |
| Generated / lock files | Group with the dependency change that caused them (e.g. `package-lock.json` with `package.json`) |
| Empty staging after reset | Re-check `git status` - files may already be committed or discarded |

## What This Skill Does NOT Do

- It does not push to a remote -- the user or a CI pipeline decides when to push
- It does not amend or rebase existing commits -- it only creates new commits from pending changes
- It does not resolve merge conflicts
- It does not make judgment calls about whether code is correct -- it only organizes and commits
