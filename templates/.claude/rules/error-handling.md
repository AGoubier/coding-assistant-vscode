# Error Handling Rules

## Principles

- Fail fast: detect errors early and close to the source
- Fail loud: errors must be logged with context sufficient for debugging
- Fail safe: never expose internal details to end users

## Error Classification

| Type | HTTP Status | User Message | Log Level |
|------|------------|--------------|-----------|
| Validation error | 400 | Descriptive field-level errors | WARN |
| Authentication failure | 401 | "Invalid credentials" (generic) | WARN |
| Authorization failure | 403 | "Access denied" | WARN |
| Not found | 404 | "Resource not found" | INFO |
| Conflict | 409 | "Resource already exists" or "Stale data" | INFO |
| Internal error | 500 | "An unexpected error occurred" | ERROR |
| External service failure | 502/503 | "Service temporarily unavailable" | ERROR |

## Implementation

- Use typed error classes, not raw strings or generic Error
- Include a machine-readable error code (e.g., `AUTH_TOKEN_EXPIRED`)
- Include a correlation ID in error responses for traceability
- Retry transient errors (network, 429, 503) with exponential backoff
- Never catch and swallow errors silently
- Never log stack traces at INFO level
