# Task 9: Add maskValues config and restore maskingValue() utility

## Objective

Add a `maskValues?: boolean` config to `EnvConnectorConfig`, defaulting to `true`. Restore a `maskingValue()` utility (ported from kubricate) and log every value the connector handles through it by default — regardless of whether the key is a declared secret, since the connector has no visibility into `secret: true` (a `VariableManager`-level fact). `maskValues: false` opts into raw-value logs.

## Scope

### Included
- `packages/plugin-env/src/utils.ts` (new): `maskingValue(value: string, length = 4): string` — same behavior as kubricate's version (first `length` chars kept, rest replaced with `*`)
- `packages/plugin-env/src/env-connector.ts`: add `maskValues?: boolean` to `EnvConnectorConfig`, default `true` in constructor
- In `load()`, after resolving each value, log it via the connector's `logger` — masked through `maskingValue()` when `maskValues` is `true` (default), raw when `false`
- Tests: default masks the logged value; `maskValues: false` logs the raw value

### Excluded
- `BaseConnector` interface conversion (task-6)
- `SecretValue` / coercion removal (task-7) — by the time this task lands, `get()` already returns raw strings only, so masking only ever operates on strings
- `caseInsensitive` default (task-8)

## Rules & Contracts to Follow
- `.chief/_rules/_standard/coding-standards.md`
- `.chief/milestone-2/_goal/design-spec.md` Section 4.3 ("Logging")
- `.chief/milestone-2/_contract/base-connector-contract.md`

## Steps

1. Create `packages/plugin-env/src/utils.ts` with `maskingValue()`
2. Add `maskValues` field to `EnvConnectorConfig`, default `true`
3. Add a log line in `load()` after storing each value, masked or raw based on `maskValues`
4. Export `maskingValue` from `packages/plugin-env/src/index.ts` if useful to consumers (optional — confirm with reviewer if this should stay internal)
5. Write tests for both `maskValues: true` (default) and `maskValues: false`

## Acceptance Criteria

- Default (`maskValues` unset): logged value is masked (e.g. `"8080"` logs as `"8080"` unchanged if ≤4 chars, longer values show first 4 chars + `*`s per `maskingValue()`'s existing behavior)
- `maskValues: false`: logged value is the raw unmasked string
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

- `packages/plugin-env/src/utils.ts` (new)
- `packages/plugin-env/src/env-connector.ts` (updated)
- `packages/plugin-env/src/env-connector.test.ts` (updated)
- `packages/plugin-env/src/index.ts` (updated, if exporting `maskingValue`)
