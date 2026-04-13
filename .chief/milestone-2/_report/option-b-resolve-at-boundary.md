# Option B: Resolve-at-Boundary — Full End-to-End Explanation

## What "resolve-at-boundary" means

The core idea: adapters (Kubernetes, Terraform, Docker Compose, etc.) accept **config objects that contain `VariableRef` values mixed with plain values**. The adapter itself never calls `resolve()`. Instead, there is a single resolution step at the **boundary** — the moment just before the adapter's render function consumes the config — where `resolveAll()` walks the entire config tree, finds every `VariableRef`, resolves it, and produces a **new object with identical shape but all refs replaced by plain values**.

The adapter receives the fully-resolved plain object and has zero knowledge of `@synthing/variable`.

---

## Step 1: Define the registry

```ts
// variables.ts
import { defineVariables } from "@synthing/variable";

export const variableRegistry = defineVariables({
  app_port: {
    type: "number",
    description: "Application port",
  },
  api_url: {
    type: "string",
    description: "Backend API endpoint",
  },
  debug_enabled: {
    type: "boolean",
    description: "Enable debug logging",
  },
  db_host: {
    type: "string",
    description: "Database hostname",
  },
  db_port: {
    type: "number",
    description: "Database port",
  },
});
```

This is standard registry setup — nothing specific to Option B.

---

## Step 2: Build a config object using `vars` — WITH VariableRef values inside

This is where Option B diverges. The user writes a config object where some values are plain literals and some values are `VariableRef` instances. They are mixed freely.

```ts
// my-app-config.ts
import { vars } from "@synthing/variable";

// The user builds the config object directly.
// vars.number() / vars.string() / vars.boolean() return VariableRef<T> — NOT resolved values.
// Plain values (like the string "my-app") are also allowed.

export const appConfig = {
  name: "my-app",                                        // plain string
  port: vars.number("app_port", { default: 3000 }),      // VariableRef<number>
  api: {
    url: vars.string("api_url"),                         // VariableRef<string>
    timeout: 5000,                                       // plain number
  },
  debug: vars.boolean("debug_enabled", { default: false }), // VariableRef<boolean>
  database: {
    host: vars.string("db_host", { default: "localhost" }), // VariableRef<string>
    port: vars.number("db_port", { default: 5432 }),        // VariableRef<number>
    ssl: true,                                              // plain boolean
  },
};
```

### What the TypeScript type of `appConfig` looks like at this point

```ts
// TypeScript infers:
const appConfig: {
  name: string;
  port: VariableRef<number>;
  api: {
    url: VariableRef<string>;
    timeout: number;
  };
  debug: VariableRef<boolean>;
  database: {
    host: VariableRef<string>;
    port: VariableRef<number>;
    ssl: boolean;
  };
}
```

Notice: **the object is a mix of plain values and VariableRef values**. This is a normal TypeScript object — no special wrapper, no class hierarchy.

---

## Step 3: The type transformation — `DeepResolve<T>`

This is the key type that makes Option B work. It recursively walks a type and replaces every `VariableRef<T>` with `T`, while leaving all other types untouched.

```ts
// packages/variable/src/deep-resolve.ts

import type { VariableRef } from "./types.js";

/**
 * Recursively replace VariableRef<T> with T throughout an object type.
 *
 * - If T is VariableRef<U>, produce U
 * - If T is a plain object, recurse into each property
 * - If T is an array, recurse into elements
 * - Otherwise, return T unchanged (string, number, boolean, etc.)
 */
export type DeepResolve<T> =
  T extends VariableRef<infer U>
    ? U
    : T extends Array<infer E>
      ? Array<DeepResolve<E>>
      : T extends object
        ? { [K in keyof T]: DeepResolve<T[K]> }
        : T;
```

### Applying `DeepResolve` to our config

