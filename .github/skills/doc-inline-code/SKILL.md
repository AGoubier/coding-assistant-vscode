---
name: doc-inline-code
description: "Inline code documentation skill. Adds and updates docstrings, comments, and type annotations in implementation source files without modifying logic."
argument-hint: "Invoked by Docs Agent Coordinator - do not call directly"
---

# doc-inline-code - Inline Code Documentation Skill

This skill is invoked by the Docs Agent Coordinator as a subagent. It adds and updates docstrings, comments, and type annotations in implementation source files modified by the approved work package. Unlike other doc skills that write to `.sdd/docs/`, this skill modifies source files directly. It SHALL NOT modify implementation logic -- only documentary content (docstrings, comments, type annotations) may be added or updated.

## Input Contract (FR-005)

This skill receives the following 6 inputs via the coordinator's subagent prompt, as defined in `DOC-SKILL-CONTRACT.md`:

| # | Input | Type | Description |
|---|-------|------|-------------|
| 1 | `skill_path` | Path | Path to this SKILL.md file |
| 2 | `wp_path` | Path | Path to the approved WP file and its task list |
| 3 | `spec_path` | Path | Path to the spec file; includes contract files directory (`.sdd/plans/contracts/<WP-slug>/`) |
| 4 | `source_files` | List(Path) | Implementation source files modified by the WP |
| 5 | `docs_dir` | Path | Path to existing documentation directory (`.sdd/docs/`) for incremental updates |
| 6 | `patterns` | Text | Active doc-domain patterns to avoid (from `.sdd/reviews/doc-patterns.md`) |

## Output Contract

| Field | Value |
|-------|-------|
| **Target files** | Implementation source files (`*.ts`, `*.py`, `*.go`, `*.rs`, `*.js`, `*.jsx`, `*.tsx`) |
| **Action** | Update source files in-place; add missing docstrings, comments, and type annotations |
| **Content** | Module-level docstrings, function/method docstrings, complex logic comments, type annotations |

## Execution Sequence (FR-006)

1. **Read SKILL.md** -- Load this file for inline documentation instructions
2. **Read existing docs** -- Read the source files listed in `source_files` to understand current documentation state
3. **Read source material** -- Read the WP file, spec, and contract files to understand the purpose and expected behavior of each function/module
4. **Write documentation** -- Update source files in-place, adding or updating docstrings, comments, and type annotations without modifying logic

---

## CONSTRAINTS (FR-019)

> **This section is critical. Read it before making any changes to source files.**

The skill SHALL NOT modify implementation logic. Only documentary content may be added or updated. This is the only doc skill that modifies source files, and it must do so with extreme care.

### Permitted Changes

- Adding or updating module-level docstrings
- Adding or updating function/method/class docstrings
- Adding comments explaining complex logic ("why", not "what")
- Adding type annotations where missing and the language supports them
- Fixing typos or inaccuracies in existing docstrings

### Prohibited Changes -- NEVER Do These

- **Changing variable names**: Do not rename variables, even for clarity
- **Refactoring functions**: Do not split, merge, reorder, or restructure functions
- **Fixing bugs**: Do not fix implementation bugs, even obvious ones -- report them instead
- **Changing control flow**: Do not add, remove, or modify if/else, loops, try/catch, or return statements
- **Modifying function signatures**: Do not change parameter names, default values, or return types in the code itself (type annotations in docstrings are fine)
- **Adding or removing imports**: Do not change import statements
- **Changing data structures**: Do not modify objects, arrays, dictionaries, or their contents
- **Adding error handling**: Do not add try/catch, validation, or guard clauses
- **Deleting code**: Do not remove any existing code, even dead code or commented-out code

If you discover a bug, a code smell, or an improvement opportunity, include it in your report to the coordinator but do NOT make the change.

---

## Step 1 -- Identify Source Files to Document

Read the `source_files` list provided by the coordinator and determine which files need documentation updates.

### Instructions

1. For each file in `source_files`:
   a. Read the file contents in full using `read_file`
   b. Determine the file's programming language from its extension
   c. Note which functions, methods, and classes exist
   d. Note which already have docstrings and which are missing them
   e. Note which have type annotations and which are missing them
