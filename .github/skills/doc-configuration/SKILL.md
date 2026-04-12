---
name: doc-configuration
description: "Configuration guide documentation skill. Produces and updates configuration reference with environment variables, config files, defaults, and validation rules in .sdd/docs/configuration-guide.md."
argument-hint: "Invoked by Docs Agent Coordinator - do not call directly"
---

# doc-configuration - Configuration Guide Skill

This skill is invoked by the Docs Agent Coordinator as a subagent. It produces and updates `.sdd/docs/configuration-guide.md` with environment variables, configuration files, default values, validation rules, and deployment profiles. The skill reads the spec, WP, contract files, and the actual codebase to generate accurate configuration documentation.

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
| **Target file** | `.sdd/docs/configuration-guide.md` |
| **Action** | Create if missing; update incrementally if existing |
| **Content** | Environment variables, config files, defaults, validation, profiles |

## Execution Sequence (FR-006)

1. **Read SKILL.md** -- Load this file for documentation generation instructions
2. **Read existing docs** -- Read `.sdd/docs/configuration-guide.md` if it exists to understand current content
3. **Read source material** -- Read the WP file, spec, contract files, and implementation source files for content. Read multiple independent files in parallel. Use `#tool:search/searchSubagent` to discover config-related source files.
4. **Write documentation** -- Update or create `.sdd/docs/configuration-guide.md` incrementally (do NOT recreate from scratch)

## Constraints

- Do NOT modify spec files, plan files, contract files, or implementation source files
- Do NOT recreate configuration-guide.md from scratch on incremental updates -- preserve existing content
- Use plain ASCII only -- no em dashes, smart quotes, or curly apostrophes
- Follow the canonical section order defined below
- Configuration values MUST be derived from the actual codebase, NOT copied from the spec

---

## Section 1 -- Overview

Provide a brief overview of how the application is configured.

### Instructions

1. Read the spec and source files to understand the configuration approach
2. Describe the configuration mechanism (env vars, config files, CLI flags, etc.)
3. Note the precedence order if multiple configuration sources exist (e.g., CLI > env > file > defaults)

### Output Format

```markdown
# Configuration Guide

## Overview

<brief description of how the application is configured>
<configuration precedence order if applicable>
```

---

## Section 2 -- Environment Variables

Document all environment variables used by the application.

### Instructions

1. Search the source files for environment variable reads (`os.getenv`, `process.env`, `std::env`, `os.Getenv`, etc.)
2. For each variable, document: name, type, default value, whether required, and description
3. Group by functional area (e.g., database, auth, logging, server)
4. Flag any variables used in code but not documented, or documented but not used

### Output Format

```markdown
## Environment Variables

### Database

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `DATABASE_URL` | string | -- | Yes | PostgreSQL connection string |
| `DB_POOL_SIZE` | integer | `10` | No | Maximum connection pool size |

### Authentication

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `JWT_SECRET` | string | -- | Yes | Secret key for JWT signing |
| `TOKEN_EXPIRY` | duration | `1h` | No | Access token expiration time |
```

---

## Section 3 -- Configuration Files

Document any configuration files the application reads.

### Instructions

1. Search for config file loading in source code (e.g., YAML, TOML, JSON, INI parsers)
2. Document the file path, format, and schema
3. Provide example configurations with comments

### Output Format

```markdown
## Configuration Files

### `config.yaml`

**Location**: Project root or path set by `CONFIG_PATH` env var
**Format**: YAML

```yaml
# Example configuration
server:
  port: 8080          # Server port (default: 8080)
  host: "0.0.0.0"     # Bind address (default: 0.0.0.0)
logging:
  level: "info"       # Log level: debug, info, warn, error
  format: "json"      # Log format: json, text
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `server.port` | integer | `8080` | HTTP server port |
| `server.host` | string | `0.0.0.0` | Bind address |
```

---

## Section 4 -- Validation Rules

Document configuration validation rules that the application enforces.

### Instructions

1. Search source code for config validation logic (range checks, format validation, required fields)
2. Document what happens when invalid config is provided (error messages, fallback behavior)
3. List any interdependencies between config values

### Output Format

```markdown
## Validation Rules

| Config | Rule | Error Behavior |
|--------|------|----------------|
| `DB_POOL_SIZE` | Must be 1-100 | Startup fails with "Invalid pool size" |
| `LOG_LEVEL` | Must be one of: debug, info, warn, error | Falls back to "info" with warning |
| `PORT` | Must be 1024-65535 | Startup fails with "Invalid port" |
```

---

## Section 5 -- Deployment Profiles

Document any environment-specific configuration profiles.

### Instructions

1. Look for profile or environment-based configuration (development, staging, production)
2. Document what differs between environments
3. Highlight security-sensitive configuration that must be set in production

### Output Format

```markdown
## Deployment Profiles

### Development

- Debug logging enabled
- CORS allows all origins
- Database uses local instance

### Production

- `LOG_LEVEL` should be `warn` or `error`
- `JWT_SECRET` **must** be a strong random value (not the dev default)
- `CORS_ORIGINS` must be restricted to production domains
- `DATABASE_URL` must use SSL connection (`?sslmode=require`)
```

---

## Incremental Update Protocol

When `configuration-guide.md` already exists with content from prior work packages:

### Rules

1. **Read before write** -- Always read the existing file before making changes
2. **Update only affected sections** -- If the WP adds new env vars, update Section 2. If it adds new config files, update Section 3
3. **Preserve unaffected sections** -- Sections not related to the current WP remain unchanged
4. **Merge, do not replace** -- Add new config entries alongside existing ones within affected sections
5. **Add WP attribution** -- Note which WP introduced each config entry:
   ```markdown
   | `NEW_VAR` | string | `default` | No | Added in WP03 - description |
   ```

---

## Quality Checklist

Before completing, verify:

- [ ] All environment variables found in source code are documented
- [ ] Default values match actual code defaults
- [ ] Required/optional status matches code behavior
- [ ] Config file schemas match actual file parsing
- [ ] Validation rules reflect actual validation logic
- [ ] No sensitive default values are exposed (secrets, passwords)
- [ ] Incremental updates preserve prior WP content
- [ ] No em dashes, smart quotes, or curly apostrophes in output
