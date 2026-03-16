---
name: generate-tests
description: Generate a comprehensive test suite for the given code.
---

Generate tests for the provided code following these guidelines:

## Requirements

- Use the project's existing test framework (detect from package.json / pyproject.toml)
- Cover: happy paths, edge cases, error scenarios, and boundary conditions
- Follow the Arrange-Act-Assert pattern
- Use descriptive test names: `should <behavior> when <condition>`
- Mock external dependencies but test real internal logic
- Target 80%+ code coverage

## Output

Produce a complete, runnable test file. Include:
- All necessary imports
- Test setup/teardown if needed
- Inline comments explaining non-obvious test cases