```ts
type ResolvedConfig = DeepResolve<typeof appConfig>;

// This evaluates to:
// {
//   name: string;              // was string       -> stays string
//   port: number;              // was VariableRef<number>  -> becomes number
//   api: {
//     url: string;             // was VariableRef<string>  -> becomes string
//     timeout: number;         // was number       -> stays number
//   };
//   debug: boolean;            // was VariableRef<boolean> -> becomes boolean
//   database: {
//     host: string;            // was VariableRef<string>  -> becomes string
//     port: number;            // was VariableRef<number>  -> becomes number
//     ssl: boolean;            // was boolean      -> stays boolean
//   };
// }
```

Every `VariableRef<T>` became `T`. Every plain value stayed the same. The structure is identical. This is the type the adapter will see.

---

## Step 4: `resolveAll()` — the runtime implementation

`resolveAll()` takes an object (any depth) and a set of resolvers, walks the tree, resolves every `VariableRef`, and returns the resolved plain object.

```ts
// packages/variable/src/resolve-all.ts

import type { VariableRef, VariableResolverPlugin } from "./types.js";
import type { DeepResolve } from "./deep-resolve.js";
import { resolve } from "./resolve.js";

export interface ResolveOptions {
  resolvers: VariableResolverPlugin[];
}

/**
 * Check if a value is a VariableRef.
 * VariableRef has a __brand field set to 'VariableRef'.
 */
function isVariableRef(value: unknown): value is VariableRef {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as any).__brand === "VariableRef"
  );
}

/**
 * Recursively walk an object tree.
 * - If a leaf is a VariableRef, resolve it.
 * - If a leaf is a plain value, pass it through.
 * - If a node is an object or array, recurse.
 */
async function deepResolve(
  value: unknown,
  options: ResolveOptions,
): Promise<unknown> {
  // Case 1: it is a VariableRef — resolve it
  if (isVariableRef(value)) {
    return resolve(value, options);
  }

  // Case 2: it is an array — recurse into each element
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => deepResolve(item, options)));
  }

  // Case 3: it is a plain object — recurse into each property
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value);
    const resolvedEntries = await Promise.all(
      entries.map(async ([key, val]) => {
        const resolved = await deepResolve(val, options);
        return [key, resolved] as const;
      }),
    );
    return Object.fromEntries(resolvedEntries);
  }

  // Case 4: it is a primitive (string, number, boolean, null) — pass through
  return value;
}

/**
 * Public API.
 * Takes any object tree that may contain VariableRef values.
 * Returns a new object with the same shape, all refs resolved to plain values.
 *
 * The return type uses DeepResolve<T> so TypeScript knows the output
 * has no VariableRef anywhere — just plain types.
 */
export async function resolveAll<T>(
  config: T,
  options: ResolveOptions,
): Promise<DeepResolve<T>> {
  return deepResolve(config, options) as Promise<DeepResolve<T>>;
}
```

### Key properties

