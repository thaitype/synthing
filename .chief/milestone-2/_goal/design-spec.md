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

### 2.1 Deferred References (Branded String)

`$var("key")` returns a `VariableRef<T>` — a **branded string** type. At runtime it is a plain string containing a tag (`"$${{key}}"`). At compile time TypeScript tracks the target type via the brand.

```ts
// Type definition
type VariableRef<T> = string & { __varRef: T; __key: string };
```

```ts
const { $var, $spread } = variableManager.createRef();

// At compile time: VariableRef<number>
// At runtime: "$${{port}}"
const portRef = $var("port", { default: 3000 });
```

**Why branded string:**
- Assignable to `string` — works in any context expecting strings (kubricate templates, YAML serialization, JSON.stringify)
- Compile-time type safety — `VariableRef<number>` vs `VariableRef<string>` prevents mixing up variable types within synthing's own APIs
- No class overhead — no `instanceof`, no `toJSON()`, no prototype chain
- One resolution mechanism — both generator and text pipelines scan for `$${{...}}` tag patterns
- Runtime type validation — happens at resolution time via schema-based coercion, not at creation time

References are **immutable**. Each call to `$var("key", { default: value })` returns a new `VariableRef`. Multiple call sites can have different defaults for the same key.

**Recommended convention**: `const { $var, $spread } = variableManager.createRef()`. The `$` prefix is a visual marker meaning "this is a reference." Users can rename via destructuring (e.g., `const { $var: v, $spread: s } = ...`).

### 2.2 `$var()` API Shape

Single function signature. Type is inferred from the registry, not from method factories.

```ts
// Type inferred from registry (port was declared as "number")
$var("port")                      // VariableRef<number> (runtime: "$${{port}}")
$var("port", { default: 3000 })   // VariableRef<number> (runtime: "$${{port}}")
$var("app_name")                  // VariableRef<string> (runtime: "$${{app_name}}")
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

The engine scans for `$${{key}}` tag patterns in strings, resolves each key via connectors, and coerces to the target type defined in the schema.

```ts
// Internal engine API (users never call directly)
async resolve(tag: string): Promise<unknown>       // single tag resolution
async resolveAll(input: unknown): Promise<unknown>  // deep-walk and resolve all tags
```

- Both generator and text pipelines use the **same resolution mechanism** — tag pattern matching
- Resolution is internal to the runtime. Users never call these directly.

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
coerceFromString(value: string, targetType: "object"): object | unknown[]
```

For `object` type: `JSON.parse()` the string, reject if result is a primitive (string, number, boolean). Only objects and arrays are accepted.

### 2.7 Schema Validation

