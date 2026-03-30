# Milestone 1 Contract

## Scope Boundaries

### In Scope
- Root workspace configuration (pnpm-workspace.yaml, turbo.json, root package.json)
- Moving existing source code to `packages/core/`
- Renaming the package from `synthing` to `@synthing/core`
- Creating shared config packages (config-typescript, config-eslint, config-vitest)
- Creating `tools/mono` with `@thaitype/mono-scripts`
- Setting up tsc + Babel builds for packages/core (matching Kubricate pattern)
- Setting up changesets
- Creating CI workflow files
- Removing old tooling: release-it, bun.lock, scripts/remove-type-key.ts (Babel is KEPT -- it is part of the Kubricate build pattern)
- Updating .gitignore for monorepo patterns

### Out of Scope
- Implementing any new secret-management features
- Publishing packages to npm
- Writing extensive documentation beyond basic READMEs
- Setting up deployment pipelines
- Adding packages beyond core (that is milestone-2+)

## Constraints
- Must use pnpm (not npm, yarn, or bun)
- Must use Turborepo (not Nx, Lerna, or others)
- Must use `@synthing/` package scope
- Must use tsc + Babel for building (Kubricate pattern: tsc for ESM/DTS, Babel for CJS conversion and pure-call annotation). NO tsup.
- Must use changesets for release management
- Must use vitest for testing (not bun:test, jest, or others)
- Must follow Kubricate directory structure conventions

## Quality Gates
All commands from `.chief/_rules/_verification/acceptance-checks.md` must pass.

## Existing Code to Preserve
- `src/calculator.ts` — move to `packages/core/src/calculator.ts`
- `src/index.ts` — move to `packages/core/src/index.ts`
- `src/internal/utils.ts` — move to `packages/core/src/internal/utils.ts`
- Test coverage: at minimum, the existing calculator test must be ported to vitest

## Files to Remove
- `bun.lock`
- `.release-it.json`
- `scripts/remove-type-key.ts` (and `scripts/` directory if empty)
- release-it devDependency from package.json
- `@types/bun` devDependency
- NOTE: Babel deps are KEPT (they are used in the tsc+Babel build pipeline via tools/mono)
