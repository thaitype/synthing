/**
 * VariableManager — central variable declaration and reference system.
 *
 * Builder pattern with generic accumulation for type-safe key inference.
 * Connectors are stored in registration order (first registered = highest priority).
 */

import type {
  BaseConnector,
  VariableRef,
  VariableType,
  VariableTypeMap,
  VariableSchemaOptions,
} from '@synthing/core';

// ---------------------------------------------------------------------------
// Key validation
// ---------------------------------------------------------------------------

const KEY_REGEX = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/;

function validateKey(key: string): void {
  if (!KEY_REGEX.test(key)) {
    throw new Error(
      `Invalid variable key "${key}". Keys must match: ^[a-z][a-z0-9_]*(\\.[a-z0-9_]+)*$`
    );
  }
}

// ---------------------------------------------------------------------------
// Internal metadata stored per variable
// ---------------------------------------------------------------------------

export interface VariableMeta {
  key: string;
  type: VariableType;
  default?: unknown;
  description?: string;
  secret?: boolean;
  schema?: unknown;
}

// ---------------------------------------------------------------------------
// JSON output types
// ---------------------------------------------------------------------------

export interface VariableMetaJSON {
  key: string;
  type: VariableType;
  default?: unknown;
  description?: string;
  secret: boolean;
  /** Included only when schema supports Standard JSON Schema (~standard.jsonSchema). */
  jsonSchema?: unknown;
}

export interface VariableManagerJSON {
  variables: VariableMetaJSON[];
}

// ---------------------------------------------------------------------------
// $spread return type
// ---------------------------------------------------------------------------

export interface SpreadRef {
  key: '__synthing_spread';
  value: string;
}

// ---------------------------------------------------------------------------
// createRef() return type
// ---------------------------------------------------------------------------

export interface VariableRefHelper<TMap extends Record<string, VariableType>> {
  /**
   * Returns a VariableRef<T> for the given key.
   * Type T is inferred from the variable's declared type.
   */
  $var<K extends keyof TMap & string>(
    key: K,
    options?: { default?: VariableTypeMap[TMap[K]] }
  ): VariableRef<VariableTypeMap[TMap[K]]>;

  /**
   * Returns a spread ref for object-typed variables only.
   * Compile-time restricted to keys whose type is "object".
   */
  $spread<K extends { [P in keyof TMap]: TMap[P] extends 'object' ? P : never }[keyof TMap] & string>(
    key: K
  ): SpreadRef;
}

// ---------------------------------------------------------------------------
// VariableManager
// ---------------------------------------------------------------------------

/**
 * TMap maps key literals → VariableType literals.
 * Grows with each .addVariable() call via generic accumulation.
 */
export class VariableManager<TMap extends Record<string, VariableType> = Record<never, never>> {
  private readonly _variables: Map<string, VariableMeta> = new Map();
  private readonly _connectors: Array<{ name: string; connector: BaseConnector }> = [];
  /** Tracks call-site defaults to detect duplicates. key → default value */
  private readonly _callSiteDefaults: Map<string, unknown> = new Map();

  // -------------------------------------------------------------------------
  // Builder methods
  // -------------------------------------------------------------------------

  /**
   * Registers a variable. Key is validated immediately.
   * Throws on invalid key or duplicate key.
   */
  addVariable<K extends string, T extends VariableType>(
    key: K,
    schema: VariableSchemaOptions<T>
  ): VariableManager<TMap & Record<K, T>> {
    validateKey(key);

    if (this._variables.has(key)) {
      throw new Error(`Duplicate variable key: "${key}"`);
    }

    this._variables.set(key, {
      key,
      type: schema.type,
      default: schema.default,
      description: schema.description,
      secret: schema.secret,
      schema: schema.schema,
    });

    // Return `this` cast to the wider type (generic accumulation).
    return this as unknown as VariableManager<TMap & Record<K, T>>;
  }

  /**
   * Registers a connector in priority order (first registered = highest priority).
   */
  addConnector(name: string, connector: BaseConnector): this {
    this._connectors.push({ name, connector });
    return this;
  }

  // -------------------------------------------------------------------------
  // createRef()
  // -------------------------------------------------------------------------

  /**
   * Returns `{ $var, $spread }` bound to this manager's variable declarations.
   */
  createRef(): VariableRefHelper<TMap> {
    const variables = this._variables;
    const callSiteDefaults = this._callSiteDefaults;

    const $var = <K extends keyof TMap & string>(
      key: K,
      options?: { default?: VariableTypeMap[TMap[K]] }
    ): VariableRef<VariableTypeMap[TMap[K]]> => {
      if (!variables.has(key)) {
        throw new Error(`Unknown variable key: "${key}"`);
      }

      if (options !== undefined && 'default' in options && options.default !== undefined) {
        if (callSiteDefaults.has(key)) {
          throw new Error(
            `Duplicate call-site default for variable "${key}". Each key may have at most one call-site default.`
          );
        }
        callSiteDefaults.set(key, options.default);
      }

      // Runtime: plain tagged string. Compile-time: branded VariableRef<T>.
      // Build "$${{key}}" using concatenation to avoid template literal parsing issues.
      return ('$${{' + key + '}}') as unknown as VariableRef<VariableTypeMap[TMap[K]]>;
    };

    type ObjectKeys = {
      [P in keyof TMap]: TMap[P] extends 'object' ? P : never;
    }[keyof TMap] &
      string;

    const $spread = <K extends ObjectKeys>(key: K): SpreadRef => {
      if (!variables.has(key)) {
        throw new Error(`Unknown variable key: "${key}"`);
      }

      return {
        key: '__synthing_spread',
        value: '$${{...' + key + '}}',
      };
    };

    return { $var, $spread } as VariableRefHelper<TMap>;
  }

  // -------------------------------------------------------------------------
  // toJSON()
  // -------------------------------------------------------------------------

  /**
   * Serializes variable metadata.
   * Secret variables have their default value redacted.
   */
  toJSON(): VariableManagerJSON {
    const variables: VariableMetaJSON[] = [];

    for (const meta of this._variables.values()) {
      const isSecret = meta.secret === true;

      // Check for Standard JSON Schema support on the schema object.
      let jsonSchema: unknown;
      if (meta.schema !== null && meta.schema !== undefined) {
        const s = meta.schema as Record<string, unknown>;
        const std = s['~standard'] as Record<string, unknown> | undefined;
        if (std && typeof std['jsonSchema'] !== 'undefined') {
          jsonSchema = std['jsonSchema'];
        }
      }

      const entry: VariableMetaJSON = {
        key: meta.key,
        type: meta.type,
        secret: isSecret,
      };

      if (meta.default !== undefined) {
        entry.default = isSecret ? '[REDACTED]' : meta.default;
      }

      if (meta.description !== undefined) {
        entry.description = meta.description;
      }

      if (jsonSchema !== undefined) {
        entry.jsonSchema = jsonSchema;
      }

      variables.push(entry);
    }

    return { variables };
  }

  // -------------------------------------------------------------------------
  // Internal accessors (for use by resolution layer in task-6)
  // -------------------------------------------------------------------------

  /** @internal */
  getVariables(): ReadonlyMap<string, VariableMeta> {
    return this._variables;
  }

  /** @internal */
  getConnectors(): ReadonlyArray<{ name: string; connector: BaseConnector }> {
    return this._connectors;
  }

  /** @internal */
  getCallSiteDefaults(): ReadonlyMap<string, unknown> {
    return this._callSiteDefaults;
  }
}
