---
name: doc-deployment
description: "Deployment guide documentation skill. Produces and updates deployment instructions with prerequisites, build steps, infrastructure requirements, and operational procedures in .sdd/docs/deployment-guide.md."
argument-hint: "Invoked by Docs Agent Coordinator - do not call directly"
---

# doc-deployment - Deployment Guide Skill

This skill is invoked by the Docs Agent Coordinator as a subagent. It produces and updates `.sdd/docs/deployment-guide.md` with deployment prerequisites, build and release steps, infrastructure requirements, health checks, and operational procedures. The skill reads the spec, WP, contract files, and the actual codebase to generate accurate deployment documentation.

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
| **Target file** | `.sdd/docs/deployment-guide.md` |
| **Action** | Create if missing; update incrementally if existing |
| **Content** | Prerequisites, build steps, infrastructure, health checks, operations |

## Execution Sequence (FR-006)

1. **Read SKILL.md** -- Load this file for documentation generation instructions
2. **Read existing docs** -- Read `.sdd/docs/deployment-guide.md` if it exists to understand current content
3. **Read source material** -- Read the WP file, spec, contract files, and implementation source files for content. Read multiple independent files in parallel.
4. **Write documentation** -- Update or create `.sdd/docs/deployment-guide.md` incrementally (do NOT recreate from scratch)

## Constraints

- Do NOT modify spec files, plan files, contract files, or implementation source files
- Do NOT recreate deployment-guide.md from scratch on incremental updates -- preserve existing content
- Use plain ASCII only -- no em dashes, smart quotes, or curly apostrophes
- Follow the canonical section order defined below
- Deployment steps MUST be derived from actual project files (Dockerfile, CI configs, scripts), NOT invented

---

## Section 1 -- Prerequisites

Document what must be in place before deploying.

### Instructions

1. Read project files to identify runtime dependencies: Dockerfile, docker-compose.yml, CI/CD configs, build scripts
2. List required software and versions (runtime, database, message broker, etc.)
3. List required infrastructure (cloud provider, container registry, DNS, etc.)
4. List required credentials and access (API keys, cloud IAM roles, etc.)

### Output Format

```markdown
# Deployment Guide

## Prerequisites

### Software Requirements

| Software | Minimum Version | Purpose |
|----------|----------------|---------|
| Node.js | 20.x | Application runtime |
| PostgreSQL | 15.x | Primary database |
| Docker | 24.x | Container builds |

### Infrastructure Requirements

- Container registry access (e.g., Docker Hub, ECR, GCR)
- Load balancer with TLS termination
- DNS entry for the application domain

### Required Credentials

- `DATABASE_URL` -- PostgreSQL connection string (see Configuration Guide)
- `JWT_SECRET` -- Token signing key
- Container registry push credentials
```

---

## Section 2 -- Build and Release

Document how to build and package the application for deployment.

### Instructions

1. Read build configuration (package.json scripts, Makefile, Dockerfile, CI configs)
2. Document the build steps in order
3. Document how artifacts are versioned and tagged
4. Document any build-time environment variables

### Output Format

```markdown
## Build and Release

### Build Steps

```bash
# 1. Install dependencies
npm ci --production

# 2. Run tests
npm test

# 3. Build production artifacts
npm run build

# 4. Build Docker image
docker build -t app:$(git rev-parse --short HEAD) .
```

### Versioning

- Docker images are tagged with the git short SHA and `latest`
- Release versions follow semver: `vMAJOR.MINOR.PATCH`
```

---

## Section 3 -- Deployment Process

Document the step-by-step deployment process.

### Instructions

1. Read CI/CD configuration files for deployment pipelines
2. Document manual deployment steps if no automation exists
3. Include rollback procedures
4. Note any deployment dependencies (database migrations, cache invalidation)

### Output Format

```markdown
## Deployment Process

### Automated (CI/CD)

1. Push to `main` branch triggers the deployment pipeline
2. Pipeline runs tests, builds Docker image, pushes to registry
3. Deployment tool (Kubernetes, ECS, etc.) pulls new image
4. Rolling update replaces old containers with new ones

### Manual Deployment

```bash
# 1. Pull latest image
docker pull registry.example.com/app:latest

# 2. Run database migrations
docker run --rm app:latest npm run migrate

# 3. Restart service
docker-compose up -d app
```

### Rollback

```bash
# Revert to previous image tag
docker-compose down
docker tag registry.example.com/app:<previous-sha> registry.example.com/app:latest
docker-compose up -d
```
```

---

## Section 4 -- Health Checks and Monitoring

Document how to verify the deployment is healthy.

### Instructions

1. Search source code for health check endpoints (`/health`, `/ready`, `/live`)
2. Document what each endpoint checks and expected responses
3. Document any monitoring or alerting integrations

### Output Format

```markdown
## Health Checks

| Endpoint | Method | Expected Response | Checks |
|----------|--------|-------------------|--------|
| `/health` | GET | `200 { "status": "ok" }` | Application is running |
| `/ready` | GET | `200 { "status": "ready" }` | Database connected, cache warm |

### Monitoring

- Application logs are written to stdout in JSON format
- Metrics are exposed at `/metrics` in Prometheus format
- Recommended alerts: error rate > 1%, p99 latency > 500ms, health check failures
```

---

## Section 5 -- Operational Procedures

Document common operational tasks.

### Instructions

1. Read source code for admin commands, management scripts, maintenance tasks
2. Document database migration procedures
3. Document log access and debugging procedures
4. Document scaling procedures if applicable

### Output Format

```markdown
## Operational Procedures

### Database Migrations

```bash
# Run pending migrations
npm run migrate

# Check migration status
npm run migrate:status

# Rollback last migration
npm run migrate:rollback
```

### Log Access

```bash
# View application logs
docker logs -f app --since 1h

# Search for errors
docker logs app 2>&1 | grep ERROR
```

### Scaling

- Horizontal scaling: increase replica count in deployment config
- Vertical scaling: adjust resource limits in container config
- Database scaling: add read replicas for read-heavy workloads
```

---

## Incremental Update Protocol

When `deployment-guide.md` already exists with content from prior work packages:

### Rules

1. **Read before write** -- Always read the existing file before making changes
2. **Update only affected sections** -- If the WP adds new health endpoints, update Section 4. If it adds new deploy scripts, update Section 3
3. **Preserve unaffected sections** -- Sections not related to the current WP remain unchanged
4. **Merge, do not replace** -- Add new entries alongside existing ones within affected sections
5. **Add WP attribution** -- Note which WP introduced deployment changes:
   ```markdown
   ### Cache Warmup (WP05)
   ```

---

## Quality Checklist

Before completing, verify:

- [ ] Prerequisites list actual software and infrastructure requirements
- [ ] Build steps match actual build configuration (Dockerfile, scripts, CI)
- [ ] Deployment process reflects actual deployment mechanism
- [ ] Health check endpoints match actual routes in source code
- [ ] Rollback procedure is documented and tested
- [ ] No hardcoded secrets or sensitive values in examples
- [ ] Incremental updates preserve prior WP content
- [ ] No em dashes, smart quotes, or curly apostrophes in output