- It uses `Promise.all` at each level, so sibling refs resolve in parallel.
- It returns a **new object** — the original config is never mutated (aligns with Decision #17, immutability).
- The cast to `DeepResolve<T>` at the end is safe because the runtime walk mirrors the type-level recursion exactly.

---

## Step 5: The boundary — resolving before the adapter sees anything

```ts
// render.ts — the orchestration layer
import { resolveAll } from "@synthing/variable";
import { createEnvResolver } from "@synthing/variable-plugin-env";
import { appConfig } from "./my-app-config.js";
import { renderKubernetes } from "./adapters/kubernetes.js";
import { renderTerraform } from "./adapters/terraform.js";

// Suppose environment has:
//   APP_PORT=8080
//   API_URL=https://api.prod.example.com
//   DB_HOST=db.prod.internal
//   DB_PORT=5433
//   (DEBUG_ENABLED is NOT set)

const envResolver = createEnvResolver();

async function render() {
  const resolvers = { resolvers: [envResolver] };

  // === THE BOUNDARY ===
  // This is the single point where VariableRef -> plain value happens.
  const resolved = await resolveAll(appConfig, resolvers);

  // At this point, `resolved` has type:
  // {
  //   name: string;
  //   port: number;
  //   api: { url: string; timeout: number };
  //   debug: boolean;
  //   database: { host: string; port: number; ssl: boolean };
  // }
  //
  // And at runtime, the actual values are:
  // {
  //   name: "my-app",
  //   port: 8080,
  //   api: { url: "https://api.prod.example.com", timeout: 5000 },
  //   debug: false,                    // fell back to default
  //   database: { host: "db.prod.internal", port: 5433, ssl: true },
  // }

  // Pass the plain object to any adapter — they never import @synthing/variable
  const k8sManifest = renderKubernetes(resolved);
  const tfConfig = renderTerraform(resolved);

  return { k8sManifest, tfConfig };
}
```

---

## Step 6: Adapters receive plain values — zero coupling

### Kubernetes adapter

```ts
// adapters/kubernetes.ts

// Note: this file does NOT import anything from @synthing/variable.
// It receives a plain typed object.

interface AppConfig {
  name: string;
  port: number;
  api: { url: string; timeout: number };
  debug: boolean;
  database: { host: string; port: number; ssl: boolean };
}

export function renderKubernetes(config: AppConfig) {
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name: config.name },
    spec: {
      template: {
        spec: {
          containers: [
            {
              name: config.name,
              ports: [{ containerPort: config.port }],
              env: [
                { name: "API_URL", value: config.api.url },
                { name: "API_TIMEOUT", value: String(config.api.timeout) },
                { name: "DEBUG", value: String(config.debug) },
                { name: "DB_HOST", value: config.database.host },
                { name: "DB_PORT", value: String(config.database.port) },
              ],
            },
          ],
        },
      },
    },
  };
}
```

### Terraform adapter

```ts
// adapters/terraform.ts

// Also does NOT import @synthing/variable.

interface AppConfig {
  name: string;
  port: number;
  api: { url: string; timeout: number };
  debug: boolean;
  database: { host: string; port: number; ssl: boolean };
}

export function renderTerraform(config: AppConfig) {
  return {
    resource: {
      aws_ecs_task_definition: {
        [config.name]: {
          family: config.name,
          container_definitions: JSON.stringify([
            {
              name: config.name,
              portMappings: [{ containerPort: config.port }],
              environment: [
                { name: "API_URL", value: config.api.url },
                { name: "DB_HOST", value: config.database.host },
                { name: "DB_PORT", value: String(config.database.port) },
              ],
            },
          ]),
        },
      },
      aws_rds_instance: {
        [`${config.name}_db`]: {
          engine: "postgres",
          port: config.database.port,
        },
      },
    },
  };
}
```

Both adapters define their own `AppConfig` interface with plain types. They could also accept `DeepResolve<typeof appConfig>` directly if they want to co-locate with the config definition, but the point is: they never see `VariableRef`.

---

## Step 7: The full type flow visualized

```
BEFORE resolveAll()                          AFTER resolveAll()
(what the user writes)                       (what the adapter receives)
────────────────────────                     ─────────────────────────

{                                            {
  name: string                     ->          name: string
  port: VariableRef<number>        ->          port: number
  api: {                                       api: {
    url: VariableRef<string>       ->            url: string
    timeout: number                ->            timeout: number
  }                                            }
  debug: VariableRef<boolean>      ->          debug: boolean
  database: {                                  database: {
    host: VariableRef<string>      ->            host: string
    port: VariableRef<number>      ->            port: number
    ssl: boolean                   ->            ssl: boolean
  }                                            }
}                                            }

TypeScript type transformation:              DeepResolve<T>
Runtime transformation:                      resolveAll(config, opts)
```

---

## Step 8: How nested objects work in detail

The recursive walk handles arbitrary depth. Here is a more deeply nested example:

```ts
const complexConfig = {
  app: {
    name: "billing",
    server: {
      host: vars.string("billing.host"),
      port: vars.number("billing.port", { default: 443 }),
      tls: {
        enabled: true,
        certPath: vars.string("billing.tls.cert_path"),
      },
    },
  },
  replicas: vars.number("billing.replicas", { default: 1 }),
  tags: ["billing", "production"],
};
```

The `deepResolve` walk proceeds like this:

```
deepResolve(complexConfig)
  -> is it a VariableRef? No. Is it an array? No. Is it an object? Yes.
  -> recurse into each property:

  deepResolve(complexConfig.app)
    -> object, recurse:

    deepResolve("billing")
      -> primitive string, return "billing"

    deepResolve(complexConfig.app.server)
      -> object, recurse:

      deepResolve(vars.string("billing.host"))
        -> IS a VariableRef! call resolve(ref, opts) -> "billing.prod.internal"

      deepResolve(vars.number("billing.port", { default: 443 }))
        -> IS a VariableRef! call resolve(ref, opts) -> 443 (default, if env not set)

      deepResolve(complexConfig.app.server.tls)
        -> object, recurse:

        deepResolve(true)
          -> primitive boolean, return true

        deepResolve(vars.string("billing.tls.cert_path"))
          -> IS a VariableRef! call resolve(ref, opts) -> "/etc/ssl/billing.pem"

  deepResolve(vars.number("billing.replicas", { default: 1 }))
    -> IS a VariableRef! call resolve(ref, opts) -> 1

  deepResolve(["billing", "production"])
    -> is it an array? Yes.
    -> recurse into each element:
      deepResolve("billing") -> "billing"
      deepResolve("production") -> "production"
    -> return ["billing", "production"]
```

Final result:

```ts
{
  app: {
    name: "billing",
    server: {
      host: "billing.prod.internal",
      port: 443,
      tls: {
        enabled: true,
        certPath: "/etc/ssl/billing.pem",
      },
    },
  },
  replicas: 1,
  tags: ["billing", "production"],
}
```

Every `VariableRef` has been replaced. Every plain value has been passed through. The structure is identical.

---

## Step 9: Using `DeepResolve<T>` in adapter function signatures

Adapters can choose how to type their inputs. Two approaches:

### Approach A: Adapter defines its own plain interface (decoupled)

```ts
// The adapter defines its own types — no dependency on @synthing/variable
interface BillingConfig {
  app: { name: string; server: { host: string; port: number; tls: { enabled: boolean; certPath: string } } };
  replicas: number;
  tags: string[];
}

export function renderBilling(config: BillingConfig) { ... }
```

### Approach B: Adapter uses DeepResolve to derive the type (co-located)

```ts
import type { DeepResolve } from "@synthing/variable";
import type { complexConfig } from "./my-billing-config.js";

// The adapter's input type is derived directly from the config definition.
// This guarantees the adapter always matches the config shape.
type BillingConfig = DeepResolve<typeof complexConfig>;

export function renderBilling(config: BillingConfig) { ... }
```

Approach A gives full decoupling (the adapter package never imports `@synthing/variable`, not even as a type). Approach B gives automatic type synchronization — if a new field is added to the config, the adapter's type updates automatically. Both are valid; the choice depends on how tightly coupled the adapter should be.

---

## Step 10: Error behavior

When `resolveAll()` encounters a ref that cannot be resolved (no resolver has a value, no default provided), it follows Decision #9 (throw typed errors).

```ts
const config = {
  port: vars.number("app_port"),           // no default, no env var set
  host: vars.string("app_host"),           // no default, no env var set
  debug: vars.boolean("debug", { default: false }),  // has default, fine
};

await resolveAll(config, { resolvers: [envResolver] });

// Option 1: Fail-fast — throws on first unresolvable ref:
//   VariableResolutionError: No value found for variable "app_port" and no default provided
//
// Option 2: Aggregate — collects all failures and throws once:
//   AggregateVariableError: 2 variables failed to resolve
//     - "app_port": No value found and no default provided
//     - "app_host": No value found and no default provided
//
// (Decision #11 chose resolveAll as primary, which naturally supports aggregate errors.)
```

---

## Summary: Why this is called "resolve-at-boundary"

The variable system has two distinct phases:

1. **Definition phase** — user writes config objects mixing plain values and `VariableRef` instances. No resolution happens. Types contain `VariableRef<T>`.

2. **Boundary phase** — a single `resolveAll()` call transforms the entire tree. After this point, all types are plain. The adapter receives a plain object and has no dependency on `@synthing/variable`.

The "boundary" is the line between "config with unresolved variables" and "config with concrete values." It happens exactly once, in one place, and it is the only place in the codebase that needs access to resolvers. Everything downstream is pure data.
