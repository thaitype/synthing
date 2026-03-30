# Milestone 1 Acceptance Report

Date: 2026-03-30

## Summary

All 8 acceptance criteria pass. Milestone 1 is complete.

## Acceptance Criteria Status

### 1. pnpm install (clean state)
**PASS**
- `pnpm install` exits 0 from a clean state
- Lockfile is up to date, all workspace packages resolved

### 2. pnpm build
**PASS**
- `turbo run build` exits 0
- @synthing/mono: tsc build succeeds
- @synthing/config-vitest: tsc build succeeds
- @synthing/core: mono build (ESM + CJS + annotate) succeeds
- Output present in `packages/core/dist/` (esm, cjs, dts directories)

### 3. pnpm check-types
**PASS**
- `turbo run check-types` exits 0
- @synthing/mono: tsc --noEmit passes
- @synthing/core: tsc --noEmit passes
- No TypeScript errors across any package

### 4. pnpm lint:check
**PASS**
- `turbo run lint:check` exits 0
- @synthing/mono: eslint ./src passes
- @synthing/core: eslint src --max-warnings 0 passes
- No lint errors or warnings

### 5. pnpm test
**PASS**
- `turbo run test` exits 0
- @synthing/core: 1 test file, 1 test (calculator) passes
- At least one meaningful test exists

### 6. .github/workflows/test-and-build.yml exists and is valid YAML
**PASS**
- File created at `.github/workflows/test-and-build.yml`
- Triggers on push to main and pull_request to main
- Steps: checkout, setup pnpm, setup node, install, build, check-types, lint, test
- YAML structure validated

### 7. .github/workflows/release.yml exists and is valid YAML
**PASS**
- File created at `.github/workflows/release.yml`
- Triggers on push to main and workflow_dispatch
- Uses changesets/action@v1 for automated release PR or publish
- YAML structure validated

### 8. Monorepo structure is complete and consistent
**PASS**
- packages/core: publishable package with full build pipeline
- configs/config-eslint, config-typescript, config-vitest: shared configs
- tools/mono: internal build CLI
- Turborepo pipeline orchestrates all tasks
- Changesets configured for versioning and publishing
- All workspace packages wired via pnpm workspaces

## Files Delivered (Task 5)

- `.github/workflows/test-and-build.yml`
- `.github/workflows/release.yml`
- `.chief/milestone-1/_report/acceptance-report.md`