Variables can optionally provide a `schema` for runtime validation using the [Standard Schema](https://standardschema.dev/) interface. When provided, validation is **enforced at resolve time**.

```ts
import { z } from "zod";

vm.addVariable("port", {
  type: "number",
  schema: z.number().min(1).max(65535),
})

vm.addVariable("extra_env", {
  type: "object",
  schema: z.array(z.object({
    name: z.string(),
    value: z.string(),
  })),
})
```

- `schema` is **optional** on all variable types
- Must implement Standard Schema interface (`~standard`)
- Resolution pipeline: raw string → coerce by `type` → validate by `schema` (if provided)
- `type` handles coercion (how to parse), `schema` handles validation (is the value correct)
- If `type` and `schema` contradict (e.g., `type: "object"` + `z.string()`), coercion succeeds but schema validation fails with a clear error
- No schema = basic type check only (string/number/boolean/object coercion)
- If schema also implements [Standard JSON Schema](https://standardschema.dev/json-schema) (`~standard.jsonSchema`), `toJSON()` exports the JSON Schema for UI consumers
- If no Standard JSON Schema support, `toJSON()` falls back to basic type metadata

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

const { $var, $spread } = variableManager.createRef();
```

- `.addVariable(key, schema)` — registers a variable with its type and metadata. Key is validated against the key regex immediately.
- `.addConnector(name, connector)` — registers a connector. Order of registration determines priority.
- `.createRef()` — returns `{ $var, $spread }` bound to this manager's variable declarations. `$spread` only accepts keys declared with `type: "object"`.

### 3.2 Schema Export

- `variableManager.toJSON()` — serializes variable metadata (keys, types, defaults, descriptions, secret flag). Does NOT include connector configuration.
- If a variable has a `schema` that implements Standard JSON Schema (`~standard.jsonSchema`), the JSON Schema is included in the export for UI consumers.
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

Abstract class with a `format` property and two methods. Lives in `@synthing/core` as a pure abstract interface.

```ts
abstract class BaseGenerator {
  /** Format this generator produces — used by engine for resolution */
  abstract readonly format: string;

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

Provided to `render()`. Lives in the engine layer (inside `synthing` package), not in `@synthing/core`.

```ts
interface GeneratorContext {
  outputDir: string;
  logger: Logger;
}
```

Generators do **not** resolve variables — they return objects with `$${{tag}}` strings. The engine resolves all tags after `serialize()` using the structural resolver (same resolver as text pipeline).

### 5.3 Constructor Shape

Options object with `filename` and `create` field. `$var` is from `createRef()`, not passed into `create`:

```ts
const { $var } = vm.createRef();

const deployment = new YamlGenerator({
  filename: "deployment.yaml",
  create: () => ({
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name: $var("app_name") },
    spec: {
      replicas: $var("replicas", { default: 1 }),
    },
  }),
});
```

`create()` can return a single object or an array of objects. Array produces multi-document YAML (separated by `---`):

```ts
const resources = new YamlGenerator({
  filename: "resources.yaml",
  create: () => [
    { apiVersion: "apps/v1", kind: "Deployment", metadata: { name: $var("app_name") } },
    { apiVersion: "v1", kind: "Service", metadata: { name: $var("app_name") } },
  ],
});
```

Output:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: "$${{app_name}}"
---
apiVersion: v1
kind: Service
metadata:
  name: "$${{app_name}}"
---
```

### 5.4 Format is Generator-Level

Each generator handles its own serialization. The pipeline never knows about format. `YamlGenerator` always outputs YAML. A future `JsonGenerator` would output JSON.

### 5.5 YamlGenerator (Built-in)

Ships inside the `synthing` package (engine layer). Renders objects to YAML files using its `serialize()` method.

- Single object → single YAML document
- Array of objects → multi-document YAML with `---` separators (matches kubricate's pattern)
- Filename provided in constructor

Future format-specific generators (TOML, JSON5, HCL) could be separate plugin packages.

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
- `"text"` — Phase 1. Reads files with `$${{var.xxx}}` tags, replaces with resolved values. Language-agnostic.

### 6.3 Generator Pipeline

```ts
interface GeneratorPipeline {
  type: "generator";
  generators: BaseGenerator[];   // "generators", not "configs"
  writer: Writer;
}
```

### 6.4 Text Pipeline

```ts
interface TextPipeline {
  type: "text";
  input: string;                          // directory or glob pattern to read
  format: "yaml" | "json" | "text" | TextFormat;  // explicit format declaration
  writer: Writer;
}

// Custom format handler interface
interface TextFormat {
  parse(content: string): unknown;
  stringify(data: unknown): string;
}
```

Reads files from `input`, resolves `$${{var_key}}` tags via `VariableManager`, and writes output via the writer. The `format` field determines how resolution works.

#### Tag Format

Fixed format: `$${{variable_key}}` — not configurable in Phase 1. The `$$` prefix avoids shell substitution conflicts. Matches the key registered via `.addVariable()`.

#### Format Handling

The `format` field is **explicit** — no auto-detection from file extension.

**Built-in formats:**

| Format | Resolution | Typed values | Spread support |
|---|---|---|---|
| `"yaml"` | Structural (parse → resolve → re-serialize) | Yes | Yes |
| `"json"` | Structural (parse → resolve → re-serialize) | Yes | Yes |
| `"text"` | Plain string replacement | No (all strings) | No |

**Custom format handler:**

```ts
import * as toml from "toml";

{
  type: "text",
  input: "./toml-templates/",
  format: {
    parse: (content) => toml.parse(content),
    stringify: (data) => toml.stringify(data),
  },
  writer: { type: "file", dir: "output/" },
}
```

Custom handlers get structural resolution (typed values + spread) — same engine as `"yaml"` and `"json"`.

**Plain text mode (`"text"`):**
- Finds `$${{key}}` in file content
- Replaces with string value
- No type awareness — everything becomes string
- No spread support

**Structural mode (`"yaml"`, `"json"`, or custom handler):**
- Parses file via `format.parse()` (or built-in parser)
- Walks tree, finds `$${{key}}` string values
- Replaces with **typed** values (numbers stay numbers, objects stay objects)
- Re-serializes via `format.stringify()` (or built-in serializer)
- Supports spread via `__synthing_spread` marker (see section 6.4.1)

#### Format consistency with generator pipeline

Both pipelines use the same structural resolver. The format is always explicit:

| Pipeline | Format declared by |
|---|---|
| Generator | Generator class (`BaseGenerator.format` property) |
| Text | Pipeline config (`format` field) |

#### 6.4.1 Spread Syntax (`$spread`)

For merging arrays/objects from variables into existing structures. Only works in structural mode.

**Helper function (from `createRef()`):**

```ts
const { $var, $spread } = vm.createRef();

$spread("extra_env")
// returns { key: "__synthing_spread", value: "$${{...extra_env}}" }
// Only accepts keys declared with type: "object" — compile error for string/number/boolean keys
```

**Array spread — insert items into parent array:**

```ts
env: [
  { name: "NODE_ENV", value: "production" },
  { [$spread("extra_env").key]: $spread("extra_env").value, name: "", value: "" },
]
```

Serializes to YAML:
```yaml
env:
  - name: NODE_ENV
    value: production
  - __synthing_spread: "$${{...extra_env}}"
    name: ""
    value: ""
```

Pipeline detects `__synthing_spread` key → resolves `$${{...extra_env}}` → replaces entire object with expanded array items:
```yaml
env:
  - name: NODE_ENV
    value: production
  - name: DB_HOST
    value: db.prod.example.com
  - name: DB_PORT
    value: "5432"
```

**Object spread — merge keys into parent object:**

```ts
labels: {
  app: $var("app_name"),
  [$spread("extra_labels").key]: $spread("extra_labels").value,
}
```

Serializes to YAML:
```yaml
labels:
  app: "$${{app_name}}"
  __synthing_spread: "$${{...extra_labels}}"
```

Pipeline detects `__synthing_spread` key → resolves → merges keys into parent, removes marker:
```yaml
labels:
  app: myapp
  version: 1.0.0
  team: backend
```

**Pipeline detection rules:**
- Array: object with `__synthing_spread` key → resolve value, splice expanded items in place of the marker object
- Object: key named `__synthing_spread` → resolve value, merge into parent, remove marker key
- `__synthing_spread` in plain text mode → error

#### Flow

1. Glob input files
2. For each file, use the pipeline's `format` setting:
3. **Plain text (`"text"`):** scan for `$${{key}}` patterns, replace with string values
4. **Structural (`"yaml"`, `"json"`, or custom handler):** parse file, deep-walk tree:
   a. Find `__synthing_spread` markers → resolve and expand
   b. Find `$${{key}}` string values → resolve with typed replacement
   c. Re-serialize to file format
5. Write output files via writer

### 6.5 Writer

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

### 6.6 Resolution is Internal

Users never call `resolveAll()` directly. The CLI reads `defineConfig()`, runs pipelines, and resolution happens internally during `render()` (generator) or tag replacement (text).

---

## 7. CLI

### 7.1 `synthing generate`

Main command. Reads `defineConfig()`, executes all pipelines, writes output.

**Generator pipeline flow:**
1. Load config file
2. For each pipeline:
   a. Call `load(keys)` on all connectors
   b. For each generator, call `render(ctx)` — generator calls `ctx.resolve()` as needed
   c. Call `serialize(content)` on each generator's output
   d. Write serialized files via the pipeline's writer

**Text pipeline flow:**
1. Load config file
2. For each pipeline:
   a. Call `load(keys)` on all connectors
   b. Glob input files from `input` path
   c. Use pipeline's `format` setting (explicit, not auto-detected)
   d. Resolve tags — `"text"`: string replacement; structural (`"yaml"`, `"json"`, custom): parse, walk, replace typed values, handle `__synthing_spread`, re-serialize
   e. Write output files via the pipeline's writer

### 7.2 `synthing variable export-schema`

Outputs the variable schema as JSON. Equivalent to calling `variableManager.toJSON()` and writing to stdout.

---

## 8. Simple YamlGenerator Example

A complete standalone example using only synthing — no kubricate.

```ts
// synthing.config.ts
import { VariableManager, YamlGenerator, defineConfig } from "synthing";
import { EnvConnector } from "@synthing/plugin-env";

// 1. Define variables
const vm = new VariableManager()
  .addVariable("app_name", { type: "string" })
  .addVariable("port", { type: "number", default: 3000 })
  .addVariable("replicas", { type: "number", default: 1 })
  .addConnector("env", new EnvConnector({ prefix: "APP_" }));

const { $var } = vm.createRef();

// 2. Define generator
const deployment = new YamlGenerator({
  filename: "deployment.yaml",
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
            image: "nginx:latest",
            ports: [{ containerPort: $var("port") }],
          }],
        },
      },
    },
  }),
});

