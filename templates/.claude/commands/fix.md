---
name: fix
description: Diagnose and fix a bug from an issue description or error message.
---

# /fix command

Usage: `/fix <error message or issue description>`

## Behavior

1. Parse the error message or issue description
2. Search the codebase for related code
3. Identify the root cause
4. Apply the minimal fix
5. Verify by running relevant tests
6. Summarize what was wrong and what was changed

## Output

- Brief root cause analysis
- Diff of changes made
- Test results confirming the fix
- Any follow-up recommendations
