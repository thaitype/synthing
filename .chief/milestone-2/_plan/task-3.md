# Task 3: Implement @synthing/toolkit Coercion Utilities

## Objective

Implement the `coerceFromString()` function in `@synthing/toolkit`. This is a pure utility package with zero dependencies.

## Scope

### Included
- `coerceFromString(value: string, targetType: "string"): string`
- `coerceFromString(value: string, targetType: "number"): number`
- `coerceFromString(value: string, targetType: "boolean"): boolean`
- `coerceFromString(value: string, targetType: "object"): object | unknown[]`
- Proper error handling for each type
- Unit tests covering all types and edge cases

### Excluded
- Standard Schema validation (handled by engine, not toolkit)
- Any dependencies on other @synthing packages

## Rules & Contracts to Follow
- `.chief/_rules/_standard/coding-standards.md`
- `.chief/milestone-2/_goal/design-spec.md` Sections 2.6, 10

## Steps

1. Create `packages/toolkit/src/coerce.ts` with `coerceFromString()` function
2. Implement overloaded signatures for each target type
3. Number coercion: use `Number()` (strict), error if `NaN`
4. Boolean coercion: `"true"/"1"` -> `true`, `"false"/"0"` -> `false`, error otherwise
5. Object coercion: `JSON.parse()`, reject if result is primitive
6. String coercion: identity
7. Export from `packages/toolkit/src/index.ts`
8. Write comprehensive unit tests

## Acceptance Criteria

- `coerceFromString("42", "number")` returns `42`
- `coerceFromString("123abc", "number")` throws error (Number() returns NaN)
- `coerceFromString("true", "boolean")` returns `true`
- `coerceFromString("1", "boolean")` returns `true`
- `coerceFromString("false", "boolean")` returns `false`
- `coerceFromString("0", "boolean")` returns `false`
- `coerceFromString("yes", "boolean")` throws error
- `coerceFromString('{"a":1}', "object")` returns `{a: 1}`
- `coerceFromString('[1,2]', "object")` returns `[1, 2]`
- `coerceFromString('"hello"', "object")` throws error (primitive)
- `coerceFromString("hello", "string")` returns `"hello"`
- `pnpm build` exits 0
- `pnpm test` exits 0 with all coercion tests passing

## Verification

```bash
pnpm build
pnpm check-types
pnpm test --filter @synthing/toolkit
```

## Deliverables

- `packages/toolkit/src/coerce.ts`
- `packages/toolkit/src/index.ts` (updated)
- `packages/toolkit/src/coerce.test.ts`
