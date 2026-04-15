import { BaseConnector } from "@synthing/core";

export interface EnvConnectorOptions {
  prefix?: string;
}

/**
 * EnvConnector — reads values from `process.env`.
 *
 * Key mapping: variable key `"port"` with prefix `"APP_"` reads `process.env.APP_PORT`.
 * Without prefix: key `"port"` reads `process.env.PORT`.
 *
 * Implements the two-phase interface: `load()` once, `get()` per-key.
 */
export class EnvConnector extends BaseConnector {
  private readonly prefix: string;
  private readonly store = new Map<string, string | undefined>();

  constructor(options: EnvConnectorOptions = {}) {
    super();
    this.prefix = options.prefix ?? "";
  }

  private toEnvKey(key: string): string {
    return `${this.prefix}${key.toUpperCase()}`;
  }

  async load(keys: string[]): Promise<void> {
    for (const key of keys) {
      const envKey = this.toEnvKey(key);
      this.store.set(key, process.env[envKey]);
    }
  }

  get(key: string): string | undefined {
    return this.store.get(key);
  }
}
