# Task 6: Convert BaseConnector from abstract class to interface

## Objective

Convert `BaseConnector` in `@synthing/core` from an `abstract class` to a TypeScript `interface`, and add `config`, `logger`, `setWorkingDir?`, `getWorkingDir?` as part of the contract. Update `EnvConnector` to `implements` the interface instead of `extends` the class.

## Scope

### Included
- `packages/core/src/connector.ts`: replace `abstract class BaseConnector` with `interface BaseConnector<Config extends object = object>`
- Add `config: Config`, `logger?: Logger`, `setWorkingDir?(dir: string | undefined): void`, `getWorkingDir?(): string | undefined` to the interface
- `packages/plugin-env/src/env-connector.ts`: change `class EnvConnector extends BaseConnector` to `class EnvConnector implements BaseConnector<EnvConnectorConfig>`
- Remove `super()` call and `override` keyword from `EnvConnector` (no longer meaningful against an interface)

### Excluded
- `SecretValue` / `tryParseSecretValue()` removal (task-7)
- `caseInsensitive` default change (task-8)
- `maskValues` / logging changes (task-9)

## Rules & Contracts to Follow
- `.chief/_rules/_standard/coding-standards.md`
- `.chief/milestone-2/_goal/design-spec.md` Sections 4.1, 4.2
- `.chief/milestone-2/_contract/base-connector-contract.md`

## Steps

1. Edit `packages/core/src/connector.ts`: interface definition per the contract doc
2. Edit `packages/plugin-env/src/env-connector.ts`: `implements` instead of `extends`, drop `super()`/`override`
3. Run `pnpm check-types` and fix any fallout
4. Run `pnpm test` to confirm no behavioral regressions

## Acceptance Criteria

- `BaseConnector` is declared as an `interface`, not a `class`, in `@synthing/core`
- `EnvConnector implements BaseConnector<EnvConnectorConfig>`
- `pnpm build` exits 0
- `pnpm check-types` exits 0
- `pnpm test` exits 0

## Verification

```bash
pnpm build
pnpm check-types
pnpm test --filter @synthing/core --filter @synthing/plugin-env
```

## Deliverables

- `packages/core/src/connector.ts` (updated)
- `packages/plugin-env/src/env-connector.ts` (updated)
