## Git Commit Standards

Follow these commit message conventions:

- Use **Conventional Commits** format: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`
- Keep the subject line under 72 characters
- Use imperative mood: "Add feature" not "Added feature"
- Reference issue numbers when applicable: `feat(auth): add OAuth2 flow (#42)`
- One logical unit of work per commit
- Never commit secrets, tokens, or credentials
- Always stage files explicitly - never use `git add .`
