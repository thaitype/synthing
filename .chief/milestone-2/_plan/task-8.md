# Task 8: Default caseInsensitive to true

## Objective

Change `EnvConnectorConfig.caseInsensitive` default from `false` to `true`. This resolves the mismatch between the design-spec's CLI examples (which use uppercase env vars like `APP_PORT`) and the connector's exact-case-key lookup (`prefix + key`, e.g. `APP_port` for key `port`) — with case-insensitive matching on by default, both forms resolve to the same variable without any doc or code disagreement.

## Scope

### Included
- `packages/plugin-env/src/env-connector.ts`: change `this.caseInsensitive = config.caseInsensitive ?? false` to `?? true`
- Add a test confirming default (no explicit `caseInsensitive` flag) matches an uppercase env var against a lowercase-declared key
- Confirm existing exact-case tests still pass (case-insensitive matching is a superset of exact-case matching)

### Excluded
- `BaseConnector` interface conversion (task-6)
- `SecretValue` / coercion removal (task-7)
- `maskValues` logging (task-9)

## Rules & Contracts to Follow
- `.chief/_rules/_standard/coding-standards.md`
- `.chief/milestone-2/_goal/design-spec.md` Section 4.3 ("Env var name matching")
- `.chief/milestone-2/_contract/base-connector-contract.md`

## Steps

1. Change the default in the `EnvConnector` constructor
2. Add test: `new EnvConnector({ prefix: "APP_" })` (no `caseInsensitive` specified), `process.env.APP_PORT = "8080"`, `load(["port"])`, `get("port")` returns `"8080"`
3. Re-run the full `env-connector.test.ts` suite to confirm no existing test relied on strict-by-default behavior

## Acceptance Criteria

- `new EnvConnector({ prefix: "APP_" })` with `process.env.APP_PORT` set matches key `port` without `caseInsensitive: true` being passed explicitly
- Existing exact-case tests (e.g. `APP_port` matching key `port`) still pass unchanged
- `pnpm test` exits 0

## Verification

```bash
pnpm test --filter @synthing/plugin-env
```

## Deliverables

- `packages/plugin-env/src/env-connector.ts` (updated)
- `packages/plugin-env/src/env-connector.test.ts` (updated)
