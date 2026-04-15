/**
 * Thrown when a variable cannot be resolved.
 *
 * For single-key failures: key + reason are set directly.
 * For batch resolveAll() failures: failures[] holds all individual errors.
 */
export class ResolutionError extends Error {
  readonly key: string;
  readonly reason: 'missing' | 'type_mismatch' | 'connector_error';
  readonly failures?: Array<{ key: string; reason: string }>;

  constructor(
    key: string,
    reason: 'missing' | 'type_mismatch' | 'connector_error',
    options?: {
      message?: string;
      failures?: Array<{ key: string; reason: string }>;
      cause?: unknown;
    }
  ) {
    const message = options?.message ?? `Resolution failed for key "${key}": ${reason}`;
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'ResolutionError';
    this.key = key;
    this.reason = reason;
    this.failures = options?.failures;
  }
}
