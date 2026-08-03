import type { Logger } from './context.js';

/**
 * BaseConnector — domain-agnostic connector contract.
 * Two-phase interface: load once, get per-key.
 *
 * Structural (interface, not abstract class) so a connector plugin's
 * installed @synthing/core copy doesn't need to be the same class
 * instance as the host's — avoids the dual-package hazard.
 */
export interface BaseConnector<Config extends object = object> {
  config: Config;
  logger?: Logger;

  /**
   * Load / prepare values for the given keys.
   * Called once with all keys this connector might need (allows batch fetching).
   */
  load(keys: string[]): Promise<void>;

  /**
   * Get a single value (sync, called per-key after load).
   * Returns the raw value or `undefined` when the key is not found.
   */
  get(key: string): unknown | undefined;

  /**
   * Optional — set the working directory for connectors that read local files
   * (e.g. EnvConnector's .env lookup). No-op if a connector doesn't need one.
   */
  setWorkingDir?(dir: string | undefined): void;

  /** Optional — get the working directory, if this connector supports one. */
  getWorkingDir?(): string | undefined;
}
