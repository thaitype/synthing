# Option C: Shared Coercion Utilities — Complete TypeScript Example

This document shows how Option C (shared coercion utilities, resolver applies them) works end-to-end.

**Design**: Core exports coercion helpers. Resolvers that need them (env) import and use them. Resolvers that don't need them (JSON) skip them. Core `resolve()` does a final type-check on the returned value regardless.

---

## File 1: `@synthing/variable` — Core coercion utilities

```ts
// packages/variable/src/coerce.ts

/**
 * Coercion utilities exported by core.
 * Resolvers MAY use these — they are helpers, not mandatory.
 */

export type VariableType = 'string' | 'number' | 'boolean';

export class CoercionError extends Error {
  constructor(
    public readonly key: string,
    public readonly rawValue: unknown,
    public readonly targetType: VariableType,
  ) {
    super(`Cannot coerce "${key}" value ${JSON.stringify(rawValue)} to ${targetType}`);
    this.name = 'CoercionError';
  }
}

/**
 * Attempt to coerce a raw string value to the declared type.
 * Returns the coerced value, or throws CoercionError.
 *
 * This is intentionally string-in only — it exists for resolvers
 * whose source is inherently string-based (env vars, CLI args).
 */
export function coerceFromString(key: string, raw: string, type: VariableType): string | number | boolean {
  switch (type) {
    case 'string':
      return raw;

    case 'number': {
      const n = Number(raw);
      if (Number.isNaN(n)) {
        throw new CoercionError(key, raw, 'number');
      }
      return n;
    }

    case 'boolean': {
      const lower = raw.toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
      throw new CoercionError(key, raw, 'boolean');
    }

    default:
      throw new CoercionError(key, raw, type);
  }
}
```

---

## File 2: `@synthing/variable` — Core types and resolve()

```ts
// packages/variable/src/types.ts

import type { VariableType } from './coerce.js';

/** What vars.number() / vars.string() / vars.boolean() returns */
export interface VariableRef<T = unknown> {
  readonly __brand: 'VariableRef';
  readonly key: string;
  readonly type: VariableType;
  readonly default?: T;
}

/** A resolver plugin returns the raw resolved value (already typed correctly, or string if string-based source) */
export interface VariableResolverPlugin {
  readonly name: string;
  get(key: string, type: VariableType): Promise<unknown | undefined>;
}

/** Type map from VariableType string to TS type */
export interface TypeMap {
  string: string;
  number: number;
  boolean: boolean;
}
```

```ts
// packages/variable/src/resolve.ts

import type { VariableRef, VariableResolverPlugin, TypeMap } from './types.js';
import type { VariableType } from './coerce.js';

export class TypeCheckError extends Error {
  constructor(
    public readonly key: string,
    public readonly expected: VariableType,
    public readonly actual: string,
  ) {
    super(`Type check failed for "${key}": expected ${expected}, got ${actual} (${typeof actual === 'string' ? `"${actual}"` : actual})`);
    this.name = 'TypeCheckError';
  }
}

/**
 * Core type-check. Runs AFTER the resolver returns a value.
 * This is the safety net — it doesn't coerce, it rejects.
 */
function assertType(key: string, value: unknown, type: VariableType): void {
  const actual = typeof value;
  if (actual !== type) {
    throw new TypeCheckError(key, type, actual);
  }
}

export interface ResolveOptions {
  /** Ordered resolver list. First match wins. */
  resolvers: VariableResolverPlugin[];
}

/**
 * Resolve a single variable ref.
 * Always async (decision #2).
 * Explicit priority list, first match wins (decision #7).
 * Final type-check ensures type guarantee (decision #5).
 */
export async function resolve<T extends VariableType>(
  ref: VariableRef<TypeMap[T]>,
  options: ResolveOptions,
): Promise<TypeMap[T]> {
  // Walk resolvers in priority order
  for (const resolver of options.resolvers) {
    const value = await resolver.get(ref.key, ref.type);
    if (value !== undefined) {
      // Final type-check — the resolver is responsible for coercion,
      // core just verifies the result is the right type.
      assertType(ref.key, value, ref.type);
      return value as TypeMap[T];
    }
  }

  // Fall back to call-site default
  if (ref.default !== undefined) {
    return ref.default;
  }

  throw new Error(`No value found for variable "${ref.key}" and no default provided`);
}
```

---

## File 3: `@synthing/variable` — Variable reference constructors

```ts
// packages/variable/src/vars.ts

import type { VariableRef } from './types.js';

// Decision #3: vars derived from registry (compile-time type-checked keys).
// For this example we show the simple version; the registry-bound version
// would be a generic function that constrains keys to registry entries.

function createRef<T>(key: string, type: 'string' | 'number' | 'boolean', defaultValue?: T): VariableRef<T> {
  return {
    __brand: 'VariableRef' as const,
    key,
    type,
    default: defaultValue,
  };
}

/** Decision #1: returns VariableRef, not a value */
export const vars = {
  string: (key: string, opts?: { default?: string }) =>
    createRef<string>(key, 'string', opts?.default),

  number: (key: string, opts?: { default?: number }) =>
    createRef<number>(key, 'number', opts?.default),

  boolean: (key: string, opts?: { default?: boolean }) =>
    createRef<boolean>(key, 'boolean', opts?.default),
};
```

---

## File 4: `@synthing/variable` — Public API barrel

```ts
// packages/variable/src/index.ts

export { vars } from './vars.js';
export { resolve } from './resolve.js';
export { coerceFromString, CoercionError } from './coerce.js';
export type { VariableRef, VariableResolverPlugin, TypeMap } from './types.js';
export type { VariableType } from './coerce.js';
```

