# Decision 11: Batch Resolve vs Per-Reference Resolve

## The Question

When adapter code has multiple variable references, how does the developer turn those references into actual values?

There are two approaches:

- **Option A: Per-reference resolve** — call `resolve()` once per variable, get one value back
- **Option B: Batch resolve** — call `resolveAll()` once with ALL variable references, get all values back at once

Below is a complete end-to-end example for each option. Both examples share the same setup: same registry, same adapter code, same env resolver. The ONLY difference is the resolve step.

---

## Shared Setup (identical for both options)

### Registry definition

```ts
// variables.ts
import { defineVariables } from "@synthing/variable";

export const variableRegistry = defineVariables({
  cache_time: {
    type: "number",
    description: "Cache duration in seconds",
    min: 0,
    max: 3600,
  },
  api_url: {
    type: "string",
    description: "Backend API URL",
  },
  feature_enabled: {
    type: "boolean",
    description: "Enable new feature",
  },
});
```

### Variable references in adapter code

```ts
// my-deployment.ts
import { vars } from "@synthing/variable";

// These are just lightweight reference objects — no values yet.
// Decision #1: deferred reference.
const cacheTime      = vars.number("cache_time", { default: 5 });
const apiUrl         = vars.string("api_url");
const featureEnabled = vars.boolean("feature_enabled", { default: false });
```

### Resolver setup

```ts
// resolvers.ts
import { createEnvResolver } from "@synthing/variable-plugin-env";

// Suppose the environment has:
//   CACHE_TIME=120
//   API_URL=https://prod.example.com
//   (FEATURE_ENABLED is NOT set)

const envResolver = createEnvResolver();
```

---

## Option A: Per-Reference Resolve

### What the API looks like

```ts
// resolve() takes ONE ref, returns ONE value.
async function resolve<T>(ref: VariableRef<T>, opts: ResolveOptions): Promise<T>;
```

### Full adapter render flow

```ts
// render.ts — this is the adapter's render function
import { resolve } from "@synthing/variable";
import { cacheTime, apiUrl, featureEnabled } from "./my-deployment.js";
import { envResolver } from "./resolvers.js";

async function renderDeployment() {
  const resolvers = { resolvers: [envResolver] };

  // Resolve each variable individually
  const cache = await resolve(cacheTime, resolvers);
  //    ^? number — returns 120 (from env, coerced from string "120")

  const url = await resolve(apiUrl, resolvers);
  //    ^? string — returns "https://prod.example.com" (from env)

  const flag = await resolve(featureEnabled, resolvers);
  //    ^? boolean — returns false (env has no value, falls back to default)

  // Now use the resolved values to build the deployment manifest
  return {
    kind: "Deployment",
    spec: {
      containers: [{
        env: [
          { name: "CACHE_TIME", value: String(cache) },
          { name: "API_URL", value: url },
          { name: "FEATURE_ENABLED", value: String(flag) },
        ],
      }],
    },
  };
}
```

### What happens step by step

```
resolve(cacheTime, resolvers)
  1. Walk resolvers: [envResolver]
  2. envResolver.get("cache_time", "number")
     -> reads process.env.CACHE_TIME = "120"
     -> coerceFromString("cache_time", "120", "number") -> 120
     -> returns 120
  3. Type-check: typeof 120 === "number" -> pass
  4. Return 120

resolve(apiUrl, resolvers)
  1. Walk resolvers: [envResolver]
  2. envResolver.get("api_url", "string")
     -> reads process.env.API_URL = "https://prod.example.com"
     -> coerceFromString (string -> string, no-op)
     -> returns "https://prod.example.com"
  3. Type-check: typeof "https://..." === "string" -> pass
  4. Return "https://prod.example.com"

resolve(featureEnabled, resolvers)
  1. Walk resolvers: [envResolver]
  2. envResolver.get("feature_enabled", "boolean")
     -> reads process.env.FEATURE_ENABLED = undefined
     -> returns undefined
  3. No resolver had a value. Check default: false
  4. Return false
```

### What error handling looks like

```ts
async function renderDeployment() {
  const resolvers = { resolvers: [envResolver] };

  try {
    const cache = await resolve(cacheTime, resolvers);
    const url = await resolve(apiUrl, resolvers);
    const flag = await resolve(featureEnabled, resolvers);
    return buildManifest(cache, url, flag);
  } catch (err) {
    // You know exactly which variable failed because
    // the error is thrown during THAT specific resolve() call.
    // Your stack trace points to the exact line.
    console.error("Failed to resolve variable:", err);
    throw err;
  }
}
```

---

## Option B: Batch Resolve

### What the API looks like

```ts
// resolveAll() takes a MAP of refs, returns a MAP of values.
// The keys are arbitrary labels you choose — they become the keys in the result.
async function resolveAll<T extends Record<string, VariableRef>>(
  refs: T,
  opts: ResolveOptions,
): Promise<ResolvedValues<T>>;
// ResolvedValues<T> maps each key to the correct type based on the ref's type.
```

### Full adapter render flow

```ts
// render.ts — this is the adapter's render function
import { resolveAll } from "@synthing/variable";
import { cacheTime, apiUrl, featureEnabled } from "./my-deployment.js";
import { envResolver } from "./resolvers.js";

async function renderDeployment() {
  const resolvers = { resolvers: [envResolver] };

  // Resolve ALL variables in one call
  const values = await resolveAll({
    cache: cacheTime,
    url: apiUrl,
    flag: featureEnabled,
  }, resolvers);

  // values.cache -> number (120)
  // values.url   -> string ("https://prod.example.com")
  // values.flag  -> boolean (false)

  // Now use the resolved values to build the deployment manifest
  return {
    kind: "Deployment",
    spec: {
      containers: [{
        env: [
          { name: "CACHE_TIME", value: String(values.cache) },
          { name: "API_URL", value: values.url },
          { name: "FEATURE_ENABLED", value: String(values.flag) },
        ],
      }],
    },
  };
}
```