2. Skip files that are not source code (e.g., `.md`, `.json`, `.yaml`, `.toml`, `.lock`, `.env`)
3. Skip files where all documentation is already complete and accurate
4. Build a list of files that need documentation updates, with specific gaps noted

---

## Step 2 -- Detect Existing Docstring Convention (FR-020)

Before writing any docstrings, detect the project's existing docstring convention.

### Instructions

1. Read a sample of existing source files in the project (not just the WP's files) to detect the docstring style in use:
   - Use `file_search` or `grep_search` to find files with existing docstrings
   - Examine at least 3-5 files with existing docstrings if available
2. Check for consistent patterns:

   | Language | Convention indicators |
   |----------|----------------------|
   | Python | `"""` triple-quote style; look for `:param`, `Args:`, `:returns:`, `Returns:` to distinguish Google vs NumPy vs Sphinx style |
   | TypeScript/JavaScript | `/** ... */` JSDoc style; look for `@param`, `@returns`, `@throws` |
   | Go | `// FunctionName ...` comment directly above function (godoc convention) |
   | Rust | `/// ...` doc comments with markdown formatting (rustdoc convention) |

3. If a consistent convention is detected, use it for all new docstrings
4. If no existing docstrings are found (greenfield code), use the language default:

   | Language | Default convention |
   |----------|-------------------|
   | Python | Google style (`Args:`, `Returns:`, `Raises:`) |
   | TypeScript | JSDoc (`@param`, `@returns`, `@throws`) |
   | JavaScript | JSDoc (`@param`, `@returns`, `@throws`) |
   | Go | godoc (comment starts with function name) |
   | Rust | rustdoc (`///` with markdown) |

5. Record the detected convention so all docstrings in this run are consistent

---

## Step 3 -- Add Module-Level Docstrings (FR-018.1)

Add or update module-level docstrings that describe the purpose of each file.

### Instructions

1. For each source file that lacks a module-level docstring, add one at the top of the file (after any shebang line or language-required header)
2. The docstring SHALL describe:
   - The module's purpose (what it does)
   - Its role in the larger system (where it fits)
   - Key exports or entry points (what it provides)
3. Keep module docstrings concise -- 2-5 lines for most files
4. If a module docstring already exists and is accurate, leave it unchanged
5. If a module docstring exists but is stale or inaccurate (e.g., describes a purpose the module no longer serves), update it to reflect the current state

### Examples by Language

**Python**:
```python
"""User authentication module.

Provides JWT token generation, validation, and refresh functionality
for the authentication API. Used by the auth router and middleware.
"""
```

**TypeScript**:
```typescript
/**
 * User authentication module.
 *
 * Provides JWT token generation, validation, and refresh functionality
 * for the authentication API. Used by the auth router and middleware.
 */
```

**Go**:
```go
// Package auth provides JWT token generation, validation, and refresh
// functionality for the authentication API.
package auth
```

**Rust**:
```rust
//! User authentication module.
//!
//! Provides JWT token generation, validation, and refresh functionality
//! for the authentication API. Used by the auth router and middleware.
```

---

## Step 4 -- Add Function/Method Docstrings (FR-018.2)

Add or update docstrings for functions, methods, and classes that lack them.

### Instructions

1. For each public function, method, or class without a docstring, add one
2. Private/internal functions (prefixed with `_` in Python, not exported in TS/JS) should get docstrings if they contain complex logic; simple helpers may be skipped
3. Each docstring SHALL include:
   - A brief description of what the function does (one line)
   - Parameter descriptions with types (if the language convention includes them)
   - Return type and description
   - Exceptions/errors raised (if any)
4. Read the spec and contract files to understand the expected behavior of each function -- use this to write accurate descriptions, not guesses
5. If a docstring exists and is accurate, leave it unchanged
6. If a docstring exists but is stale (parameters changed, behavior changed), update it

### Examples by Language

**Python (Google style)**:
```python
def refresh_token(token: str, secret: str) -> str:
    """Generate a new JWT token from an existing valid token.

    Args:
        token: The current JWT token to refresh.
        secret: The secret key used for signing the new token.

    Returns:
        A new JWT token string with an extended expiration.

    Raises:
        TokenExpiredError: If the input token has already expired.
        InvalidTokenError: If the input token is malformed.
    """
```

**TypeScript (JSDoc)**:
```typescript
/**
 * Generate a new JWT token from an existing valid token.
 *
 * @param token - The current JWT token to refresh.
 * @param secret - The secret key used for signing the new token.
 * @returns A new JWT token string with an extended expiration.
 * @throws {TokenExpiredError} If the input token has already expired.
 * @throws {InvalidTokenError} If the input token is malformed.
 */
function refreshToken(token: string, secret: string): string {
```

**Go (godoc)**:
```go
// RefreshToken generates a new JWT token from an existing valid token.
// It returns a new token string with an extended expiration.
// Returns TokenExpiredError if the input token has already expired.
// Returns InvalidTokenError if the input token is malformed.
func RefreshToken(token, secret string) (string, error) {
```

**Rust (rustdoc)**:
```rust
/// Generate a new JWT token from an existing valid token.
///
/// # Arguments
///
/// * `token` - The current JWT token to refresh.
/// * `secret` - The secret key used for signing the new token.
///
/// # Returns
///
/// A new JWT token string with an extended expiration.
///
/// # Errors
///
/// Returns `TokenExpiredError` if the input token has already expired.
/// Returns `InvalidTokenError` if the input token is malformed.
pub fn refresh_token(token: &str, secret: &str) -> Result<String, AuthError> {
```

---

## Step 5 -- Add Complex Logic Comments (FR-018.3)

Add comments explaining "why" for complex logic sections.

### Instructions

1. Scan each source file for complex logic that would benefit from a "why" comment:
   - Non-obvious algorithms or formulas
   - Workarounds for known issues or limitations
   - Performance optimizations that sacrifice readability
   - Business rules that are not self-evident from the code
   - Edge case handling whose purpose is not obvious
   - Magic numbers or constants whose meaning is not clear
2. For each complex section, add a comment explaining **why** the code is written this way, NOT **what** the code does
   - **Good**: `# Retry with exponential backoff because the upstream API rate-limits at 100 req/min`
   - **Bad**: `# Retry the request` (restates the code)
   - **Good**: `# Use a set instead of list for O(1) lookup during deduplication`
   - **Bad**: `# Create a set` (restates the code)
3. Do NOT add comments for straightforward code -- over-commenting is as bad as under-commenting
4. Place comments directly above the code they explain, not at the end of the line (unless the language convention prefers end-of-line comments)

### What NOT to Comment

- Simple variable assignments
- Standard control flow (basic if/else, simple loops)
- Self-documenting function calls
- Code that is already well-explained by its docstring
- Single-line expressions with clear intent

---

## Step 6 -- Add Type Annotations (FR-018.4)

Add type annotations where missing and the language supports them.

### Instructions

1. Check if the language supports type annotations:

   | Language | Type annotation support |
   |----------|------------------------|
   | Python | Yes (PEP 484 type hints: `def foo(x: int) -> str:`) |
   | TypeScript | Yes (native: `function foo(x: number): string`) |
   | JavaScript | No native support; use JSDoc `@param {type}` and `@returns {type}` instead |
   | Go | Yes (native: `func foo(x int) string`) -- types are required by the compiler, so this step is usually a no-op |
   | Rust | Yes (native: `fn foo(x: i32) -> String`) -- types are required by the compiler, so this step is usually a no-op |

2. For Python and TypeScript, add type annotations to:
   - Function parameters that lack type annotations
   - Function return types that lack annotations
   - Variables where the type is ambiguous (e.g., `items = []` -> `items: list[Item] = []`)
3. For JavaScript, add JSDoc type annotations where missing
4. For Go and Rust, type annotations are mandatory and likely already present -- skip this step unless the code somehow has missing types
5. Infer types from:
   - Contract files (interfaces, data schemas)
   - Function usage patterns in the codebase
   - Test files that show expected inputs/outputs
6. If the type cannot be confidently determined, use the broader type (e.g., `Any` in Python, `unknown` in TypeScript) and add a `# TODO: narrow type` comment

---

## Step 7 -- Verify No Logic Changes

Before completing, verify that no implementation logic was modified.

### Instructions

1. Review all changes made to source files
2. For each change, confirm it falls into one of the permitted categories:
   - Module-level docstring added or updated
   - Function/method/class docstring added or updated
   - Complex logic comment added
   - Type annotation added
   - Typo fixed in existing docstring
3. If any change modifies logic, undo it immediately
4. Report the final list of files modified and the types of changes made
