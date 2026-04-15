/**
 * BaseConnector — domain-agnostic abstract connector.
 * Two-phase interface: load once, get per-key.
 */
export abstract class BaseConnector {
  /**
   * Load / prepare values for the given keys.
   * Called once with all keys this connector might need (allows batch fetching).
   */
  abstract load(keys: string[]): Promise<void>;

  /**
   * Get a single value (sync, called per-key after load).
   * Returns the raw value or `undefined` when the key is not found.
   */
  abstract get(key: string): unknown | undefined;
}
