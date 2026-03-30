# Verification Commands

All of the following must pass for a milestone to be considered complete.

## Build
```bash
pnpm build
```
Must exit 0. All packages must produce output in their respective dist/ directories.

## Type Check
```bash
pnpm check-types
```
Must exit 0 with no TypeScript errors.

## Lint
```bash
pnpm lint:check
```
Must exit 0 with no lint errors.

## Test
```bash
pnpm test
```
Must exit 0. At least one meaningful test must exist.

## Clean Install
```bash
rm -rf node_modules packages/*/node_modules configs/*/node_modules tools/*/node_modules
pnpm install
```
Must exit 0 from a clean state.

## CI Workflows
- `.github/workflows/test-and-build.yml` must exist and be valid YAML
- `.github/workflows/release.yml` must exist and be valid YAML
