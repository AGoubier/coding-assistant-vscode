---
name: database-migration
description: Manages database schema migrations with rollback support and data integrity checks.
---

# Database Migration Skill

A skill for creating, validating, and applying database schema migrations safely.

## Capabilities

- Generate migration files from schema diffs
- Validate migration SQL before execution
- Support rollback scripts for every migration
- Check for data integrity issues (orphaned records, constraint violations)
- Support PostgreSQL, MySQL, and SQLite dialects

## Usage

Ask the agent to "create a migration for adding a users table" or "generate rollback for migration 003".

## Safety Checks

Before applying any migration, the skill will:

1. Verify the migration is reversible
2. Check for potential data loss (column drops, type changes)
3. Estimate execution time on large tables
4. Warn about locking implications

## Supported ORMs

- Prisma
- Drizzle
- TypeORM
- Alembic (Python)
- Django migrations
