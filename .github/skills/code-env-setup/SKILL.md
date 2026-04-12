---
name: code-env-setup
description: "Environment verification, dependency installation, baseline test verification"
argument-hint: "Invoked by Coder Coordinator - do not call directly"
---

# code-env-setup

> **Phase**: 1 (Environment Setup)
> **Common contract**: `.github/skills/CODER-SKILL-CONTRACT.md`
> **Spec refs**: FR-020, FR-021, FR-022

This skill is dispatched by the Coder Coordinator during Phase 1. It verifies or creates the development environment, installs project dependencies, configures coverage tooling, runs baseline tests, and documents environment state.

---

## Input Contract (FR-017)

| # | Input | Description |
|---|-------|-------------|
| 1 | `skill_path` | Path to this SKILL.md file |
| 2 | `wp_path` | Path to the WP file being implemented |
| 3 | `contracts_dir` | Path to contract files for this WP (`.sdd/plans/contracts/<WP-slug>/`) |
| 4 | `spec_path` | Path to the source spec file |
| 5 | `patterns` | Active code-domain patterns to avoid (from `code-patterns.md`) |
| 6 | `target_language` | Programming language (e.g., TypeScript, Python) |
| 7 | `target_framework` | Framework (e.g., Express, FastAPI, React) |
| 8 | `task_list` | Tasks with acceptance criteria and spec refs |

---

## Execution Sequence (FR-018)

1. **Read SKILL.md** -- Load this file for environment setup instructions
2. **Read WP + contracts** -- Read the WP file and contract files to understand what dependencies and tooling are needed
3. **Read spec sections** -- Read the spec sections referenced by the WP for requirements context
4. **Execute environment setup** -- Detect, create, and verify the development environment (Steps 1-5 below)
5. **Report results** -- Report environment state, files modified, issues, and status back to the coordinator

---

## Output Contract (FR-019)

Report to the coordinator with these fields:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `status` | enum | `success` or `failure` | Skill outcome |
| `files_modified` | list(string) | file paths | Files created or changed |
| `tasks_completed` | list(string) | T<NN>-XX format | Tasks finished |
| `test_results` | object | `pass_count`, `fail_count`, `coverage_pct` | Baseline test run summary |
| `issues` | list(string) | free text | Problems encountered |
| `failure_reason` | string | nullable | Why the skill failed (if status is `failure`) |

---

## Step 1 -- Detect Existing Environment (FR-020.1)

Check for an existing development environment by scanning for these indicators in priority order:

### Python Projects

1. Check for `.venv/` or `venv/` directory
2. Check for `pyproject.toml` (Poetry, PDM, Hatch, or PEP 621)
3. Check for `requirements.txt` or `requirements-dev.txt`
4. Check for `setup.py` or `setup.cfg`
5. Check for `Pipfile` (Pipenv)
6. Check for `conda.yaml` or `environment.yml` (Conda)

### Node.js Projects

1. Check for `node_modules/` directory
2. Check for `package.json`
3. Check for `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml` (determines package manager)

### Go Projects

1. Check for `go.mod`
2. Check for `go.sum`

### Rust Projects

1. Check for `Cargo.toml`
2. Check for `Cargo.lock`

### Other / Multi-language

1. Check for `Makefile`, `Dockerfile`, `docker-compose.yml`
2. Check for `.tool-versions` (asdf) or `.mise.toml` (mise)

**Decision logic**:
- If an environment exists and appears functional: proceed to Step 3 (dependency installation)
- If no environment exists: proceed to Step 2 (environment creation)
- If multiple language indicators exist: use `target_language` from the input to determine the primary environment
- If an environment exists but appears broken: proceed to Step 1b (environment recovery)

### Step 1b -- Environment Recovery (Broken/Corrupted Environment)

If an environment directory exists (e.g., `node_modules/`, `.venv/`) but a basic health check fails, the environment is considered broken. Health checks:

- **Node.js**: Run `node -e "require('./package.json')"` and `npx --version`. If either fails, the environment is broken.
- **Python**: Run `<venv>/bin/python --version` (or `<venv>\Scripts\python --version` on Windows) and verify it exits 0. If it fails, the environment is broken.
- **Go**: Run `go env GOPATH` and verify it exits 0.
- **Rust**: Run `cargo --version` and verify it exits 0.

Recovery procedure:
1. Log: "Environment appears broken. Removing and recreating."
2. Delete the broken environment directory (e.g., `rm -rf node_modules` or `rm -rf .venv`).
3. Proceed to Step 2 (environment creation) as if no environment existed.

Do NOT attempt to repair a broken environment -- always delete and recreate.

---

## Step 2 -- Create Environment (FR-020.2)

Create a new development environment based on the detected or specified language:

### Python

```bash
python -m venv .venv
```

