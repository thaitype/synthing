# Task 1: Scaffold New Packages

## Objective

Create the three new packages required by milestone-2: `synthing` (unscoped CLI+engine), `@synthing/toolkit`, and `@synthing/plugin-env`. Each must follow the monorepo conventions established in milestone-1.

## Scope

### Included
- Create `packages/synthing/` with `package.json`, `tsconfig.json`, `src/index.ts`
- Create `packages/toolkit/` with `package.json`, `tsconfig.json`, `src/index.ts`
- Create `packages/plugin-env/` with `package.json`, `tsconfig.json`, `src/index.ts`
- Internal directory structure for `packages/synthing/src/`: `cli/` and `engine/` directories
- Update `pnpm-workspace.yaml` if needed
- Wire up build scripts (mono build pattern from milestone-1)
- Set correct dependency graph:
  - `@synthing/core`: no internal deps
  - `@synthing/toolkit`: no internal deps
  - `@synthing/plugin-env`: peer dep on `@synthing/core`
  - `synthing`: depends on `@synthing/core`, `@synthing/toolkit`

### Excluded
- Implementing any logic (just placeholder exports)
- CLI argument parsing
- Tests beyond a smoke test

## Rules & Contracts to Follow
- `.chief/_rules/_standard/coding-standards.md` (package scope, build tooling, pnpm)
- `.chief/_rules/_standard/monorepo-structure.md` (directory layout, package conventions)
- `.chief/milestone-2/_goal/design-spec.md` Section 1 (package architecture)

## Steps

1. Create `packages/toolkit/` mirroring `packages/core/` structure (package.json, tsconfig.json, src/index.ts)
2. Create `packages/plugin-env/` with peer dep on `@synthing/core`
3. Create `packages/synthing/` with deps on `@synthing/core` and `@synthing/toolkit`, internal `src/cli/` and `src/engine/` dirs
4. Ensure the unscoped `synthing` package has `"name": "synthing"` (not `@synthing/synthing`)
5. Add `"bin"` field to `synthing` package.json for CLI entry point
6. Verify `pnpm install` succeeds
7. Verify `pnpm build` succeeds (all packages produce dist/)

## Acceptance Criteria

- All four packages exist and have valid `package.json` with correct names and dependencies
- `packages/synthing/src/cli/` and `packages/synthing/src/engine/` directories exist
- `pnpm install` exits 0
- `pnpm build` exits 0
- `pnpm check-types` exits 0

## Verification

```bash
pnpm install
pnpm build
pnpm check-types
```

## Deliverables

- `packages/toolkit/package.json`
- `packages/toolkit/tsconfig.json`
- `packages/toolkit/src/index.ts`
- `packages/plugin-env/package.json`
- `packages/plugin-env/tsconfig.json`
- `packages/plugin-env/src/index.ts`
- `packages/synthing/package.json`
- `packages/synthing/tsconfig.json`
- `packages/synthing/src/index.ts`
- `packages/synthing/src/cli/index.ts`
- `packages/synthing/src/engine/index.ts`