// 3. Export config
export default defineConfig({
  variable: { variableSpec: vm, strictMode: true },
  pipelines: [
    { type: "generator", generators: [deployment], writer: { type: "file", dir: "output/" } },
  ],
});
```

```bash
APP_APP_NAME=myapp APP_PORT=8080 APP_REPLICAS=3 synthing generate
```

Output (`output/deployment.yaml`):

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
          image: nginx:latest
          ports:
            - containerPort: 8080
```

---

## 9. Kubricate Integration

### 8.1 Goal

Synthing must support the current version of kubricate (`ref/kubricate/`) with **zero changes to kubricate's library code**. Users who choose to integrate synthing with kubricate handle type adjustments in their own template definitions.

### 8.2 Integration Workflows

Both integration approaches are supported. Users choose based on their needs.

#### Workflow A: In-Process

Single `synthing.config.ts`, single CLI command. Kubricate's `Stack.build()` runs inside synthing's generator pipeline. Best for users who only need variable resolution.

```
synthing generate → calls stack.build() in-process → engine resolves $${{tags}} → writes YAML
```

#### Workflow B: Two CLIs

Separate CLIs, text files as boundary. Best for users who want full kubricate features (metadata injection, output modes, filtering).

```
kubricate generate → YAML with $${{tags}} → synthing generate → final YAML
```

