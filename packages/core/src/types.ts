/**
 * Branded string type representing a deferred variable reference.
 *
 * At runtime: a plain string containing "$${{key}}".
 * At compile time: TypeScript tracks the resolved type via the brand.
 *
 * Assignable to `string`, so it works anywhere strings are expected.
 */
export type VariableRef<T> = string & { __varRef: T; __key: string };

// ---------------------------------------------------------------------------
// Variable type definitions
// ---------------------------------------------------------------------------

/** Supported primitive variable types. */
export type VariableType = 'string' | 'number' | 'boolean' | 'object';

/**
 * Maps a VariableType literal to the corresponding TypeScript type.
 */
export type VariableTypeMap = {
  string: string;
  number: number;
  boolean: boolean;
  object: object | unknown[];
};

// ---------------------------------------------------------------------------
// Standard Schema minimal interface (subset used in variable schemas)
// ---------------------------------------------------------------------------

/**
 * Minimal Standard Schema interface.
 * @see https://standardschema.dev/
 */
export interface StandardSchema<T = unknown> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    validate(value: unknown): StandardSchemaResult<T> | Promise<StandardSchemaResult<T>>;
    readonly types?: { readonly input: T; readonly output: T } | undefined;
  };
}

export type StandardSchemaResult<T> =
  | { readonly value: T; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<{ readonly message: string }> };

// ---------------------------------------------------------------------------
// Variable schema options (used by VariableManager.addVariable)
// ---------------------------------------------------------------------------

/**
 * Options passed to VariableManager.addVariable().
 */
export interface VariableSchemaOptions<T extends VariableType = VariableType> {
  /** Primitive type — drives coercion. */
  type: T;
  /** Schema-level default value (lowest precedence). */
  default?: VariableTypeMap[T];
  /** Human-readable description. */
  description?: string;
  /** Mark the variable as a secret — redacted in logs and JSON output. */
  secret?: boolean;
  /** Optional Standard Schema for validation after coercion. */
  schema?: StandardSchema<VariableTypeMap[T]>;
}
