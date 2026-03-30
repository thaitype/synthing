# Monorepo Structure Standard

The synthing monorepo follows the Kubricate directory layout convention.

## Directory Layout

```
synthing/
  packages/           # Published library packages
    core/             # @synthing/core — the main library
  configs/            # Shared configuration packages
    config-typescript/ # @synthing/config-typescript
    config-eslint/     # @synthing/config-eslint
    config-vitest/     # @synthing/config-vitest
  tools/              # Internal tooling
    mono/             # @synthing/mono — monorepo helper CLI (uses @thaitype/mono-scripts)
  .github/
    workflows/
      test-and-build.yml
      release.yml
```

## Root Files
- `pnpm-workspace.yaml` — defines workspace packages
- `turbo.json` — Turborepo pipeline configuration
- `package.json` — root workspace package (private, no publish)
- `tsconfig.json` — root TypeScript config (references)
- `.changeset/config.json` — changeset configuration

## Package Conventions
- Each package has its own `package.json`, `tsconfig.json`, and `README.md`
- Each package builds independently via `mono build` (tsc for ESM + declarations, Babel for CJS conversion and pure-call annotation)
- Each package's `package.json` uses `@synthing/` scope
- Config packages are consumed as devDependencies by other packages
