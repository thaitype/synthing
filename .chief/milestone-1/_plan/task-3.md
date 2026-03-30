# Task 3: Create Shared Config Packages

## Objective
Create the three shared configuration packages: `@synthing/config-typescript`, `@synthing/config-eslint`, and `@synthing/config-vitest`. Wire them into `packages/core`.

## Scope
- `configs/config-typescript/` — shared tsconfig base
- `configs/config-eslint/` — shared ESLint config
- `configs/config-vitest/` — shared Vitest config
- Update `packages/core` to consume these configs

### Excluded
- tools/mono (task 4)
- CI workflows (task 5)

## Rules and Contracts to Follow
- `.chief/_rules/_standard/monorepo-structure.md`
- `.chief/_rules/_standard/coding-standards.md`
- `.chief/milestone-1/_contract/contract.md`

## Steps

### config-typescript
1. Create `configs/config-typescript/package.json` (name: `@synthing/config-typescript`, private or published)
2. Create `configs/config-typescript/base.json` with the shared strict TypeScript settings (matching Kubricate's base.json: strict, isolatedModules, skipLibCheck, etc.)
3. Create `configs/config-typescript/dual.json` for dual ESM/CJS library packages (extends base.json; sets target: ESNext, module: nodenext, moduleResolution: nodenext, verbatimModuleSyntax: true, declaration: true, declarationMap: true, sourceMap: true, noEmit: false)
   - This is the config that `packages/core/tsconfig.json` will extend

### config-eslint
1. Create `configs/config-eslint/package.json` (name: `@synthing/config-eslint`)
2. Create `configs/config-eslint/index.js` (or `.mjs`) with a shared flat ESLint config
3. Include typescript-eslint and any standard rules

### config-vitest
1. Create `configs/config-vitest/package.json` (name: `@synthing/config-vitest`)
2. Create `configs/config-vitest/vitest.config.ts` (or export a base config)

### Wire into core
1. Update `packages/core/tsconfig.json` to extend `@synthing/config-typescript`
2. Add ESLint config in `packages/core/` (or root) referencing `@synthing/config-eslint`
3. Update vitest config in `packages/core/` to use `@synthing/config-vitest`

## Acceptance Criteria
- All three config packages have valid `package.json` files with `@synthing/` scope
- `packages/core/tsconfig.json` extends the shared TypeScript config
- ESLint is runnable from root or per-package and finds no errors
- Vitest runs via the shared config
- `pnpm check-types` passes in packages/core

## Verification
```bash
# Config packages exist
test -f configs/config-typescript/package.json
test -f configs/config-eslint/package.json
test -f configs/config-vitest/package.json
# Core references shared configs
grep -q "config-typescript" packages/core/tsconfig.json || grep -q "config-typescript" packages/core/package.json
# Lint passes
pnpm lint:check
# Types pass
pnpm check-types
```

## Deliverables
- `configs/config-typescript/` (package.json, base.json, dual.json)
- `configs/config-eslint/` (package.json, index.js or equivalent)
- `configs/config-vitest/` (package.json, vitest config)
- Updated `packages/core/tsconfig.json`
- ESLint config at root or per-package level