**Trade-offs:**

| | Workflow A (In-Process) | Workflow B (Two CLIs) |
|---|---|---|
| CLI commands | `synthing generate` | `kubricate generate` + `synthing generate` |
| Kubricate metadata injection | No (skipped) | Yes |
| Kubricate output modes | No (synthing handles output) | Yes |
| Intermediate files | No | Yes |
| Variable resolution | Yes | Yes |
| Spread support | Yes | Yes |

> **Remark:** Investigation of kubernetes-models internals (`filterUndefinedValues` in `@kubernetes-models/base`) shows that tag strings and custom keys like `__synthing_spread` are preserved through the full pipeline (`new Deployment(config)` → `.toJSON()` → `structuredClone()`). Both workflows work.

> **Future:** A PR proposal for kubricate to expose a programmatic generate API would enable Workflow A with full kubricate features (metadata injection, output modes). See `_report/kubricate-pr-proposal.md`.

### 8.3 How `$var()` Works in Kubricate Context

`$var()` returns a `VariableRef<T>` (see section 2.1) — a branded string. At runtime it is `"$${{key}}"`, which is a plain string. It passes any `string` type check and serializes naturally:

```ts
$var("app_name")    // compile time: VariableRef<string>, runtime: "$${{app_name}}"
$var("port")        // compile time: VariableRef<number>, runtime: "$${{port}}"

// In kubricate template (expects string):
{ name: $var("app_name") }   // just a string — no conversion needed
```

Users write their own kubricate templates with `string` types for synthing-managed fields:

```ts
// User's own template — fields that use $var are typed as string
interface IMyAppStack {
  name: string;
  imageName: string;
  port: string;        // string, not number — user's choice for synthing integration
}
```

### 8.4 Workflow A: In-Process Example

One config file, one CLI command. Kubricate Stack runs inside synthing's generator pipeline.

