# Milestone 1: Convert Single-Package Repo to Monorepo

## Summary

Convert the existing single-package `synthing` repository into a pnpm + Turborepo monorepo, following the Kubricate project's directory structure and tooling conventions.

## Context

The synthing project currently exists as a single-package TypeScript library using:
- bun as package manager and script runner
- Babel for CJS/ESM dual builds
- release-it for releases
- bun:test for testing

This milestone transforms it into a production-ready monorepo foundation.

## Target State

After this milestone:
1. The repo is a pnpm workspace monorepo with Turborepo orchestration
2. `packages/core` contains the existing library code, renamed to `@synthing/core`
3. Three shared config packages exist: `@synthing/config-typescript`, `@synthing/config-eslint`, `@synthing/config-vitest`
4. `tools/mono` contains the monorepo helper CLI using `@thaitype/mono-scripts`
5. Build system uses tsc + Babel (matching Kubricate pattern: tsc for ESM/DTS, Babel for CJS conversion and pure-call annotation)
6. Changesets replaces release-it for versioning
7. CI workflows are in place for test-and-build and release
8. Old tooling removed: release-it, bun scripts, bun.lock (Babel is KEPT as part of the build pipeline)

## Reference

The Kubricate monorepo (https://github.com/ArcticGuild/kubricate) serves as the structural template. The synthing monorepo should mirror its directory layout, tooling choices, and configuration patterns.

## Decisions Made (from grilling session)

| # | Question | Decision |
|---|----------|----------|
| Q1 | Package manager | pnpm |
| Q2 | Monorepo orchestrator | Turborepo |
| Q3 | Mono CLI tool | Yes, replicate Kubricate's `mono` pattern using `@thaitype/mono-scripts` |
| Q4 | Shared config packages | All three from start: config-typescript, config-eslint, config-vitest |
| Q5 | Package scope | `@synthing` |
| Q6 | Build/release tooling | Keep tsc + Babel build (Kubricate pattern), replace release-it with changesets |
| Q7 | Acceptance criteria | Approved as-is (see contract) |

## Acceptance Criteria

1. Monorepo structure matches Kubricate layout (packages/core, configs/*, tools/mono, root config files)
2. Old tooling removed (release-it, bun scripts, bun.lock); Babel is KEPT as part of the build pipeline
3. `pnpm build` succeeds (exit 0)
4. `pnpm lint:check` succeeds (exit 0)
5. `pnpm check-types` succeeds (exit 0)
6. `pnpm test` succeeds (at least one Hello World test)
7. CI workflows exist: `.github/workflows/test-and-build.yml`, `.github/workflows/release.yml`
8. `pnpm install` works from clean state
