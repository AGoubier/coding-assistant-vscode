# Project Instructions

This file provides project-wide instructions for Claude Code.

## General

- This is a TypeScript project using Node.js
- Follow the coding conventions in `.claude/rules/project-rules.md`
- Run tests with `npm test` before marking any task complete
- Keep all documentation in sync with code changes

## Project Structure

- `src/` - Source code
- `test/` - Test files (mirror src/ structure)
- `docs/` - Documentation
- `scripts/` - Build and utility scripts

## Key Principles

- Security first: validate all inputs, encode all outputs
- Test-driven: write tests alongside or before implementation
- Minimal scope: implement only what is asked, nothing more
- Plain language: comments and docs should be clear to a junior developer