```ts
// synthing.config.ts
import { z } from "zod";
import { VariableManager, YamlGenerator, defineConfig } from "synthing";
import { EnvConnector } from "@synthing/plugin-env";
import { Stack, defineStackTemplate } from "kubricate";

// --- Variables ---
const vm = new VariableManager()
  .addVariable("app_name", { type: "string" })
  .addVariable("port", { type: "number", default: 3000 })
  .addVariable("extra_env", {
    type: "object",
    schema: z.array(z.object({ name: z.string(), value: z.string() })),
  })
  .addVariable("extra_labels", {
    type: "object",
    schema: z.record(z.string()),
  })
  .addConnector("env", new EnvConnector({ prefix: "APP_" }));

const { $var, $spread } = vm.createRef();

// --- Kubricate Stack ---
const myTemplate = defineStackTemplate((input: {
  name: string;
  imageName: string;
  port: string;
  env: ({ name: string; value: string } & Record<string, string>)[];
  labels: Record<string, string>;
}) => ({
  deployment: {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name: input.name, labels: input.labels },
    spec: {
      containers: [{
        name: input.name,
        image: input.imageName,
        ports: [{ containerPort: input.port }],
        env: input.env,
      }],
    },
  },
}));

const stack = Stack.fromTemplate(myTemplate, {
  name: $var("app_name"),
  imageName: "nginx:latest",
  port: $var("port"),
  env: [
    { name: "NODE_ENV", value: "production" },
    { [$spread("extra_env").key]: $spread("extra_env").value, name: "", value: "" },
  ],
  labels: {
    app: $var("app_name"),
    [$spread("extra_labels").key]: $spread("extra_labels").value,
  },
});

// --- Wrap Stack in YamlGenerator ---
// stack.build() returns Record<string, unknown> (map of resourceId → resource)
// Object.values() extracts resources as array → multi-document YAML
const kubricateGen = new YamlGenerator({
  filename: "app.yaml",
  create: () => Object.values(stack.build()),
});

// --- Export ---
export default defineConfig({
  variable: { variableSpec: vm, strictMode: true },
  pipelines: [
    { type: "generator", generators: [kubricateGen], writer: { type: "file", dir: "output/" } },
  ],
});
```

```bash
APP_APP_NAME=myapp APP_PORT=8080 \
APP_EXTRA_ENV='[{"name":"DB_HOST","value":"db.prod.example.com"}]' \
APP_EXTRA_LABELS='{"version":"1.0.0","team":"backend"}' \
  synthing generate
```

**Flow:** `stack.build()` returns objects with `$${{tags}}` and `__synthing_spread` markers → generator engine deep-walks, resolves tags, expands spreads → `YamlGenerator.serialize()` → writes final YAML.

**Output:**

```yaml
# output/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  labels:
    app: myapp
    version: 1.0.0
    team: backend
spec:
  containers:
    - name: myapp
      image: nginx:latest
      ports:
        - containerPort: 8080
      env:
        - name: NODE_ENV
          value: production
        - name: DB_HOST
          value: db.prod.example.com
```

### 8.5 Workflow B: Two CLIs Example

For users who want full kubricate features (metadata injection, output modes, filtering), use two separate CLIs with text pipeline.

**synthing.config.ts:**

```ts
export default defineConfig({
  variable: { variableSpec: vm, strictMode: true },
  pipelines: [
    { type: "text", input: "./kubricate-output/", format: "yaml", writer: { type: "file", dir: "final-output/" } },
  ],
});
```

**kubricate.config.ts:**

```ts
import { $var, $spread } from "./variables";

// Same stack definition as Workflow A...

export default defineConfig({
  stacks: { app: stack },
  generate: { outputDir: "./kubricate-output" },
});
```

```bash
kubricate generate          # outputs YAML with $${{tags}}
synthing generate           # reads, resolves, writes final
```

### 8.6 What Changes for Whom

| | Changes? | What |
|---|---|---|
| Kubricate library code | **No** | Nothing |
| Kubricate built-in templates | **No** | Nothing |
| User's template types | **Yes** | Fields using `$var` become `string` |
| User's kubricate config | **Yes** | Uses `$var()` which returns `"$${{key}}"` strings |

---

## 10. Supported Variable Types

Phase 1 types:

| Type | TS Type | Coercion from string |
|---|---|---|
| `"string"` | `string` | identity |
| `"number"` | `number` | `Number()`, error if `NaN` |
| `"boolean"` | `boolean` | `"true"/"1"` -> `true`, `"false"/"0"` -> `false`, error otherwise |
| `"object"` | `object \| unknown[]` | `JSON.parse()`, error if result is primitive (not object/array) |

