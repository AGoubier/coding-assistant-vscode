# Dependency Management Rules

## Adding Dependencies

- Every new dependency must be justified in the PR description
- Prefer well-maintained packages with > 1000 weekly downloads
- Check the package's license compatibility (MIT, Apache-2.0, ISC are safe)
- Check for known CVEs before adding
- Prefer packages with TypeScript types included (not @types/ separately)
- Pin exact versions for production dependencies

## Updating Dependencies

- Run `npm audit` (or equivalent) weekly
- Update patch versions immediately when security fixes are released
- Update minor versions monthly in a dedicated PR
- Update major versions only with team discussion and migration plan

## Prohibited Patterns

- No `*` or `latest` version ranges
- No installing from git URLs in production
- No postinstall scripts that download binaries
- No dependencies that require native compilation unless absolutely necessary
- No duplicate packages serving the same purpose (pick one HTTP client, one test framework, etc.)