- Activate the virtual environment before subsequent commands
- On Windows: `.venv\Scripts\activate`
- On macOS/Linux: `source .venv/bin/activate`
- If `python` is not available, try `python3`

**Version check**: Verify the Python version meets the project's minimum requirement. Check `pyproject.toml` `[project] requires-python`, `setup.cfg` `python_requires`, or `Pipfile` `[requires] python_version`.

- If the installed Python version does not meet the requirement, report the incompatibility:
  ```
  status: failure
  failure_reason: "Python version mismatch: project requires >=3.11 but installed version is 3.8.10"
  ```
  Do NOT proceed with installation. The coordinator will escalate to the human.

### Node.js

Determine the package manager from lockfile presence:
- `package-lock.json` -> `npm install`
- `yarn.lock` -> `yarn install`
- `pnpm-lock.yaml` -> `pnpm install`
- No lockfile -> `npm install` (default)

**Version check**: Check `.nvmrc`, `.node-version`, or `package.json` `engines.node` for version requirements. If the installed Node version does not meet the requirement, report the incompatibility and halt.

### Go

```bash
go mod download
```

**Version check**: Check `go.mod` `go` directive for version requirements.

### Rust

```bash
cargo fetch
```

**Version check**: Check `rust-toolchain.toml` or `rust-toolchain` for version requirements.

### Generic Fallback

If the `target_language` is not one of the above:
1. Look for a `Makefile` with a `setup`, `install`, or `init` target
2. Look for a `README.md` with setup instructions
3. Report: "No automated setup available for <target_language>. Manual setup may be required."

---

## Step 3 -- Install Dependencies (FR-020.3)

Install project dependencies from the dependency manifest. Use `#tool:execute/executionSubagent` for dependency installation commands -- it runs multi-step installs and returns only relevant output (errors, version conflicts) instead of full verbose logs.

### Python

| Manifest | Command |
|----------|---------|
| `requirements.txt` | `pip install -r requirements.txt` |
| `requirements-dev.txt` | `pip install -r requirements-dev.txt` |
| `pyproject.toml` (with `[project]`) | `pip install -e ".[dev]"` or `pip install -e .` |
| `pyproject.toml` (Poetry) | `poetry install` |
| `Pipfile` | `pipenv install --dev` |

### Node.js

Already handled in Step 2 (package manager install). If `node_modules/` existed but `package.json` has changed, re-run the install command.

### Go

```bash
go mod download
go build ./...
```

### Rust

```bash
cargo build
```

**Error handling**: If dependency installation fails:
- Capture the full error output
- Check for common issues: network errors, version conflicts, missing system libraries
- Report the exact error message in `failure_reason`
- Do NOT attempt to fix dependency conflicts automatically -- report and halt

---

## Step 4 -- Install Coverage Tooling (FR-022, FR-038, FR-037)

Install the coverage tooling appropriate for the target language and configure minimum thresholds.

### 4a. Read Coverage Thresholds from WP Frontmatter

Before configuring coverage tooling, read the minimum thresholds from the WP file's YAML frontmatter:

1. Read `coverage_code` from WP frontmatter. If the field is absent, use the default: **80**.
2. Read `coverage_branch` from WP frontmatter. If the field is absent, use the default: **90**.
3. Each field is independent -- specifying one does not require specifying the other. An absent field always uses its own default.
4. **Validation**: If either field is present but is not an integer or is outside the range 0-100, halt with: "Invalid coverage_code value '<value>'. Must be an integer 0-100." (or the equivalent message for `coverage_branch`).
5. A value of 0 is valid (no coverage enforcement for prototyping WPs).

Use the resolved `coverage_code` and `coverage_branch` values (from frontmatter or defaults) in all configuration examples below, replacing the placeholder `<coverage_code>` and `<coverage_branch>`.

### 4b. Python (pytest-cov)

Install:
```bash
pip install pytest-cov
```

Configure in `pytest.ini`, `pyproject.toml`, or `setup.cfg` using the resolved thresholds:
```ini
[tool:pytest]
addopts = --cov --cov-branch --cov-fail-under=<coverage_code>

[coverage:report]
fail_under = <coverage_code>

[coverage:run]
branch = True
```

If using `pyproject.toml`:
```toml
[tool.pytest.ini_options]
addopts = "--cov --cov-branch --cov-fail-under=<coverage_code>"

[tool.coverage.report]
fail_under = <coverage_code>

[tool.coverage.run]
branch = true
```

**Thresholds**: Use the `coverage_code` and `coverage_branch` values read from WP frontmatter (defaults: 80% code, 90% branch per FR-037).

### 4c. Node.js (Istanbul/nyc or c8)