Note: `"number"` uses `Number()` (strict) instead of `parseFloat()` (lenient). `Number("123abc")` → `NaN` → error, while `parseFloat("123abc")` → `123` (silently accepts trailing garbage).

---

## 11. Phase 1 Deliverables

- `VariableManager` with builder pattern (`.addVariable()`, `.addConnector()`, `.createRef()`)
- `$var()` branded string deferred references (`VariableRef<T>`)
- `$spread()` helper for array/object spread in structural mode
- Variable types: `string`, `number`, `boolean`, `object`
- Optional `schema` field on all types (Standard Schema interface for runtime validation)
- `BaseConnector` (two-phase: `load()` + `get()`)
- `EnvConnector`
- `BaseGenerator` with `render()` + `serialize()`
- `YamlGenerator` (built-in)
- `GeneratorContext` with `outputDir`, `logger`
- `defineConfig()` with `variable` + `pipelines` domains
- Pipeline type: `"generator"` and `"text"`
- `"text"` pipeline with two modes:
  - Plain text: string replacement for all file types
  - Structural: parse/replace/re-serialize for YAML and JSON (typed values, spread support)
- `$${{key}}` fixed tag format, `$${{...key}}` spread tag, `__synthing_spread` marker
- Writer type: `"file"` only
- `synthing generate` CLI command
- `synthing variable export-schema` CLI command
- `toJSON()` on `VariableManager` for UI export (with Standard JSON Schema when available)
- Strict/loose mode (missing-value behavior only)
- Type coercion utilities (`coerceFromString`) in `@synthing/toolkit`
- Secret marker (`secret: true` -> redacted in logs/errors/toJSON)

---

## 12. Acceptance Criteria

All must pass for milestone-2 to be considered complete.

### Build & Quality

1. `pnpm build` — all packages produce `dist/`
2. `pnpm check-types` — zero TypeScript errors
3. `pnpm lint:check` — zero lint errors
4. `pnpm test` — zero failures

### Packages Exist and Export

5. `@synthing/core` — exports `BaseConnector`, `BaseGenerator`
6. `@synthing/toolkit` — exports `coerceFromString()`
7. `synthing` — exports `VariableManager`, `YamlGenerator`, `defineConfig`, `$spread` helper
8. `@synthing/plugin-env` — exports `EnvConnector`

### Features Work End-to-End

9. Generator pipeline: `YamlGenerator` with `$var()` → `synthing generate` → resolved YAML output
10. Text pipeline (plain): read file with `$${{tags}}` → resolve → write
11. Text pipeline (structural YAML): read YAML with `$${{tags}}` → typed resolution → write
12. Text pipeline (structural JSON): same for JSON
13. `$spread()` works — array and object spread in structural mode
14. `synthing export-schema` — outputs variable metadata JSON
15. Variable types: `string`, `number`, `boolean`, `object` all coerce correctly
16. Strict mode: missing value with no default → throws `ResolutionError`
17. Secret marker: `secret: true` → redacted in logs and `toJSON()`

### Kubricate Integration Proven

18. Workflow A (in-process): `Stack.build()` inside `YamlGenerator` → tags resolved → correct YAML output
19. Workflow B (two CLIs): `kubricate generate` → files with tags → `synthing generate` → resolved output

---

## 13. Explicitly NOT in Phase 1

- `@synthing/secrets` / `SecretManager`
- `KubricateGenerator` class (kubricate integration uses `YamlGenerator` wrapping `stack.build()` or text pipeline)
- `"api"` / `"stdout"` writers
- Secret provider / unwrap ceremony
- Multi-registry
- Configurable tag format (fixed `$${{key}}` in Phase 1)
- Nested/dynamic tag resolution (tag-inside-tag)
- Full template engine features (conditionals, loops, filters, partials)
- Non-TypeScript config support (JSON/YAML config files, schema file for non-TS users)
- Auto-detect format from file extension (format is always explicit)

---

## 14. Design Decision Index

For traceability, each major decision is numbered. These numbers correspond to the grilling session that produced this spec.

