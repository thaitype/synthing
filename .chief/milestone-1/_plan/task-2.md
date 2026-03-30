# Task 2: Move Existing Code to packages/core with tsc + Babel Build

## Objective
Create the `packages/core` package by moving existing source code there and configuring the tsc + Babel dual-build pipeline (matching Kubricate's pattern).

## Scope
- Create `packages/core/` directory structure
- Move `src/` contents to `packages/core/src/`
- Create `packages/core/package.json` as `@synthing/core`
- Create `packages/core/tsconfig.json` referencing shared config (or standalone initially)
- Port the existing bun:test to vitest
- Remove old root `src/`, `tsconfig.json`, `tsconfig.build.json`

### Excluded
- `tsup.config.ts` -- NOT USED. Kubricate uses tsc + Babel, not tsup.
- Shared config packages (task 3, but this task may use placeholder tsconfigs until task 3 is done)
- Root script wiring (task 4)
- The `tools/mono` build orchestration (task 4) -- for now, build scripts can call tsc/babel directly

## Rules and Contracts to Follow
- `.chief/_rules/_standard/monorepo-structure.md`
- `.chief/_rules/_standard/coding-standards.md`
- `.chief/milestone-1/_contract/contract.md` (see "Existing Code to Preserve")

## Build Pipeline Reference (from Kubricate)

The Kubricate build is a 3-step process orchestrated by `tools/mono`:

1. **build-esm**: `tsc` -- compiles TypeScript to ESM in `dist/esm/`
2. **build-cjs**: `babel dist/esm --plugins @babel/transform-export-namespace-from --plugins @babel/transform-modules-commonjs --out-dir dist/cjs --source-maps` -- converts ESM to CJS
3. **build-annotate**: `babel dist --plugins annotate-pure-calls --out-dir dist --source-maps` -- annotates pure calls for tree-shaking

### Output structure:
```
dist/
  esm/    # ESM output (from tsc)
  cjs/    # CJS output (from Babel)
  dts/    # Type declarations (from tsc)
```

### Package.json exports pattern (from Kubricate packages/core):
```json
{
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/dts/index.d.ts",
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "types": "./dist/dts/index.d.ts",
      "import": "./dist/esm/index.js",
      "default": "./dist/cjs/index.js"
    }
  }
}
```

### tsconfig.json pattern (from Kubricate packages/core):
```json
{
  "extends": "@synthing/config-typescript/dual.json",
  "compilerOptions": {
    "outDir": "dist/esm",
    "declarationDir": "dist/dts"
  },
  "exclude": ["node_modules", "*.config.ts", "dist"]
}
```

Note: Until task 3 creates the shared config, use an inline tsconfig with equivalent settings:
- target: ESNext, module: nodenext, moduleResolution: nodenext
- verbatimModuleSyntax: true
- declaration: true, declarationMap: true, sourceMap: true, noEmit: false
- strict: true

## Steps
1. Create `packages/core/` directory
2. Move `src/index.ts`, `src/calculator.ts`, `src/internal/utils.ts` to `packages/core/src/`
3. Create `packages/core/package.json` with:
   - name: `@synthing/core`
   - `"type": "module"`
   - main/module/types/exports pointing to dist/esm, dist/cjs, dist/dts (see pattern above)
   - Babel deps as peerDependencies (or devDependencies): `@babel/cli`, `@babel/core`, `@babel/plugin-transform-export-namespace-from`, `@babel/plugin-transform-modules-commonjs`, `babel-plugin-annotate-pure-calls`
   - typescript as devDependency
   - build script: `mono build` (or direct tsc/babel commands until tools/mono exists)
4. Create `packages/core/tsconfig.json` (inline for now, will be switched to extend shared config in task 3)
5. Rewrite `src/calculator.test.ts` to use vitest imports instead of `bun:test`, place in `packages/core/src/`
6. Remove old root-level `src/`, `tsconfig.json`, `tsconfig.build.json`

## Acceptance Criteria
- `packages/core/src/index.ts` exists with the original exports
- `packages/core/src/calculator.ts` exists with the `add` function
- `packages/core/src/internal/utils.ts` exists
- `packages/core/src/calculator.test.ts` uses vitest and passes
- `packages/core/package.json` has name `@synthing/core`
- NO `tsup.config.ts` exists anywhere
- `packages/core/tsconfig.json` outputs to `dist/esm` with declarations to `dist/dts`
- Build produces `dist/esm/`, `dist/cjs/`, `dist/dts/` directories
- Old root `src/` directory is removed
- Old root `tsconfig.build.json` is removed

## Verification
```bash
# Package exists
test -f packages/core/package.json
node -e "const p = require('./packages/core/package.json'); process.exit(p.name === '@synthing/core' ? 0 : 1)"
# Source files exist
test -f packages/core/src/index.ts
test -f packages/core/src/calculator.ts
test -f packages/core/src/internal/utils.ts
test -f packages/core/src/calculator.test.ts
# NO tsup config
test ! -f packages/core/tsup.config.ts
# Old files removed
test ! -d src
test ! -f tsconfig.build.json
# Build works (after pnpm install)
cd packages/core && pnpm build
# Verify output directories
test -d packages/core/dist/esm
test -d packages/core/dist/cjs
test -d packages/core/dist/dts
# Test works
cd packages/core && pnpm test
```

## Deliverables
- `packages/core/package.json`
- `packages/core/tsconfig.json`
- `packages/core/src/index.ts`
- `packages/core/src/calculator.ts`
- `packages/core/src/calculator.test.ts`
- `packages/core/src/internal/utils.ts`
- Deleted: root `src/`, `tsconfig.build.json`
- NO `tsup.config.ts` anywhere
