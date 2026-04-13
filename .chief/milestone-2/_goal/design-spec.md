# Design Spec: Synthing Phase 1

## 1. Overview

Synthing is a full render pipeline that consumes variables (and later secrets) from multiple sources, then generates output through pluggable targets. It is tool-agnostic and not tied to any specific adapter, runtime, or deployment platform.

Synthing extends patterns from [kubricate](https://github.com/thaitype/kubricate). Kubricate v2 will eventually merge into Synthing.

### Phase 1 Packages

| Package | Responsibility |
|---|---|
| `@synthing/core` | Interfaces + types only: `BaseConnector`, `BaseGenerator`, error types, shared type definitions |
| `@synthing/toolkit` | Pure utility functions: coercion helpers. Zero dependencies. |
| `synthing` (unscoped) | CLI frontend (`cli/`) + engine (`engine/`): `VariableManager`, `$var`, resolution, `GeneratorContext`, pipeline runner, `YamlGenerator`, `defineConfig()`, CLI commands, file writer |
| `@synthing/plugin-env` | `EnvConnector` (domain-agnostic, serves both variables and secrets). Peer dep on `@synthing/core`. |

### Package Architecture

```
@synthing/core        ← no internal deps (interfaces only, rarely changes)
@synthing/toolkit     ← no internal deps (pure utilities)
@synthing/plugin-env  ← peer dep: @synthing/core
synthing              ← depends on: @synthing/core, @synthing/toolkit
```

**Internal directory structure of `synthing` package:**

```
packages/synthing/src/
  cli/       → arg parsing, config file loading, defineConfig(), file writer
  engine/    → VariableManager, $var, resolution, GeneratorContext, pipeline runner, YamlGenerator
```

**Rules:**
- `engine/` never imports from `cli/` (enables future extraction to `@synthing/engine`)
- `cli/` imports from `engine/`
- `engine/` has no filesystem I/O, no arg parsing, no `process.argv`
- `@synthing/core` has minimal surface area to prevent breaking changes across the ecosystem
- Plugins peer-depend on `@synthing/core` only (not on `synthing`)
- Users install plugins themselves (`synthing` does not bundle plugins)

---

## 2. Variable System

### 2.1 Deferred References

`$var("key")` returns a `VariableRef<T>`, not a resolved value. It is a lightweight marker object that records the key and optional defaults. Resolution happens later, during pipeline execution.

```ts
const $var = variableManager.createRef();

// Returns VariableRef<number>, NOT a number
const portRef = $var("port", { default: 3000 });
```

References are **immutable**. Each call to `$var("key", { default: value })` returns a new `VariableRef`. Multiple call sites can have different defaults for the same key.

**Recommended convention**: `const $var = variableManager.createRef()`. The `$` prefix is a visual marker meaning "this is a reference."

### 2.2 `$var()` API Shape

Single function signature. Type is inferred from the registry, not from method factories.

```ts
// Type inferred from registry (port was declared as "number")
$var("port")                      // VariableRef<number>
$var("port", { default: 3000 })   // VariableRef<number>
$var("app_name")                  // VariableRef<string>
```

There are no `.number()` / `.string()` factories and no `.withDefault()` method chaining.

### 2.3 Variable Keys

- Flat strings, not hierarchical
- Regex: `^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$`
- Dots are cosmetic grouping only, not structural (no nesting semantics)
- Validated at `.addVariable()` time (fail fast)
- No reserved prefixes

### 2.4 Resolution

Resolution is **always async**, even for sync sources like environment variables. This avoids breaking the API when async sources are added later.

```ts
// Both resolve() and resolveAll() are async
async resolve(ref: VariableRef<T>): Promise<T>
async resolveAll(refs: VariableRef[]): Promise<ResolvedValues>
```

- `resolveAll()` is the primary API (batch resolution). `resolve()` is the lower-level primitive.
- Both are internal to the runtime. Users never call them directly.

### 2.5 Resolution Precedence

Explicit priority list, first match wins. Connectors are tried in order of registration.

For a given key, the value precedence is:

1. Connector value (first connector that returns a value wins)
2. Call-site default (`$var("key", { default: value })`)
3. Schema default (from `.addVariable("key", { default: value })`)
4. In strict mode: throw `ResolutionError`. In loose mode: return `undefined`.

### 2.6 Type Coercion

**Shared coercion utilities (from `@synthing/toolkit`)** — toolkit exports `coerceFromString()` helpers. Connectors and the engine may use them. The engine performs the final type-check to ensure basic type matching (a variable declared as `number` returns a number or errors).

```ts
// @synthing/toolkit exports
coerceFromString(value: string, targetType: "number"): number
coerceFromString(value: string, targetType: "boolean"): boolean
coerceFromString(value: string, targetType: "string"): string
```

### 2.7 No Validation Enforcement in Resolve

Metadata constraints (min, max, regex, etc.) are for UI and external consumers only. `resolve()` does NOT enforce them. It only ensures basic type matching via coercion.

### 2.8 Strict vs Loose Mode

Scoped narrowly to missing-value behavior only:

- **Strict**: missing value with no default throws `ResolutionError`
- **Loose**: missing value with no default returns `undefined`

Strict mode is the recommended default for production use.

### 2.9 Error Handling

`resolve()` throws typed `ResolutionError`. For batch `resolveAll()`, multiple failures can be attached to one error object.

```ts
class ResolutionError extends Error {
  key: string;
  reason: "missing" | "type_mismatch" | "connector_error";
  // For resolveAll(), multiple failures
  failures?: Array<{ key: string; reason: string }>;
}
```

### 2.10 Secret Marker

Phase 1 uses a simple marker, not a full secret system.

```ts
.addVariable("db_password", { type: "string", secret: true })
```

Variables marked `secret: true` are:
- Redacted in logs and error messages
- Redacted in `toJSON()` output

There is no `SecretProvider`, no unwrap ceremony, no `SecretManager` in Phase 1.

---

## 3. VariableManager

A single class that declares variables AND composes connectors. Follows kubricate's `SecretManager` pattern. There is no separate `VariableRegistry`.

### 3.1 Builder Pattern

Uses generic accumulation for type safety. `<K extends string>` infers literal types — no `as const` needed.

```ts
const variableManager = new VariableManager()
  .addVariable("app_name", { type: "string" })
  .addVariable("port", { type: "number", default: 3000 })
  .addVariable("db_password", { type: "string", secret: true })
  .addConnector("env", new EnvConnector({ prefix: "APP_" }));

const $var = variableManager.createRef();
```

- `.addVariable(key, schema)` — registers a variable with its type and metadata. Key is validated against the key regex immediately.
- `.addConnector(name, connector)` — registers a connector. Order of registration determines priority.
- `.createRef()` — returns a typed `$var` function bound to this manager's variable declarations.

### 3.2 Schema Export

- `variableManager.toJSON()` — serializes only variable metadata (keys, types, defaults, descriptions, secret flag). Does NOT include connector configuration.
- CLI command: `synthing variable export-schema` — outputs the same JSON to stdout.

### 3.3 Keys Declared in Schema, Connectors are Pure Value Readers

Users declare keys via `.addVariable()`. Connectors do not contribute or discover keys — they only read values for keys they are asked about.

---

## 4. Connectors

### 4.1 BaseConnector (in `@synthing/core`)

`BaseConnector` is **domain-agnostic**. The same connector class serves both variables and secrets. It lives in `@synthing/core` as a pure abstract interface.

Naming: `BaseConnector`, not `BaseVariableConnector` or `BaseVariableResolver`. Aligns with kubricate's `BaseConnector` term.

### 4.2 Two-Phase Interface

Matches kubricate's `BaseConnector` interface:

```ts
abstract class BaseConnector {
  /** Load/prepare values for the given keys (async, called once) */
  abstract load(keys: string[]): Promise<void>;

  /** Get a single value (sync, called per-key after load) */
  abstract get(key: string): unknown | undefined;
}
```

- `load(keys[])` — called once with all keys this connector might need. Allows batch fetching.
- `get(key)` — called per-key after load. Returns the raw value or `undefined`.

### 4.3 EnvConnector (in `@synthing/plugin-env`)

Package: `@synthing/plugin-env` (not `variables-resolver-env`). Shared plugin that serves both variable and secret domains.

Class name: `EnvConnector` (not `VariableEnvConnector`). Package scope provides context.

```ts
import { EnvConnector } from "@synthing/plugin-env";

new EnvConnector({ prefix: "APP_" })
// Reads APP_PORT, APP_DB_PASSWORD from process.env
```

Users can separate variable vs secret env vars via prefix convention (e.g., `VAR_`, `SECRET_`).

---

## 5. Generator System

### 5.1 BaseGenerator (in `@synthing/core`)

Abstract class with two methods. Lives in `@synthing/core` as a pure abstract interface.

```ts
abstract class BaseGenerator {
  /** Produce content (objects, not strings) */
  abstract render(ctx: GeneratorContext): Promise<GeneratorOutput>;

  /** Serialize objects into file content */
  abstract serialize(content: unknown): SerializedOutput[];
}
```

- `render()` returns objects (`GeneratorOutput.content` is `unknown`), NOT serialized strings.
- `serialize()` turns objects into `SerializedOutput[]` (filename + string content).
- This matches kubricate's pattern: Stack returns objects, Renderer serializes.

### 5.2 GeneratorContext (in `synthing` engine)

Provided to `render()`. The generator calls `ctx.resolve()` itself — it controls resolution timing. Lives in the engine layer (inside `synthing` package), not in `@synthing/core`, because it ties generators to the resolution system.

```ts
interface GeneratorContext {
  resolve<T>(ref: VariableRef<T>): Promise<T>;
  outputDir: string;
  logger: Logger;
  strictMode: boolean;
}
```

Simple generators call `resolve()` immediately. Complex generators (like a future `KubricateGenerator`) may handle resolution differently.

### 5.3 Constructor Shape

Single options object with a `create` field:

```ts
const deployment = new YamlGenerator({
  create: ($var) => ({
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name: $var("app_name") },
    spec: {
      replicas: $var("replicas", { default: 1 }),
    },
  }),
});
```

Future example (not Phase 1):

```ts
new KubricateGenerator({
  create: () => Stack.fromTemplate(...),
  format: "json",
});
```

### 5.4 Format is Generator-Level

Each generator handles its own serialization. The pipeline never knows about format. `YamlGenerator` always outputs YAML. A future `JsonGenerator` would output JSON.

### 5.5 YamlGenerator (Built-in)

Ships inside the `synthing` package (engine layer). Renders objects to YAML files using its `serialize()` method. Future format-specific generators (TOML, JSON5, HCL) could be separate plugin packages.

---

## 6. Pipeline and Config

### 6.1 `defineConfig()`

Follows kubricate's pattern. Top-level keys are domain concerns.

```ts
import { defineConfig } from "synthing";

export default defineConfig({
  variable: {
    variableSpec: variableManager,
    strictMode: true,
  },
  pipelines: [
    {
      type: "generator",
      generators: [deployment, service],
      writer: { type: "file", dir: "output" },
    },
  ],
});
```

### 6.2 Pipelines

`pipelines` is an array. Each pipeline is a complete flow: input -> resolve -> render -> serialize -> write.

Pipelines use a **discriminated union on `type`**:

- `"generator"` — Phase 1. Uses generators to produce output.
- `"text"` — Future. Reads files with `$${{var.xxx}}` tags, language-agnostic.

### 6.3 Generator Pipeline

```ts
interface GeneratorPipeline {
  type: "generator";
  generators: BaseGenerator[];   // "generators", not "configs"
  writer: Writer;
}
```

### 6.4 Writer

Per-pipeline writer. Discriminated union on `type`.

Phase 1: `{ type: "file", dir: "output" }` only.

Future: `{ type: "api", ... }`, `{ type: "stdout" }`, etc.

```ts
type Writer =
  | { type: "file"; dir: string }
  // Future:
  // | { type: "api"; endpoint: string }
  // | { type: "stdout" }
```

### 6.5 Resolution is Internal

Users never call `resolveAll()` directly. The CLI reads `defineConfig()`, runs pipelines, and resolution happens internally during `render()`.

---

## 7. CLI

### 7.1 `synthing generate`

Main command. Reads `defineConfig()`, executes all pipelines, writes output.

Flow:
1. Load config file
2. For each pipeline:
   a. Call `load(keys)` on all connectors
   b. For each generator, call `render(ctx)` — generator calls `ctx.resolve()` as needed
   c. Call `serialize(content)` on each generator's output
   d. Write serialized files via the pipeline's writer

### 7.2 `synthing variable export-schema`

Outputs the variable schema as JSON. Equivalent to calling `variableManager.toJSON()` and writing to stdout.

---

## 8. End-to-End Example

### Step 1: Define variables and connectors

```ts
// synthing.config.ts
import { VariableManager, YamlGenerator, defineConfig } from "synthing";
import { EnvConnector } from "@synthing/plugin-env";

const variableManager = new VariableManager()
  .addVariable("app_name", { type: "string" })
  .addVariable("port", { type: "number", default: 3000 })
  .addVariable("replicas", { type: "number", default: 1 })
  .addVariable("db_password", { type: "string", secret: true })
  .addConnector("env", new EnvConnector({ prefix: "APP_" }));

const $var = variableManager.createRef();
```

### Step 2: Define generators

```ts
const deployment = new YamlGenerator({
  create: () => ({
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name: $var("app_name") },
    spec: {
      replicas: $var("replicas"),
      template: {
        spec: {
          containers: [{
            name: $var("app_name"),
            env: [
              { name: "PORT", value: $var("port") },
              { name: "DB_PASSWORD", value: $var("db_password") },
            ],
          }],
        },
      },
    },
  }),
});
```

### Step 3: Export config

```ts
export default defineConfig({
  variable: {
    variableSpec: variableManager,
    strictMode: true,
  },
  pipelines: [
    {
      type: "generator",
      generators: [deployment],
      writer: { type: "file", dir: "output" },
    },
  ],
});
```

### Step 4: Run

```bash
APP_APP_NAME=myapp APP_PORT=8080 APP_REPLICAS=3 APP_DB_PASSWORD=s3cret \
  synthing generate
```

### Step 5: Output

`output/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: myapp
          env:
            - name: PORT
              value: "8080"
            - name: DB_PASSWORD
              value: "s3cret"
```

---

## 9. Supported Variable Types

Phase 1 types:

| Type | TS Type | Coercion from string |
|---|---|---|
| `"string"` | `string` | identity |
| `"number"` | `number` | `parseFloat`, error if `NaN` |
| `"boolean"` | `boolean` | `"true"/"1"` -> `true`, `"false"/"0"` -> `false`, error otherwise |

---

## 10. Phase 1 Deliverables

- `VariableManager` with builder pattern (`.addVariable()`, `.addConnector()`, `.createRef()`)
- `$var()` typed deferred immutable references
- `BaseConnector` (two-phase: `load()` + `get()`)
- `EnvConnector`
- `BaseGenerator` with `render()` + `serialize()`
- `YamlGenerator` (built-in)
- `GeneratorContext` with `resolve()`, `logger`, `outputDir`, `strictMode`
- `defineConfig()` with `variable` + `pipelines` domains
- Pipeline type: `"generator"` only
- Writer type: `"file"` only
- `synthing generate` CLI command
- `synthing variable export-schema` CLI command
- `toJSON()` on `VariableManager` for UI export
- Strict/loose mode (missing-value behavior only)
- Type coercion utilities (`coerceFromString`) in `@synthing/toolkit`
- Secret marker (`secret: true` -> redacted in logs/errors/toJSON)

---

## 11. Explicitly NOT in Phase 1

- `@synthing/secrets` / `SecretManager`
- `KubricateGenerator`
- `"text"` pipeline type
- `"api"` / `"stdout"` writers
- Validation enforcement in `resolve()` (min/max/regex)
- Secret provider / unwrap ceremony
- Multi-registry

---

## 12. Design Decision Index

For traceability, each major decision is numbered. These numbers correspond to the grilling session that produced this spec.

1. Deferred reference (`$var` returns `VariableRef<T>`, not resolved value)
2. Always-async resolution
3. Typed refs from registry via `.createRef()` with generic accumulation
4. No validation enforcement in resolve
5. Type guarantee via shared coercion
6. Strict/loose scoped to missing-value behavior only
7. Explicit priority list, first match wins
8. Shared coercion utilities in toolkit (moved from core)
9. Typed `ResolutionError` exceptions
10. Both-layer defaults (call-site and schema)
11. Ship both `resolve()` and `resolveAll()`
12. User declares keys in schema; connectors are pure readers
13. Both `toJSON()` and CLI export
14. Flat string keys with dot-cosmetic grouping
15. Single `$var()` function with options object
16. Immutable refs (each call returns new VariableRef)
17. Secret marker via `{ secret: true }`
18. `$` prefix convention for ref variable
19. `BaseConnector` naming (not `BaseVariableResolver`)
20. Domain-agnostic connectors
21. Two-phase connector (`load` then `get`)
22. `@synthing/plugin-env` package naming
23. No class prefix (`EnvConnector`, not `VariableEnvConnector`)
24. Single `VariableManager` class (no separate registry)
25. Builder pattern with generic accumulation
26. `toJSON()` serializes variable metadata only
27. `BaseGenerator` with `render()` + `serialize()`
28. Generator calls `ctx.resolve()` (generator controls timing)
29. `GeneratorContext` shape
30. `GeneratorOutput.content` is `unknown` (objects, not strings)
31. Constructor with `create` field
32. Format is generator-level, not pipeline-level
33. `defineConfig()` follows kubricate's pattern
34. `pipelines` array with discriminated union on `type`
35. `"generator"` pipeline type for Phase 1; `"text"` future
36. `generators` field name (not `configs`)
37. Per-pipeline writer with discriminated union
38. Resolution is internal (user never calls it directly)
39. CLI package is unscoped (`synthing`, not `@synthing/cli`) — follows kubricate pattern
40. `@synthing/variables` merged into `synthing` package as `engine/` directory
41. Core is interfaces + types only — minimal surface area to prevent breaking changes
42. `@synthing/toolkit` for pure utilities (coercion) — standalone, zero deps
43. Internal `cli/` + `engine/` separation inside `synthing` for future extractability
44. `engine/` never imports from `cli/` (one-way dependency)
45. Plugins peer-depend on `@synthing/core` only
46. Users install plugins themselves (CLI does not bundle plugins)
47. GeneratorContext lives in engine layer, not core
48. YamlGenerator ships in engine layer; future format generators can be separate plugins
