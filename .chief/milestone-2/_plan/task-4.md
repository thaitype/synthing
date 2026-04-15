# Task 4: Implement VariableManager with $var and $spread

## Objective

Implement the `VariableManager` class in the `synthing` package's `engine/` directory. This is the central variable declaration and reference system.

## Scope

### Included
- `VariableManager` class with builder pattern using generic accumulation
- `.addVariable(key, schema)` — registers variable with type, default, secret flag, optional Standard Schema
- `.addConnector(name, connector)` — registers a BaseConnector in priority order
- `.createRef()` — returns `{ $var, $spread }` bound to this manager
- `$var(key)` / `$var(key, { default })` — returns `VariableRef<T>` (branded string `"$${{key}}"`)
- `$spread(key)` — returns `{ key: "__synthing_spread", value: "$${{...key}}" }`, compile-time restricted to `type: "object"` keys
- `.toJSON()` — serializes variable metadata (keys, types, defaults, descriptions, secret flag)
- Key validation: regex `^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$`, fail fast at `.addVariable()` time
- Call-site default registration and duplicate detection (throw on duplicate)
- Secret redaction in `toJSON()` output
- Unit tests for all features

### Excluded
- Resolution logic (task-6)
- Standard Schema validation execution (task-6)
- CLI integration
- GeneratorContext

## Rules & Contracts to Follow
- `.chief/_rules/_standard/coding-standards.md`
- `.chief/milestone-2/_goal/design-spec.md` Sections 2.1-2.4, 2.7-2.10, 3.1-3.3

## Steps

1. Create `packages/synthing/src/engine/variable-manager.ts`
2. Implement the generic accumulation pattern for type-safe builder
3. Implement `$var()` returning `VariableRef<T>` (branded string)
4. Implement `$spread()` with compile-time type restriction to object keys
5. Implement key validation with regex
6. Implement `.toJSON()` with secret redaction
7. Implement call-site default registration with duplicate detection
8. Export from `packages/synthing/src/engine/index.ts` and `packages/synthing/src/index.ts`
9. Write unit tests

## Acceptance Criteria

- `VariableManager` builder pattern chains correctly with type inference
- `$var("key")` returns string at runtime containing `"$${{key}}"`
- `$var("key")` has correct compile-time type `VariableRef<T>` matching declared type
- `$spread("key")` returns `{ key: "__synthing_spread", value: "$${{...key}}" }`
- `$spread` only accepts keys declared with `type: "object"` (compile error otherwise)
- Invalid key names throw at `.addVariable()` time
- `.toJSON()` redacts values for `secret: true` variables
- Duplicate call-site defaults throw error
- `pnpm build` exits 0
- `pnpm check-types` exits 0
- `pnpm test` exits 0

## Verification

```bash
pnpm build
pnpm check-types
pnpm test --filter synthing
```

## Deliverables

- `packages/synthing/src/engine/variable-manager.ts`
- `packages/synthing/src/engine/variable-manager.test.ts`
- `packages/synthing/src/engine/index.ts` (updated)
- `packages/synthing/src/index.ts` (updated)
