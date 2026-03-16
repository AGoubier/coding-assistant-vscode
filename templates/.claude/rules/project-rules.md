# Project Rules

## Code Style

- Maximum line length: 100 characters
- Indentation: 2 spaces (no tabs)
- Trailing commas: always in multiline structures
- Semicolons: always in TypeScript/JavaScript
- String quotes: single quotes for code, double quotes for JSX attributes

## Architecture Rules

- No circular dependencies between modules
- All public APIs must have JSDoc documentation
- Database access only through the repository layer
- Business logic must not depend on framework-specific types
- Configuration values must come from environment, never hardcoded

## Testing Rules

- Every PR must include tests for new functionality
- No test file may import from another test file
- Mocks must be defined adjacent to the test, not in shared fixtures
- Integration tests must clean up after themselves
- Snapshot tests are forbidden (they erode over time)

## Review Rules

- All PRs require at least one approval
- Security-sensitive changes require two approvals
- No force-pushes to main or release branches
- Commits must follow Conventional Commits format
