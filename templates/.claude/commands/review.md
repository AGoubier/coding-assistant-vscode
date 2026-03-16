---
name: review
description: Perform a thorough code review of recent changes.
---

# /review command

Usage: `/review [file or path]`

Reviews the specified files or the most recent git changes if no path is given.

## Review Criteria

1. **Correctness**: Does the code do what it claims?
2. **Security**: Any OWASP Top 10 vulnerabilities?
3. **Performance**: Any obvious bottlenecks or N+1 queries?
4. **Readability**: Is the code self-documenting?
5. **Testing**: Are edge cases covered?
6. **Conventions**: Does it follow project standards?

## Output Format

For each finding:
```
[SEVERITY] file.ts:L42 - Description of issue
  Suggestion: How to fix it
```

Severity levels: CRITICAL, WARNING, SUGGESTION, PRAISE

Always end with at least one PRAISE item to acknowledge good work.