---

## File 5: `@synthing/variable-plugin-env` — Env resolver (USES coercion)

```ts
// packages/variable-plugin-env/src/index.ts

import { coerceFromString } from '@synthing/variable';
import type { VariableResolverPlugin, VariableType } from '@synthing/variable';

export interface EnvResolverOptions {
  /** Optional prefix, e.g. "SYNTHING_" so "cache_time" maps to "SYNTHING_CACHE_TIME" */
  prefix?: string;
  /** Custom env source for testing. Defaults to process.env */
  env?: Record<string, string | undefined>;
}

export function createEnvResolver(options: EnvResolverOptions = {}): VariableResolverPlugin {
  const { prefix = '', env = process.env } = options;

  return {
    name: 'env',

    async get(key: string, type: VariableType): Promise<unknown | undefined> {
      const envKey = `${prefix}${key}`.toUpperCase();
      const raw = env[envKey];

      if (raw === undefined) {
        return undefined; // This resolver doesn't have it — let the next one try
      }

      // Env vars are always strings, so we MUST coerce.
      // We use core's shared coercion utility for consistent behavior.
      return coerceFromString(key, raw, type);
    },
  };
}
```

---

## File 6: `@synthing/variable-plugin-json` — JSON resolver (SKIPS coercion)

```ts
// packages/variable-plugin-json/src/index.ts

import type { VariableResolverPlugin, VariableType } from '@synthing/variable';
// Note: does NOT import coerceFromString — not needed

export interface JsonResolverOptions {
  /** Pre-parsed JSON data, e.g. from a config file or API response */
  data: Record<string, unknown>;
}

export function createJsonResolver(options: JsonResolverOptions): VariableResolverPlugin {
  return {
    name: 'json',

    async get(key: string, _type: VariableType): Promise<unknown | undefined> {
      const value = options.data[key];

      if (value === undefined) {
        return undefined;
      }

      // JSON already preserves native types.
      // A JSON number is already a number, a JSON boolean is already a boolean.
      // No coercion needed — just return the value as-is.
      // Core's resolve() will type-check it and reject if it's wrong.
      return value;
    },
  };
}
```

---

## File 7: End-to-end usage

```ts
// example/app.ts

import { vars, resolve } from '@synthing/variable';
import { createEnvResolver } from '@synthing/variable-plugin-env';
import { createJsonResolver } from '@synthing/variable-plugin-json';

// --- Setup resolvers (decision #7: explicit priority list, first match wins) ---

const envResolver = createEnvResolver({ prefix: 'APP_' });

const jsonResolver = createJsonResolver({
  data: {
    cache_time: 60,
    feature_enabled: true,
    api_url: 'https://api.example.com',
  },
});

const resolvers = { resolvers: [envResolver, jsonResolver] };

// --- Define variable refs (decision #1: deferred reference) ---

const cacheTime   = vars.number('cache_time', { default: 5 });
const featureFlag = vars.boolean('feature_enabled');
const apiUrl      = vars.string('api_url');

// --- Resolve (decision #2: always async) ---

async function main() {
  // Case 1: APP_CACHE_TIME=120 is set in env
  //   -> envResolver reads "120" (string), calls coerceFromString("cache_time", "120", "number") -> 120
  //   -> core resolve() type-checks: typeof 120 === "number" -> pass
  //   -> returns 120
  const cache = await resolve(cacheTime, resolvers);
  //    ^? number

  // Case 2: APP_FEATURE_ENABLED is NOT set in env
  //   -> envResolver returns undefined (not found)
  //   -> jsonResolver reads true (already a boolean) — no coercion needed
  //   -> core resolve() type-checks: typeof true === "boolean" -> pass
  //   -> returns true
  const flag = await resolve(featureFlag, resolvers);
  //    ^? boolean

  // Case 3: APP_API_URL is NOT set, JSON has the string
  //   -> envResolver returns undefined
  //   -> jsonResolver reads "https://api.example.com" (already a string)
  //   -> core resolve() type-checks: typeof "https://..." === "string" -> pass
  //   -> returns "https://api.example.com"
  const url = await resolve(apiUrl, resolvers);
  //    ^? string

  console.log({ cache, flag, url });
}

main();
```

---

## What happens on type mismatch

```ts
// Scenario: JSON file has the wrong type
const badResolver = createJsonResolver({
  data: { cache_time: 'not-a-number' },  // string instead of number
});

// resolve() calls badResolver.get("cache_time", "number")
//   -> returns "not-a-number" (a string, as-is)
//   -> core assertType: typeof "not-a-number" === "number"? NO
//   -> throws TypeCheckError:
//      'Type check failed for "cache_time": expected number, got string ("not-a-number")'
```

```ts
// Scenario: Env var has an un-parseable value
// APP_CACHE_TIME=hello
//   -> envResolver calls coerceFromString("cache_time", "hello", "number")
//   -> Number("hello") is NaN
//   -> throws CoercionError:
//      'Cannot coerce "cache_time" value "hello" to number'
//   -> This error surfaces INSIDE the resolver, before core even sees the value
```

---

## Summary of responsibilities

| Layer | Coercion? | Type-check? |
|---|---|---|
| `coerceFromString` (core utility) | Yes — string to target type | No |
| Env resolver plugin | Imports and calls `coerceFromString` | No |
| JSON resolver plugin | Skips coercion (native types) | No |
| `resolve()` (core) | Never coerces | Yes — final `typeof` gate |

The coercion utilities live in core so every string-based resolver uses the same rules. But core `resolve()` itself never coerces — it only verifies. This keeps the contract clean: resolvers are responsible for delivering correctly-typed values, and core is the safety net that catches mistakes.
