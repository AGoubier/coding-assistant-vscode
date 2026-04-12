---
name: review-deps
description: "Dependency review skill. Checks for known CVEs, abandoned packages, unnecessary dependencies, license compatibility, version pinning, and supply chain integrity."
argument-hint: "Invoked by Review Coordinator - do not call directly"
---

# review-deps - Dependency Review Skill

This skill is invoked by the Review Coordinator as a subagent. It reviews project dependencies for security vulnerabilities, maintenance health, licensing, and supply chain concerns.

**Input contract** (received via subagent prompt):
1. Read this SKILL.md file for review instructions.
2. Read the specification file to understand dependency-relevant requirements (NFRs, security constraints, license requirements).
3. Read the WP file to identify what was implemented and scope the review.
4. Identify the project's dependency manifest files (see known patterns below). Use `#tool:search/searchSubagent` to discover manifest files across the codebase.
5. For each major dependency, use `#tool:web` to research known CVEs against trusted databases.
6. Evaluate each checklist item below.
7. Write structured findings to the specified output path.
8. Return a brief summary (counts of PASS/WARN/FAIL/N/A).

**Constraint**: Do NOT modify any source code, dependency files, the WP file, or the spec file. Only write to the specified output path (FR-028).

**Known dependency manifest patterns**:
- Python: `requirements.txt`, `pyproject.toml`, `Pipfile`, `setup.py`, `setup.cfg`
- JavaScript/TypeScript: `package.json`
- Rust: `Cargo.toml`
- Go: `go.mod`
- Java: `pom.xml`, `build.gradle`
- .NET: `*.csproj`, `packages.config`

**Known lockfile patterns**:
- Python: `Pipfile.lock`, `poetry.lock`, `requirements.txt` (with hashes)
- JavaScript: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
- Rust: `Cargo.lock`
- Go: `go.sum`

If no recognized dependency manifest is found, mark the entire skill as N/A.

---

## Dependency Checklist

### Category 1: Known CVEs (FR-048.1)
- [ ] For each major dependency, search for known CVEs via trusted sources
- [ ] Check NVD (nvd.nist.gov) for each dependency name and version
- [ ] Check GitHub Advisory Database for each dependency
- [ ] Record CVSS score and severity for each CVE found
- [ ] Verify whether the installed version is within the affected range

**Trusted sources for CVE lookup** (NFR-006):
- nvd.nist.gov (National Vulnerability Database)
- github.com/advisories (GitHub Advisory Database)
- npmjs.com (npm audit advisories)
- pypi.org (Python package index)
- crates.io (Rust crate registry)

If web research fails or is unavailable, record WARN: "Unable to verify CVEs via external source. Manual audit recommended."

### Category 2: Abandoned/Unmaintained Packages (FR-048.2)
- [ ] Are any dependencies explicitly archived or deprecated?
- [ ] Have any dependencies had no commits or releases in the last 12 months?
- [ ] Are there deprecation notices in the package README or changelog?

### Category 3: Unnecessary Dependencies (FR-048.3)
- [ ] Are all declared dependencies actually imported/used in the codebase?
- [ ] Do any dependencies duplicate functionality available in the language runtime?
- [ ] Do any dependencies overlap significantly with each other?

### Category 4: License Compatibility (FR-048.4)
- [ ] Is the project's own license documented?
- [ ] Are all dependency licenses compatible with the project license?
- [ ] Are there any copyleft licenses (GPL, AGPL) in a permissively licensed project?
- [ ] Are there any dependencies with no license specified?

### Category 5: Version Pinning (FR-048.5)
- [ ] Are dependencies pinned to exact versions or narrow ranges?
- [ ] Are floating ranges (`^`, `~`, `*`, `>=`) used without a lockfile present?
- [ ] Is there a lockfile that pins transitive dependencies?

### Category 6: Supply Chain Integrity (FR-048.6)
- [ ] Does a lockfile exist for the project's dependency manager?
- [ ] Does the lockfile include integrity hashes/checksums?
- [ ] Are dependencies sourced from official registries (not private/unknown sources)?

---

## Severity Guidance (FR-049)

### FAIL - Must fix before approval
- Known CVEs with CVSS score >= 7.0 (High or Critical severity)

### WARN - Should address, does not block approval
- Known CVEs with CVSS score < 7.0 (Low or Medium severity)
- Abandoned or unmaintained packages (no activity in 12+ months)
- License compatibility concerns
- Missing lockfile or lockfile without checksums
- Unnecessary dependencies
- Floating version ranges without lockfile

### N/A - Not applicable
Use N/A with justification when a category does not apply. Example justifications:
- "No dependency manifest found in this project"
- "Project has no runtime dependencies (standalone scripts)"
- "License check not applicable - internal/private project with no distribution"

---

## Output Format

Write findings to the specified output path using the format below. Finding IDs use the `DEP-` prefix.

```markdown
---
skill: review-deps
wp: <WP-ID>
spec: <spec-path>
reviewed_at: <ISO-8601-timestamp>
status: completed
finding_counts:
  pass: <count>
  warn: <count>
  fail: <count>
  na: <count>
files_reviewed:
  - package.json
  - package-lock.json
---

# review-deps Findings for <WP-ID>

## Summary

<Brief overview: dependency manifest analyzed, total dependencies, CVEs found, overall health assessment.>

## Findings

### DEP-001 [FAIL]
- **Checklist item**: Known CVEs - High severity
- **Requirement**: FR-048 category 1, FR-049
- **File**: package.json#L15
- **Description**: lodash@4.17.20 has CVE-2021-23337 (CVSS 7.2 - command injection via template).
- **Expected**: Upgrade to lodash@4.17.21 or later (patched).
- **Evidence**: NVD lookup confirmed affected versions: < 4.17.21.

### DEP-002 [WARN]
- **Checklist item**: Abandoned Package
- **Requirement**: FR-048 category 2
- **File**: package.json#L22
- **Description**: request@2.88.2 is deprecated. Last release was in 2020.
- **Expected**: Migrate to an actively maintained HTTP client (e.g., got, axios, undici).
- **Evidence**: NPM page shows "DEPRECATED" banner.

### DEP-003 [WARN]
- **Checklist item**: Version Pinning - Floating range
- **Requirement**: FR-048 category 5
- **File**: package.json#L18
- **Description**: express specified as "^4.18.0" (floating minor/patch).
- **Expected**: Use exact pin or ensure lockfile is committed.
- **Evidence**: package-lock.json exists and is committed - risk mitigated by lockfile.

### DEP-004 [N/A]
- **Checklist item**: License Compatibility
- **Justification**: Internal project with no distribution. License compatibility is not a concern.
```

---

## Quality Checklist

Before completing, verify:

- [ ] Every dependency in lockfile and manifest was evaluated
- [ ] CVE checks used current vulnerability databases
- [ ] Abandoned packages flagged (>2 years no release)
- [ ] License compatibility assessed for distribution model
- [ ] Version pinning verified (exact versions, not ranges)
- [ ] `finding_counts` match actual findings in the output
- [ ] `files_reviewed` lists every file read during this review
