# Task 4: Create tools/mono Package and Wire Root Scripts

## Objective
Create the `tools/mono` helper CLI package (using `@thaitype/mono-scripts`) and ensure all root-level pnpm scripts are wired up correctly through Turborepo.

## Scope
- `tools/mono/` package using `@thaitype/mono-scripts`
- Root `package.json` scripts finalized and working
- Turborepo pipeline verified end-to-end

### Excluded
- CI workflows (task 5)

## Rules and Contracts to Follow
- `.chief/_rules/_standard/monorepo-structure.md`
- `.chief/_rules/_standard/coding-standards.md`
- `.chief/milestone-1/_contract/contract.md`

## Steps
1. Create `tools/mono/package.json` with name `@synthing/mono`, depending on `@thaitype/mono-scripts`
   - Must include peerDependencies on Babel packages: `@babel/cli`, `@babel/core`, `@babel/plugin-transform-export-namespace-from`, `@babel/plugin-transform-modules-commonjs`, `babel-plugin-annotate-pure-calls`
   - Build script: `tsc` (mono itself is built with tsc, not the mono-scripts pipeline)
2. Create `tools/mono/src/cli.ts` that defines the MonoScripts config (matching Kubricate pattern):
   - `build`: runs `build-esm`, `build-cjs`, `build-annotate` in sequence
   - `build-esm`: `tsc`
   - `build-cjs`: `babel dist/esm --plugins @babel/transform-export-namespace-from --plugins @babel/transform-modules-commonjs --out-dir dist/cjs --source-maps`
   - `build-annotate`: `babel dist --plugins annotate-pure-calls --out-dir dist --source-maps`
   - Plus lint, test, dev, check-types scripts
3. Ensure root scripts delegate to Turborepo where appropriate:
   - `pnpm build` -> `turbo run build`
   - `pnpm test` -> `turbo run test`
   - `pnpm lint:check` -> `turbo run lint:check`
   - `pnpm check-types` -> `turbo run check-types`
   - `pnpm format` -> prettier or turbo
4. Verify each root script runs successfully end-to-end

## Acceptance Criteria
- `tools/mono/package.json` exists with name `@synthing/mono`
- `@thaitype/mono-scripts` is a dependency of tools/mono
- All root scripts (`build`, `test`, `lint:check`, `check-types`) execute via turbo and complete successfully
- `pnpm build` builds all packages
- `pnpm test` runs all tests

## Verification
```bash
# tools/mono exists
test -f tools/mono/package.json
node -e "const p = require('./tools/mono/package.json'); process.exit(p.name === '@synthing/mono' ? 0 : 1)"
# Full pipeline
pnpm build
pnpm test
pnpm lint:check
pnpm check-types
```

## Deliverables
- `tools/mono/package.json`
- `tools/mono/src/` (entry point)
- Root `package.json` scripts finalized
- `turbo.json` pipeline verified
