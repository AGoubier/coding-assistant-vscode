---
name: api-docs-generator
description: Generates API documentation from source code, including endpoint signatures, request/response schemas, and usage examples.
---

# API Documentation Generator

This skill scans your codebase and generates comprehensive API documentation.

## Capabilities

- Extracts route definitions from Express, FastAPI, Flask, and ASP.NET
- Generates OpenAPI 3.0 YAML from code annotations
- Produces Markdown API reference with request/response examples
- Detects authentication requirements per endpoint
- Identifies missing documentation coverage

## Usage

Ask the agent to "generate API docs" or "document the /users endpoint" and this skill will:

1. Scan the relevant source files for route/endpoint definitions
2. Extract parameter types, request bodies, and response schemas
3. Generate formatted documentation with curl examples
4. Flag undocumented endpoints

## Output Format

The skill produces Markdown files compatible with MkDocs, Docusaurus, and GitHub Pages.
