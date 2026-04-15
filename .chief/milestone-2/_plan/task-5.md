# Task 5: Implement EnvConnector in @synthing/plugin-env

## Objective

Implement the `EnvConnector` class in `@synthing/plugin-env`. This is a domain-agnostic connector that reads values from `process.env`.

## Scope

### Included
- `EnvConnector` class extending `BaseConnector` from `@synthing/core`
- Constructor accepting `{ prefix?: string }` options
- `load(keys: string[])` — reads `process.env` for the given keys (with optional prefix)
- `get(key: string)` — returns the raw string value or `undefined`
- Key mapping: variable key `"port"` with prefix `"APP_"` reads `process.env.APP_PORT` (uppercase)
- Unit tests covering: prefix handling, missing values, key mapping

### Excluded
- Type coercion (handled by engine using @synthing/toolkit)
- Secret handling (handled by VariableManager)

## Rules & Contracts to Follow
- `.chief/_rules/_standard/coding-standards.md`
- `.chief/milestone-2/_goal/design-spec.md` Section 4.3

## Steps

1. Create `packages/plugin-env/src/env-connector.ts`
2. Implement `EnvConnector` extending `BaseConnector`
3. Key mapping: convert variable key to uppercase, prepend prefix
4. `load()`: batch-read from `process.env` for the given keys, store internally
5. `get()`: return stored value or `undefined`
6. Export from `packages/plugin-env/src/index.ts`
7. Write unit tests (mock `process.env`)

## Acceptance Criteria

- `new EnvConnector({ prefix: "APP_" })` with `process.env.APP_PORT = "8080"`:
  - After `load(["port"])`, `get("port")` returns `"8080"`
- Without prefix: reads `process.env.PORT` for key `"port"`
- Missing env var: `get("missing")` returns `undefined`
- `pnpm build` exits 0
- `pnpm check-types` exits 0
- `pnpm test` exits 0

## Verification

```bash
pnpm build
pnpm check-types
pnpm test --filter @synthing/plugin-env
```

## Deliverables

- `packages/plugin-env/src/env-connector.ts`
- `packages/plugin-env/src/env-connector.test.ts`
- `packages/plugin-env/src/index.ts` (updated)
