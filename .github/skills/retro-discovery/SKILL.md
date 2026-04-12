---
name: retro-discovery
description: "Scans a legacy codebase to identify projects, modules, technology stack, boundaries, and produces a structured discovery manifest"
argument-hint: "Invoked by Retro-Spec Coordinator - do not call directly"
---

# retro-discovery -- Codebase Discovery Skill

This skill is invoked by the Retro-Spec Coordinator as the FIRST skill in the pipeline. It scans the legacy codebase to identify project boundaries, module structure, technology stack, entry points, and produces a discovery manifest that guides all subsequent extraction skills.

## Input Contract

| # | Input | Description |
|---|-------|-------------|
| 1 | `skill_path` | Path to this SKILL.md file |
| 2 | `source_path` | Root path of the legacy codebase to scan |
| 3 | `output_path` | Path for the discovery manifest (`.sdd/retro/discovery-manifest.md`) |

## Execution Sequence

1. **Read this SKILL.md** to load instructions
2. **Scan the codebase root** using `list_dir` recursively (max 3 levels initially). Use `#tool:search/searchSubagent` with the `Explore` agent for broad codebase structure questions.
3. **Identify project boundaries** using marker files (package.json, go.mod, Cargo.toml, etc.)
4. **Deep-scan each project** to identify modules, entry points, and configuration. Use `#tool:search/usages` to trace symbol references and dependency graphs.
5. **Produce the discovery manifest** at `output_path`

## Constraints

- NEVER execute or build any code -- analysis is purely static (file reads and searches)
- NEVER modify any file in the legacy codebase
- Scan at most 5 directory levels deep for initial project detection
- Skip `node_modules/`, `vendor/`, `venv/`, `.venv/`, `__pycache__/`, `dist/`, `build/`, `.git/`, `target/`, `bin/`, `obj/` directories
- Skip binary files, images, fonts, and compiled assets
- If the codebase exceeds 500 source files, summarize the largest modules and recommend the user narrows scope

---

## Discovery Procedure

### Phase 1: Root Scan

1. List the root directory contents
2. Identify top-level markers:
   - Build/dependency files: `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `*.csproj`, `*.sln`, `Gemfile`, `composer.json`, `CMakeLists.txt`
   - Workspace/monorepo markers: `lerna.json`, `pnpm-workspace.yaml`, `nx.json`, `turbo.json`, `Cargo.toml` with `[workspace]`, `settings.gradle`
   - Documentation: `README.md`, `CONTRIBUTING.md`, `docs/`
   - CI/CD: `.github/workflows/`, `Jenkinsfile`, `.gitlab-ci.yml`, `.circleci/`, `Dockerfile`, `docker-compose.yml`
   - Configuration: `.env`, `.env.example`, config directories

### Phase 2: Project Boundary Detection

For each potential project root:

1. **Single project**: One dependency manifest at root, no workspace configuration
2. **Monorepo**: Workspace configuration file + multiple sub-project directories with own dependency manifests
3. **Multi-project**: Multiple independent projects in subdirectories (no shared workspace config)

Record for each project:
- `name`: Project/package name from manifest
- `path`: Relative path from codebase root
- `language`: Primary programming language
- `framework`: Detected framework (Express, Django, React, Spring, etc.)
- `runtime`: Runtime environment (Node.js, CPython, JVM, .NET, etc.)
- `build_tool`: Build system (npm, pip, cargo, maven, etc.)

### Phase 3: Module Detection (Per-Project)

For each project, identify modules/packages:

1. **Directory-based modules**: Directories with entry points (`index.ts`, `__init__.py`, `mod.rs`)
2. **Namespace-based modules**: Directories matching language namespace conventions
3. **Feature-based modules**: Directories organized by feature/domain area
4. **Layer-based modules**: Directories organized by architectural layer (controllers, services, repositories, models)

Record for each module:
- `name`: Module/package name
- `path`: Relative path from project root
- `type`: `feature` | `layer` | `utility` | `config` | `test` | `infrastructure`
- `entry_point`: Primary entry file (if identifiable)
- `estimated_loc`: Approximate lines of code (source files only)
- `dependencies`: Other modules this module imports from (internal deps)

### Phase 4: Entry Point Detection

Identify all application entry points:
- `main` functions or equivalent
- Server startup files (e.g., `app.ts`, `server.py`, `main.go`)
- CLI entry points
- Lambda/serverless handler files
- Background job/worker entry points
- Migration and seed scripts

### Phase 5: Infrastructure Detection

Scan for:
- **Database**: Migration files, ORM configuration, schema files, SQL scripts
- **Caching**: Redis/Memcached configuration
- **Messaging**: Queue configuration (RabbitMQ, Kafka, SQS)
- **External APIs**: HTTP client configuration, SDK imports
- **Authentication**: Auth middleware, JWT/OAuth configuration
- **Logging**: Logger configuration and usage patterns
- **Monitoring**: Health check endpoints, metrics collection

### Phase 6: Test Infrastructure Detection

Scan for:
- Test directories and file naming conventions (`*.test.ts`, `*_test.go`, `test_*.py`, `*Spec.java`)
- Test framework configuration (jest.config, pytest.ini, vitest.config)
- Test fixtures and factories
- Integration/E2E test setup
- Coverage configuration

---

## Discovery Manifest Format

Produce the following markdown document:

```markdown
# Discovery Manifest

