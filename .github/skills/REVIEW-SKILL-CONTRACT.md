# Review Skill Contract

Reference: FR-026 through FR-039 of `.sdd/specs/006-review-coordinator.spec.md`

## 1. Inputs (FR-026) — 5 mandatory inputs

| # | Input | Type | Description |
|---|-------|------|-------------|
| 1 | `skill_path` | Path | Path to this skill's SKILL.md |
| 2 | `wp_path` | Path | Path to the WP file being reviewed |
| 3 | `spec_path` | Path | Path to the source spec file |
| 4 | `contracts_dir` | Path | `.sdd/plans/contracts/<WP-slug>/` |
| 5 | `output_path` | Path | Where to write the findings file |

Skills may discover additional inputs (implementation files, dependency manifests, test files, doc files) via `get_changed_files`, `git diff`, or filesystem scanning. These are derived inputs, not passed by the coordinator.

## 2. Execution Sequence (FR-027) — 7 mandatory steps

Every review skill SHALL execute these steps in order:

| Step | Action | Notes |
|------|--------|-------|
| 1 | **Read SKILL.md** | Load this skill's own instructions |
| 2 | **Read spec** | Focus on the section(s) relevant to this skill's domain |
| 3 | **Read WP file** | Extract WP scope, task list, acceptance criteria, and `depends_on` |
| 4 | **Discover target files** | Find implementation/test/doc/dep files via `#tool:search/searchSubagent` (preferred for multi-file discovery), `#tool:search/usages` (for tracing specific symbols), `get_changed_files`, or `git diff`. Read multiple files in parallel. |
| 5 | **Evaluate checklist** | Apply the skill-specific checklist to each target file. Use `#tool:read/problems` to check for compile and lint errors. |
| 6 | **Write findings** | Write findings to `output_path` using the output format below |
| 7 | **Return summary** | Return PASS/WARN/FAIL/N/A counts to the coordinator |

**Step 3 is mandatory.** Review skills MUST read the WP file to understand what was supposed to be implemented before evaluating the code. Skipping this step leads to context-free reviews.

## 3. Output Contract (FR-028)

### 3.1 YAML Frontmatter — Required for ALL review skills

Every review skill output file SHALL begin with this YAML frontmatter block:

```yaml
---
skill: review-<name>
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
  - <file-path-1>
  - <file-path-2>
---
```

Skills MAY extend the frontmatter with additional fields (e.g., `contract_files_reviewed`, `info` count) but SHALL NOT omit any of the required fields above.

### 3.2 Findings Body Format

After the YAML frontmatter, findings SHALL use one of these formats based on severity:

**FAIL / WARN findings:**
```markdown
### <PREFIX>-<NNN> [FAIL]
- **Checklist item**: <what was checked>
- **Requirement**: <FR-NNN, section reference, or spec obligation>
- **File**: `<file-path>` (lines <N>-<M>)
- **Description**: <what was found>
- **Expected**: <what the spec/standard requires>
- **Evidence**: <specific code/config that violates the requirement>
```

**PASS findings:**
```markdown
### <PREFIX>-<NNN> [PASS]
- **Checklist item**: <what was checked>
- **Requirement**: <FR-NNN, section reference, or spec obligation>
- **File**: `<file-path>`
- **Description**: <brief confirmation of compliance>
```

**N/A findings:**
```markdown
### <PREFIX>-<NNN> [N/A]
- **Checklist item**: <what was checked>
- **Justification**: <why this item does not apply to this WP>
```

The severity tag appears in the heading (`[FAIL]`, `[WARN]`, `[PASS]`, `[N/A]`), not as a separate `**Severity**:` field.

### 3.3 Finding ID Prefixes

Each review skill uses a unique prefix to avoid collisions:

| Skill | Prefix |
|-------|--------|
| review-architecture | `ARCH-` |
| review-deps | `DEP-` |
| review-docs | `DOC-` |
| review-performance | `PERF-` |
| review-quality | `QUAL-` |
| review-security | `SEC-` |
| review-spec | `SPEC-` / `SPEC-CONTRACT-` |
| review-spec-completeness | `SPEC-COMP-` |
| review-tests | `TEST-` |

## 4. Severity Enum

All review skills SHALL use these severity levels consistently:

| Severity | Meaning | Blocks approval? |
|----------|---------|-------------------|
| `FAIL` | Violation that must be fixed before approval | Yes |
| `WARN` | Advisory finding, should be fixed but does not block | No |
| `PASS` | Checklist item verified and correct | No (positive confirmation) |
| `N/A` | Checklist item does not apply to this WP | No |

**Special cases**:
- `review-spec` uses `warn: 0` always (binary PASS/FAIL for spec adherence)
- `review-performance` defaults all findings to WARN; FAIL only for specific NFR violations
- `review-spec-completeness` maps its internal HIGH→FAIL, MEDIUM→WARN, LOW→WARN for the frontmatter counts

Skills SHALL NOT invent additional severity levels (e.g., INFO, LOW, HIGH) in the frontmatter counts. Internal classification within findings text is acceptable, but `finding_counts` SHALL only use the four canonical levels: `pass`, `warn`, `fail`, `na`.

## 5. Canonical Dispatch Order (FR-029)

The Review Coordinator dispatches skills in three batches with short-circuit logic:

**Batch 1 (Critical)**:
1. `review-spec` -- spec adherence (highest priority, most likely to FAIL)
2. `review-architecture` -- architecture adherence
3. `review-security` -- security audit

If Batch 1 produces any FAIL, the coordinator MAY skip Batch 2 and Batch 3 to issue an early "Changes Required" verdict.

**Batch 2 (Quality)**:
4. `review-quality` -- code quality
5. `review-performance` -- performance review

**Batch 3 (Coverage)**:
6. `review-tests` -- test quality
7. `review-deps` -- dependency review
8. `review-docs` -- documentation accuracy

**Re-review scoping**: On review cycles >= 2, the coordinator skips skills that previously returned all-PASS, dispatching only skills whose scope intersects with the rework changes.

`review-spec-completeness` is dispatched separately by the Planner as a pre-planning validation, not as part of the per-WP review cycle.

## 6. YAML Frontmatter — Skill Definition

```yaml
name: review-<name>
description: "<one-line, 1-500 chars>"
argument-hint: "Invoked by Review Coordinator - do not call directly"
```

## 7. Constraints

- **7.1 Read-only**: Review skills SHALL NOT modify source code, test files, WP files, spec files, or contract files. The ONLY file a review skill writes is the findings file at `output_path`.
- **7.2 No auto-fix**: Review skills report findings; they do not fix them. Fixes are the Coder's responsibility.
- **7.3 Scope discipline**: Only review files that belong to the WP being reviewed. Do not review unrelated code, even if it has issues.
- **7.4 Evidence-based**: Every FAIL finding SHALL cite a specific file, line number, and spec reference. Findings without evidence are invalid.
- **7.5 Idempotency**: Running the same review skill twice on the same unchanged code SHALL produce the same findings.
- **7.6 Quality checklist**: Each review skill SHOULD include a checkbox-style quality checklist covering its domain. This enables both the skill and the coordinator to verify completeness.

## 8. Verdict Aggregation (FR-030)

The Review Coordinator aggregates findings across all skills to produce a verdict:

| Condition | Verdict |
|-----------|---------|
| Zero FAIL findings AND zero WARN findings | `Approved` -- WP lane set to `done` |
| Zero FAIL findings AND one or more WARN findings | `Approved with Findings` -- WP lane set to `done` |
| One or more FAIL findings | `Changes Required` -- WP lane set to `to_do` with feedback |
