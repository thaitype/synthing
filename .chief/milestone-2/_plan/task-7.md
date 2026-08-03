# Task 7: Remove SecretValue and tryParseSecretValue from EnvConnector

## Objective

Remove the `SecretValue` type and `tryParseSecretValue()` method from `EnvConnector`. The connector must return raw `process.env` string values only — no JSON-sniffing, no coercion. This closes the coercion-boundary gap: `tryParseSecretValue()` could hand the engine an already-parsed object where `coerceFromString()` expects a raw string, breaking exactly the `type: "object"` case it's meant to handle.

## Scope

### Included
- Delete `tryParseSecretValue()` method from `packages/plugin-env/src/env-connector.ts`
- Delete the `SecretValue` type definition and its export from `packages/plugin-env/src/index.ts`
- `get(key: string)` return type narrows to `string | undefined`
- `load()` stores the raw string directly (no `tryParseSecretValue()` call)
- Remove the `tryParseSecretValue()` describe block from `env-connector.test.ts`; remove any test asserting object-parsing behavior

### Excluded
- `BaseConnector` interface conversion (task-6, should land first)
- `caseInsensitive` / `maskValues` changes (tasks 8, 9)

## Rules & Contracts to Follow
- `.chief/_rules/_standard/coding-standards.md`
- `.chief/milestone-2/_goal/design-spec.md` Section 2.6, Section 4.3 ("Coercion boundary")
- `.chief/milestone-2/_contract/base-connector-contract.md`

## Steps

1. Remove `tryParseSecretValue()` from `env-connector.ts`
2. Remove `SecretValue` type and its export from `index.ts`
3. Update `get()` signature and `this.secrets` map type to `Map<string, string>`
4. Update `load()` to store `process.env[matchKey]` directly, no parsing
5. Remove/update affected tests in `env-connector.test.ts`
6. Confirm no other package imports `SecretValue` from `@synthing/plugin-env`

## Acceptance Criteria

- No `SecretValue` type or export anywhere in `@synthing/plugin-env`
- No `tryParseSecretValue` method anywhere in the codebase
- `EnvConnector.get()` is typed `string | undefined`
- A flat-JSON-looking env var value (e.g. `'{"a":1}'`) is returned as the raw string `'{"a":1}'`, unparsed
- `pnpm build` exits 0
- `pnpm check-types` exits 0
- `pnpm test` exits 0

## Verification

```bash
pnpm build
pnpm check-types
pnpm test --filter @synthing/plugin-env
grep -rn "SecretValue\|tryParseSecretValue" packages/ # should return nothing
```

## Deliverables

- `packages/plugin-env/src/env-connector.ts` (updated)
- `packages/plugin-env/src/index.ts` (updated)
- `packages/plugin-env/src/env-connector.test.ts` (updated)
