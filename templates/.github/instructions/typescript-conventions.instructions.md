## TypeScript Project Instructions

When working in this TypeScript project, follow these conventions:

- Use **strict mode** (`"strict": true` in tsconfig)
- Prefer `interface` over `type` for object shapes unless union types are needed
- Use `readonly` for properties that should not be reassigned
- Avoid `any` - use `unknown` with type guards instead
- Export types separately from implementations using `export type`
- Use barrel files (`index.ts`) for public API surfaces
- Prefer named exports over default exports
- Use `const` assertions for literal types: `as const`
- Enable `noUncheckedIndexedAccess` for safer array/object access