> **Codebase**: <root_path>
> **Scanned**: <ISO 8601 timestamp>
> **Total projects**: <count>
> **Total modules**: <count>
> **Total estimated LOC**: <count>

---

## 1. Codebase Overview

<2-3 sentence summary of what this codebase appears to be>

### 1.1 Project Structure

| # | Project | Path | Language | Framework | Build Tool | Est. LOC |
|---|---------|------|----------|-----------|------------|----------|
| 1 | <name> | <path> | <lang> | <framework> | <tool> | <loc> |

### 1.2 Architecture Pattern

<Inferred overall architecture: monolith, microservices, monorepo, serverless, etc.>
Evidence: <list of directory patterns and files that support this inference>

---

## 2. Project: <project-name>

### 2.1 Technology Stack

| Layer | Technology | Version | Source |
|-------|-----------|---------|--------|
| Language | <lang> | <version from manifest> | <manifest file> |
| Framework | <framework> | <version> | <manifest file> |
| Database | <db> | <version if detectable> | <config/migration file> |
| ...

### 2.2 Modules

| # | Module | Path | Type | Entry Point | Est. LOC | Internal Deps |
|---|--------|------|------|-------------|----------|---------------|
| 1 | <name> | <path> | <type> | <entry file> | <loc> | <dep list> |

### 2.3 Entry Points

| # | Entry Point | Path | Purpose |
|---|------------|------|---------|
| 1 | <name> | <path> | <what it starts/does> |

### 2.4 Infrastructure Dependencies

| # | Service | Type | Config Source |
|---|---------|------|---------------|
| 1 | PostgreSQL | Database | <path to config/migration> |
| 2 | Redis | Cache | <path to config> |

### 2.5 Test Infrastructure

| Aspect | Detail |
|--------|--------|
| Framework | <jest/pytest/vitest/etc.> |
| Config | <path> |
| Test directories | <paths> |
| Naming convention | <pattern> |
| Estimated test files | <count> |

### 2.6 Configuration

| Config File | Purpose | Key Settings |
|-------------|---------|--------------|
| <path> | <purpose> | <notable env vars or settings> |

(Repeat Section 2 for each project)

---

## 3. Cross-Project Dependencies

| From | To | Type | Evidence |
|------|-----|------|----------|
| <project A> | <project B> | <shared lib / API call / DB> | <file evidence> |

---

## 4. Exclusions

Files and directories skipped during discovery:
- <path>: <reason>
```

---

## Size Estimation Heuristic

To estimate LOC without reading every file:
1. Use `file_search` with language-specific glob patterns to count source files
2. Sample 5-10 representative files per module, read them, compute average LOC
3. Multiply: `estimated_loc = file_count * average_loc`

This avoids reading hundreds of files while giving a useful size estimate.
