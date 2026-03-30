# Coding Standards

## Language and Runtime
- TypeScript (strict mode) for all source code
- Node.js as the target runtime (ESM first, CJS compat via Babel transform)
- pnpm as the package manager (no npm, no yarn, no bun)

## Package Scope
- All packages use `@synthing/` scope
- Internal tooling packages use `@synthing/` scope as well

## Build Tooling
- tsc (TypeScript compiler) for ESM output and declaration files
- Babel for CJS conversion (transform ESM -> CJS) and pure-call annotation
- The `tools/mono` CLI (via `@thaitype/mono-scripts`) orchestrates the 3-step build: tsc -> babel CJS -> babel annotate
- Turborepo for monorepo orchestration
- Vitest for testing
- ESLint for linting
- Prettier for formatting
- NO tsup -- the build uses tsc + Babel, matching the Kubricate pattern

## Commit and Release
- Changesets for versioning and changelog generation
- No release-it, no bun scripts

## Code Style
- Follow existing TypeScript strict configuration
- Prefer explicit exports over wildcard re-exports where practical
- Keep package boundaries clean: no circular dependencies between packages
