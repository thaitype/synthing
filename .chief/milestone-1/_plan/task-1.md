# Task 1: Scaffold Monorepo Root

## Objective
Set up the root-level monorepo infrastructure: pnpm workspace, Turborepo config, root package.json, and changesets.

## Scope
- Root `package.json` (private workspace root, not publishable)
- `pnpm-workspace.yaml`
- `turbo.json`
- `.changeset/config.json`
- `.npmrc` (if needed for pnpm settings)
- Remove old files: `bun.lock`, `.release-it.json`, `scripts/` directory
- Update `.gitignore` for monorepo patterns

### Excluded
- Individual package creation (tasks 2-4)
- CI workflows (task 5)

## Rules and Contracts to Follow
- `.chief/_rules/_standard/monorepo-structure.md`
- `.chief/_rules/_standard/coding-standards.md`
- `.chief/milestone-1/_contract/contract.md`

## Steps
1. Rewrite root `package.json` as a private workspace root with monorepo scripts (build, test, lint:check, check-types, format)
2. Create `pnpm-workspace.yaml` with workspace globs: `packages/*`, `configs/*`, `tools/*`
3. Create `turbo.json` with pipelines for build, test, lint:check, check-types
4. Create `.changeset/config.json` with standard configuration for the `@synthing` scope
5. Delete `bun.lock`, `.release-it.json`, `scripts/remove-type-key.ts`, and the `scripts/` directory
6. Update `.gitignore` to include monorepo-relevant ignores (turbo cache, changeset temp files)

## Acceptance Criteria
- `pnpm-workspace.yaml` exists and references correct workspace globs
- `turbo.json` exists with valid pipeline definitions
- Root `package.json` is `"private": true` with workspace scripts
- `.changeset/config.json` exists with valid config
- `bun.lock`, `.release-it.json`, `scripts/` are gone
- No Babel or release-it references remain in root package.json

## Verification
```bash
# Files exist
test -f pnpm-workspace.yaml && test -f turbo.json && test -f .changeset/config.json
# Old files removed
test ! -f bun.lock && test ! -f .release-it.json && test ! -d scripts
# Root package.json is private
node -e "const p = require('./package.json'); process.exit(p.private ? 0 : 1)"
```

## Deliverables
- `package.json` (rewritten)
- `pnpm-workspace.yaml`
- `turbo.json`
- `.changeset/config.json`
- `.gitignore` (updated)
- Deleted: `bun.lock`, `.release-it.json`, `scripts/`
