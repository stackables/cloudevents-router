# AGENTS.md

## Dead code

`pnpm knip` and `pnpm knip --production` both fail CI (the `coverage.yml` workflow runs them on every PR). Run both before you push.

- The production run leaves out tests and devDependencies, so code that only a test calls counts as dead there: delete it, or move it into the test.
- Fix what knip finds: delete the dead code and the unused dependencies. Do not ignore them. An `ignore`, `ignoreIssues` or `ignoreDependencies` entry in `knip.ts` needs a comment that says why.
- `includeEntryExports` stays off: this is a published package, and the entry's exports are used by code knip cannot see.
