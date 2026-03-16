---
name: write-pr-description
description: Generate a well-structured pull request description from staged changes.
---

Analyze the current git diff and generate a pull request description:

## Format

### Title
A concise, imperative summary (under 72 chars)

### Description
- **What**: What this PR does (1-2 sentences)
- **Why**: The motivation or issue being addressed
- **How**: Key implementation decisions and approach

### Changes
- Bullet list of significant changes, grouped by area

### Testing
- How the changes were tested
- Any manual testing steps for reviewers

### Checklist
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No breaking changes (or migration guide provided)