1. Deferred reference (`$var` returns branded string `VariableRef<T>`, runtime value is `"$${{key}}"` tag)
2. Always-async resolution
3. Typed refs from registry via `.createRef()` with generic accumulation
4. Schema validation enforced at resolve time when `schema` is provided (Standard Schema interface)
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
16. Immutable refs (each call returns new tag string)
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
28. Generator does NOT resolve — engine resolves after serialize() via structural resolver
29. `GeneratorContext` simplified to `outputDir` + `logger` only
30. `GeneratorOutput.content` is `unknown` (objects, not strings)
31. Constructor with `create` field
32. Format is generator-level, not pipeline-level
33. `defineConfig()` follows kubricate's pattern
34. `pipelines` array with discriminated union on `type`
35. Both `"generator"` and `"text"` pipeline types in Phase 1
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
49. `"text"` pipeline pulled into Phase 1 for kubricate integration
50. `VariableRef<T>` is a branded string — runtime value is `"$${{key}}"`, compile-time tracks target type
51. Kubricate integration via text pipeline — zero kubricate library changes
52. Tag format `$${{variable_key}}` is the contract between kubricate and synthing
53. Users who integrate synthing with kubricate change their own template types to `string`
54. No `KubricateGenerator` needed — text pipeline replaces it
55. Generator and text pipelines share the same resolution mechanism (tag pattern matching)
56. Runtime type validation via schema-based coercion at resolution time (e.g. `Number("123abc")` → NaN → error)
57. `object` variable type — accepts objects and arrays, coerced from JSON string
58. `$${{key}}` fixed tag format — not configurable in Phase 1
59. No nested tags, no full template engine — generator pipeline handles complex logic
60. Structural mode for YAML/JSON — parse, typed replacement, re-serialize
61. Plain text mode for all other formats — simple string replacement
62. `$spread()` helper returns `{ key: "__synthing_spread", value: "$${{...key}}" }`
63. `__synthing_spread` marker key for spread in structural mode
64. Array spread: marker object replaced with expanded items
65. Object spread: marker key removed, resolved keys merged into parent
66. Standard Schema (`~standard`) for optional runtime validation on all variable types
67. Standard JSON Schema (`~standard.jsonSchema`) for `toJSON()` export when available
68. `Number()` (strict) over `parseFloat()` (lenient) for number coercion
69. `createRef()` returns `{ $var, $spread }` — both bound to the VariableManager instance
70. `$spread` only accepts keys with `type: "object"` (compile-time enforced)
71. Kubricate in-process (Workflow A) and two-CLI (Workflow B) are both supported — user's choice
72. Workflow A: single CLI, variable resolution only. Workflow B: full kubricate features (metadata, output modes)
73. kubernetes-models preserves tag strings and `__synthing_spread` through `filterUndefinedValues` + `toJSON()`
74. Both pipelines use `variableSpec` in-process — no schema file needed in Phase 1
75. Non-TypeScript config support (schema file, JSON/YAML config) is future, not Phase 1
76. `synthing export-schema` exports JSON for UI consumers, separate from `synthing generate`
77. Resolution pipeline order: raw string → coerce by type → validate by schema (if provided)
78. Generator filename provided in constructor (not in defineConfig)
79. YamlGenerator supports single object or array of objects (multi-document YAML with `---`)
80. Generator pipeline: create() → serialize() → structural resolve → write (no deep-walk, same resolver as text pipeline)
81. GeneratorContext simplified: only `outputDir` + `logger` (no `resolve()`, no `strictMode`)
82. Call-site defaults: `$var("key", { default })` registers default in VariableManager as side effect
83. Duplicate call-site defaults for same key → throw error (fail fast)
84. `stack.build()` returns map — user calls `Object.values()` to get array for YamlGenerator
85. `BaseGenerator.format` property declares output format (`"yaml"`, `"json"`, `"text"`)
86. Text pipeline `format` field is explicit — no auto-detection from file extension
87. Text pipeline `format` accepts string shorthand or custom `TextFormat` handler (`parse` + `stringify`)
88. Custom `TextFormat` handlers get full structural resolution (typed values + spread)
89. `"text"` format is plain string replacement only (no types, no spread)
90. Format handling is consistent: generator declares via class property, text pipeline declares via config
91. `BaseGenerator.format` is `string` (not literal union) — extensible, engine does map lookup
92. CLI uses `yargs` (same as kubricate)
93. Config loading uses `unconfig` (same as kubricate)
