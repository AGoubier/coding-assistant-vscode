---
name: scaffold
description: Generate boilerplate code for common patterns (API endpoint, React component, database model, etc.)
---

# /scaffold command

Usage: `/scaffold <type> <name> [options]`

## Supported Types

| Type | What it generates |
|------|-------------------|
| `api-endpoint` | Route handler, validation schema, service method, test file |
| `react-component` | Component file, styles, test file, Storybook story |
| `db-model` | Schema definition, migration, repository class, seed data |
| `cli-command` | Command handler, argument parser, help text, test |

## Examples

- `/scaffold api-endpoint user-profile`
- `/scaffold react-component DashboardCard --with-tests --with-story`
- `/scaffold db-model Invoice --fields "amount:number, status:enum(draft,sent,paid)"`

## Principles

- Follow existing project conventions (detect from codebase)
- Include comprehensive error handling
- Generate meaningful test cases, not empty stubs
- Add TODO comments where project-specific logic is needed
