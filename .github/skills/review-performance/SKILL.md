---
name: review-performance
description: "Performance review skill. Detects N+1 queries, missing indexes, blocking in async contexts, unbounded data fetching, unnecessary computation, inefficient data structures, and missing caching opportunities."
argument-hint: "Invoked by Review Coordinator - do not call directly"
---

# review-performance - Performance Review Skill

This skill is invoked by the Review Coordinator as a subagent. It detects performance anti-patterns across 7 categories, focusing on algorithmically significant issues rather than micro-optimizations.

**Input contract** (received via subagent prompt):
1. Read this SKILL.md file for review instructions.
2. Read the specification file for any performance NFRs (Section 10.1).
3. Discover and read all implementation code relevant to this WP.
4. Evaluate each checklist item below against the discovered code.
5. Write structured findings to the specified output path.
6. Return a brief summary (counts of PASS/WARN/FAIL/N/A).

**Constraint**: Do NOT modify any source code, the WP file, or the spec file. Only write to the specified output path (FR-028).

---

## Performance Checklist

### Category 1: N+1 Query Patterns (FR-044.1)
- [ ] Are there database queries executed inside loops (for/while/forEach)?
- [ ] Are related entities loaded one-by-one instead of via JOIN or batch query?
- [ ] Are there ORM lazy-loading calls triggered inside iteration over a collection?

### Category 2: Missing Database Indexes (FR-044.2)
- [ ] Are frequently queried columns (WHERE, ORDER BY, JOIN keys) indexed?
- [ ] Are compound queries using column combinations that lack a composite index?
- [ ] Are there full-table scans on large tables inferred from query patterns?

### Category 3: Blocking in Async Contexts (FR-044.3)
- [ ] Are synchronous I/O calls (file reads, HTTP requests, sleep) used inside async functions?
- [ ] Are blocking database drivers used where async drivers are available?
- [ ] Are CPU-intensive computations run on the event loop without offloading?

### Category 4: Unbounded Data Fetching (FR-044.4)
- [ ] Are queries missing LIMIT/pagination for potentially large result sets?
- [ ] Are API responses returning entire collections without pagination?
- [ ] Are file reads loading entire files into memory instead of streaming?

### Category 5: Unnecessary Computation in Hot Paths (FR-044.5)
- [ ] Are values recomputed on each call that could be cached or precomputed?
- [ ] Are there redundant parsing/serialization cycles (serialize then immediately deserialize)?
- [ ] Are expensive lookups repeated in tight loops instead of being hoisted?

### Category 6: Inefficient Data Structures (FR-044.6)
- [ ] Are linear searches used on lists where a set or map lookup would be O(1)?
- [ ] Are lists used for membership testing (`if x in large_list`) instead of sets?
- [ ] Are data structures mismatched to their access patterns (e.g., frequent inserts into sorted arrays)?

### Category 7: Missing Caching (FR-044.7)
- [ ] Are expensive computations called repeatedly with identical inputs without caching?
- [ ] Are remote API calls made repeatedly for the same data without caching?
- [ ] Are there opportunities for memoization of pure functions called in loops?

---

## Severity Guidance (FR-045)

### WARN (default for all performance findings)
All performance findings default to WARN severity. Performance issues are advisory - they highlight areas for improvement but do not block approval.

### FAIL (only for NFR violations)
FAIL severity applies only when a performance issue directly violates a specific performance NFR from the spec's Section 10.1. For example, if the spec states a maximum response time and the detected pattern would make meeting that target impossible.

When issuing a FAIL, cite the specific NFR being violated (e.g., "Violates NFR-001: 30-minute review time").

### N/A - Not applicable
Use N/A with justification when a category does not apply. Example justifications:
- "No database access in this WP" for N+1 queries, missing indexes
- "No async code in this WP" for blocking in async contexts
- "No remote API calls in this WP" for missing caching

---

## Output Format

Write findings to the specified output path using the format below. Finding IDs use the `PERF-` prefix.

```markdown
---
skill: review-performance
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
  - <file-1>
  - <file-2>
---

# review-performance Findings for <WP-ID>

## Summary

<Brief overview: files analyzed, performance patterns detected, overall assessment.>

## Findings

### PERF-001 [WARN]
- **Checklist item**: N+1 Query Pattern
- **Requirement**: FR-044 category 1
- **File**: src/api/orders.py#L30-L38
- **Description**: Database query executed inside a loop iterating over user IDs.
- **Expected**: Use a batch query or JOIN to load all related orders in one query.
- **Evidence**:
  ```python
  for uid in user_ids:
      orders = db.query(Order).filter(user_id=uid).all()
  ```

### PERF-002 [N/A]
- **Checklist item**: Blocking in Async Contexts
- **Justification**: No async code in this WP. All functions are synchronous.
```