For Jest projects, add to `jest.config.js` or `package.json` using the resolved thresholds:
```json
{
  "jest": {
    "collectCoverage": true,
    "coverageThreshold": {
      "global": {
        "statements": <coverage_code>,
        "branches": <coverage_branch>,
        "functions": <coverage_code>,
        "lines": <coverage_code>
      }
    }
  }
}
```

For nyc (Mocha, etc.):
Create or update `.nycrc`:
```json
{
  "check-coverage": true,
  "statements": <coverage_code>,
  "branches": <coverage_branch>,
  "functions": <coverage_code>,
  "lines": <coverage_code>
}
```

### 4d. Go

Go has built-in coverage. No additional tool installation needed. Configure coverage thresholds in the test runner script or CI configuration:
```bash
go test -coverprofile=coverage.out -covermode=atomic ./...
```

### 4e. Rust

Install:
```bash
cargo install cargo-tarpaulin
```

**Note**: Only install or configure coverage tooling if it is not already present. Do not overwrite existing coverage configuration unless the thresholds are below the WP-specified minimums.

---

## Step 5 -- Verify Baseline (FR-020.4, FR-020.5)

### 5a. Run Existing Tests (FR-020.4)

Run the project's existing test suite to verify a green baseline:

| Language | Command |
|----------|---------|
| Python | `pytest` or `python -m pytest` |
| Node.js | `npm test` or `yarn test` |
| Go | `go test ./...` |
| Rust | `cargo test` |

**Decision logic**:
- **All tests pass (exit code 0)**: Record pass count. Continue.
- **Tests fail (non-zero exit code)**: Record failure details. Report as an issue but do NOT fail the skill. The existing test failures predate this WP and should be noted.
- **No tests exist**: Record "No existing tests found". This is NOT a failure. Continue.

### 5b. Verify Application Launch (FR-020.5)

If the project has an entry point (e.g., `main.py`, `server.js`, `main.go`):
1. Attempt to start the application
2. Verify it launches without immediate errors (does not crash on startup)
3. Stop the application after verification

If there is no clear entry point (library, framework plugin, etc.): skip this step and document "No application entry point -- launch verification skipped."

### 5c. Document Environment State (FR-020.6)

Append an entry to the WP Activity Log documenting:
- Language and version (e.g., "Python 3.11.4")
- Framework and version (e.g., "FastAPI 0.104.1")
- Virtual environment type (e.g., "venv at .venv/")
- Dependency count (e.g., "42 packages installed")
- Baseline test results (e.g., "14 tests passed, 0 failed")
- Coverage tooling installed (e.g., "pytest-cov 4.1.0 configured")

Format:
```
- <timestamp> - code-env-setup - Environment: <language> <version>, <framework> <version>. Venv: <type>. Dependencies: <count> installed. Baseline: <test_summary>. Coverage: <tool> configured (<coverage_code>% code / <coverage_branch>% branch).
```

---

## Step 6 -- Handle Setup Failures (FR-021)

If the environment cannot be established at any step, follow this 3-part failure protocol:

### 6a. Document What Failed

Record in the skill output:
- Which step failed (detection, creation, dependency install, coverage setup, baseline)
- The exact error message or output
- The command that was run
- System state at time of failure (OS, runtime versions, disk space if relevant)

### 6b. Report Failure to Coordinator

Set the output contract fields:
```
status: failure
failure_reason: "<step> failed: <exact error message>"
issues: ["<detailed description of the failure>"]
```

### 6c. Coordinator Escalation

The coordinator SHALL escalate to the human upon receiving a failure status from this skill. The skill does NOT attempt to recover from environment failures -- recovery requires human judgment.

**Common failure scenarios**:

| Scenario | Expected Behavior |
|----------|-------------------|
| Missing runtime (e.g., Python not installed) | Report: "Python runtime not found. Install Python >= <required_version>." |
| Version mismatch (e.g., Python 3.8 vs required 3.11) | Report: "Python version mismatch: requires >= 3.11, found 3.8.10" |
| Dependency conflict | Report exact pip/npm error output |
| Network error during install | Report: "Network error during dependency installation: <error>" |
| Missing system library | Report: "Missing system dependency: <library>. Install via <package_manager>." |
| Insufficient permissions | Report: "Permission denied: <path>. Check file system permissions." |

---

## Constraints

1. **Read-only contracts**: Do NOT modify any file in `.sdd/plans/contracts/`. Contracts are the Planner's output.
2. **No self-review**: Do NOT perform quality assessment or self-review.
3. **Scope discipline**: Do NOT install packages or configure tooling not required by the project or coverage requirements.
4. **Active patterns**: Avoid any code-domain patterns listed in the `patterns` input. These are mistakes from prior reviews.
5. **Idempotent setup**: If the environment already exists and is functional, do not recreate it. Only install missing dependencies or update outdated ones.
