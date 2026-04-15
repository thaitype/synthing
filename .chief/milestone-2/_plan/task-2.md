# Task 2: Implement @synthing/core Interfaces

## Objective

Implement all abstract classes, interfaces, and error types in `@synthing/core`. This package is interfaces + types only with minimal surface area. Remove the existing calculator placeholder code.

## Scope

### Included
- `BaseConnector` abstract class with `load(keys: string[]): Promise<void>` and `get(key: string): unknown | undefined`
- `BaseGenerator` abstract class with `format: string`, `render(ctx: GeneratorContext): Promise<GeneratorOutput>`, `serialize(content: unknown): SerializedOutput[]`
- `GeneratorOutput` type (`content: unknown`)
- `SerializedOutput` type (`filename: string`, `content: string`)
- `GeneratorContext` interface (`outputDir: string`, `logger: Logger`)
- `Logger` interface (minimal: `info`, `warn`, `error`)
- `ResolutionError` class extending `Error`
- `VariableRef<T>` branded string type
- Shared type definitions (variable types, variable schema options)
- Export all public types from `src/index.ts`
- Remove `calculator.ts`, `calculator.test.ts`, and related internal code

### Excluded
- Any implementation logic (this is interfaces only)
- VariableManager (lives in `synthing` package)
- EnvConnector (lives in `@synthing/plugin-env`)

## Rules & Contracts to Follow
- `.chief/_rules/_standard/coding-standards.md`
- `.chief/milestone-2/_goal/design-spec.md` Sections 2.1, 2.9, 4.1-4.2, 5.1-5.2

## Steps

1. Remove `calculator.ts`, `calculator.test.ts`, and `internal/utils.ts` from `packages/core/src/`
2. Create `src/connector.ts` with `BaseConnector` abstract class
3. Create `src/generator.ts` with `BaseGenerator`, `GeneratorOutput`, `SerializedOutput`
4. Create `src/context.ts` with `GeneratorContext`, `Logger` interfaces
5. Create `src/errors.ts` with `ResolutionError` class
6. Create `src/types.ts` with `VariableRef<T>`, variable type definitions, variable schema options
7. Update `src/index.ts` to export all public API
8. Write unit tests for `ResolutionError`

## Acceptance Criteria

- `@synthing/core` exports: `BaseConnector`, `BaseGenerator`, `GeneratorContext`, `GeneratorOutput`, `SerializedOutput`, `ResolutionError`, `VariableRef`
- No calculator code remains
- `pnpm build` exits 0
- `pnpm check-types` exits 0
- `pnpm test` exits 0

## Verification

```bash
pnpm build
pnpm check-types
pnpm test
```

## Deliverables

- `packages/core/src/connector.ts`
- `packages/core/src/generator.ts`
- `packages/core/src/context.ts`
- `packages/core/src/errors.ts`
- `packages/core/src/types.ts`
- `packages/core/src/index.ts` (updated)
