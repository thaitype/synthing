# Contract: BaseConnector

Service boundary between `@synthing/core` and any connector plugin (e.g. `@synthing/plugin-env`). Locked by the grilling session recorded in `.chief/milestone-2/_goal/design-spec.md` §14 (decisions 94–99). Must not be violated without a new grilling session updating both this file and the design-spec.

## Interface shape

```ts
// @synthing/core
interface BaseConnector<Config extends object = object> {
  config: Config;
  logger?: Logger;

  load(keys: string[]): Promise<void>;
  get(key: string): unknown | undefined;

  setWorkingDir?(dir: string | undefined): void;
  getWorkingDir?(): string | undefined;
}
```

- **`interface`, not `abstract class`.** Structural typing — a connector plugin's installed `@synthing/core` copy does not need to be the same class instance as the host's (avoids the dual-package hazard).
- `config`, `logger`, `setWorkingDir?`, `getWorkingDir?` are part of the contract, not connector-specific extras. Engine code may call `connector.setWorkingDir?.(dir)` on any `BaseConnector` without narrowing to a concrete class.

## Coercion boundary (hard rule)

**Connectors never coerce, parse, or transform values.** `get()` returns the raw value exactly as read from the source.

Rationale: `load(keys: string[])` only receives key *names* — a connector has no way to know a key's declared `VariableType`. Any connector-side type inference is necessarily a blind guess based on value shape, not the user's declared intent, and can double-coerce a value the engine's `coerceFromString()` then tries to coerce again (e.g. a connector that JSON-parses a flat-object-looking string before the engine's `coerceFromString(value, "object")` — which expects a raw string — ever sees it).

`@synthing/toolkit.coerceFromString(rawValue, declaredType)` is the **only** coercion path, called exclusively by the engine, after `get()` returns.

## No `SecretValue` type

Kubricate's `SecretValue` (`string | number | boolean | null | undefined | Record<string, Primitive>`) existed to satisfy `BaseProvider.prepare(name, value: SecretValue)` — Kubernetes Secrets are flat, string-serializable key-value maps, so the type was shaped by that downstream serialization constraint.

Synthing has no `BaseProvider` equivalent. Nothing downstream constrains connector output shape. `get()` stays `unknown | undefined` at the interface level; concrete connectors narrow it to whatever their source actually produces (`EnvConnector` → `string | undefined`, since env vars are always strings).

## Logging (connector-specific, not part of the core interface)

A connector MAY log values it handles, but must not assume it knows which keys are secrets — `secret: true` is a `VariableManager`-level declaration the connector never sees. `EnvConnector` masks every logged value indiscriminately by default (`maskValues: true`) rather than guessing.

## Concrete instance: EnvConnector

| Aspect | Contract |
|---|---|
| `get()` return type | `string \| undefined` (no `SecretValue`, no object coercion) |
| Key matching | `expectedKey = prefix + key`, matched against `process.env` case-insensitively by default (`caseInsensitive: true`) |
| Value transformation | None — raw string only, no JSON-sniffing |
| Logging | `maskValues: true` by default — all logged values masked via `maskingValue()` |