### What happens step by step

```
resolveAll({ cache: cacheTime, url: apiUrl, flag: featureEnabled }, resolvers)

  Internally, resolveAll iterates over all entries:

  For "cache" (cacheTime):
    1. Walk resolvers: [envResolver]
    2. envResolver.get("cache_time", "number") -> 120
    3. Type-check: pass
    4. Store result: { cache: 120 }

  For "url" (apiUrl):
    1. Walk resolvers: [envResolver]
    2. envResolver.get("api_url", "string") -> "https://prod.example.com"
    3. Type-check: pass
    4. Store result: { cache: 120, url: "https://prod.example.com" }

  For "flag" (featureEnabled):
    1. Walk resolvers: [envResolver]
    2. envResolver.get("feature_enabled", "boolean") -> undefined
    3. Fall back to default: false
    4. Store result: { cache: 120, url: "https://prod.example.com", flag: false }

  Return the complete result object.
```

### What error handling looks like

```ts
async function renderDeployment() {
  const resolvers = { resolvers: [envResolver] };

  try {
    const values = await resolveAll({
      cache: cacheTime,
      url: apiUrl,
      flag: featureEnabled,
    }, resolvers);
    return buildManifest(values.cache, values.url, values.flag);
  } catch (err) {
    // OPTION B-1: Fail on first error (same as per-ref, but inside resolveAll)
    //   You get one error. You know which variable failed from the error message,
    //   but the stack trace points to the resolveAll() line, not a specific variable.

    // OPTION B-2: Collect all errors, report them together
    //   resolveAll could collect ALL failures and throw an AggregateError:
    //   AggregateError: 2 variables failed to resolve
    //     - "api_url": No value found and no default provided
    //     - "cache_time": Cannot coerce "hello" to number
    console.error("Failed to resolve variables:", err);
    throw err;
  }
}
```

---

## Side-by-Side Comparison

### Daily usage pattern

```ts
// ---- Option A: Per-reference ----
const cache = await resolve(cacheTime, resolvers);
const url   = await resolve(apiUrl, resolvers);
const flag  = await resolve(featureEnabled, resolvers);
// Three awaits, three chances to fail individually.
// Each variable is independently typed: cache is number, url is string, etc.

// ---- Option B: Batch ----
const v = await resolveAll({ cache: cacheTime, url: apiUrl, flag: featureEnabled }, resolvers);
// One await, one result object.
// v.cache is number, v.url is string, v.flag is boolean (same type safety).
```

### Adding a new variable

```ts
// ---- Option A: Per-reference ----
// Add one more line:
const maxRetries = await resolve(vars.number("max_retries", { default: 3 }), resolvers);

// ---- Option B: Batch ----
// Add it to the object:
const v = await resolveAll({
  cache: cacheTime,
  url: apiUrl,
  flag: featureEnabled,
  maxRetries: vars.number("max_retries", { default: 3 }),  // add here
}, resolvers);
```

### When a resolver is async (e.g., database lookup)

```ts
// ---- Option A: Per-reference ----
// Each resolve() is a separate async call. If the resolver hits a database,
// that's 3 separate DB queries (one per variable).
// You CAN parallelize manually:
const [cache, url, flag] = await Promise.all([
  resolve(cacheTime, resolvers),
  resolve(apiUrl, resolvers),
  resolve(featureEnabled, resolvers),
]);
// But you have to remember to do this. If you forget, it's sequential.

// ---- Option B: Batch ----
// resolveAll() can internally optimize: it could call the resolver once
// with all keys (if the resolver supports batch fetching), or at minimum
// run all resolve calls in parallel via Promise.all automatically.
const v = await resolveAll({ cache: cacheTime, url: apiUrl, flag: featureEnabled }, resolvers);
// The optimization is handled for you.
```

---

## Tradeoffs

| Aspect | Option A: Per-Reference | Option B: Batch |
|---|---|---|
| **Simplicity** | Simpler API — one function, one value | Slightly more complex — object-in, object-out |
| **Error pinpointing** | Stack trace points to exact line | Stack trace points to resolveAll() call |
| **Aggregate errors** | Not built-in (you get one error at a time) | Natural fit for "show all failures at once" |
| **Async performance** | Sequential by default, manual Promise.all | Can auto-parallelize internally |
| **Type inference** | Straightforward: resolve returns T | Requires mapped types (more complex internally, but same DX) |
| **Incremental adoption** | Easy to add one variable at a time | Must add to the batch object |
| **Code readability** | Each variable is its own line | All variables grouped in one block |
| **Implementation cost** | Minimal | Moderate (mapped types, error aggregation) |

---

## Important Note

These options are NOT mutually exclusive. The most common pattern in libraries like this is:

- Implement `resolve()` (per-ref) as the primitive
- Implement `resolveAll()` as a convenience wrapper that calls `resolve()` internally

```ts
// resolveAll is just sugar over resolve:
async function resolveAll(refs, opts) {
  const entries = Object.entries(refs);
  const results = await Promise.all(
    entries.map(([key, ref]) => resolve(ref, opts).then(val => [key, val]))
  );
  return Object.fromEntries(results);
}
```

So the real question is: **should we ship resolveAll() in Phase 1, or is resolve() alone sufficient?**
