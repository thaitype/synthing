import path from "node:path";

import { config as loadDotenv } from "dotenv";

import { type BaseConnector, type Logger } from "@synthing/core";

import { maskingValue } from "./utils.js";

export interface EnvConnectorConfig {
  /**
   * The prefix to use for environment variables.
   */
  prefix?: string;

  /**
   * Populate process.env with the contents of a .env file.
   * @default true
   */
  allowDotEnv?: boolean;

  /**
   * Whether to perform case-insensitive lookups for environment variables.
   * If true, the connector will match environment variable names in a case-insensitive manner.
   * @default true
   */
  caseInsensitive?: boolean;

  /**
   * The working directory to load the .env file from.
   * @default process.cwd()
   */
  workingDir?: string;

  /**
   * Whether to mask values when logging them.
   * The connector has no visibility into which keys are declared secrets
   * (that's a VariableManager-level concern), so it masks everything
   * indiscriminately by default rather than guessing.
   * @default true
   */
  maskValues?: boolean;
}

/**
 * EnvConnector — reads variables/secrets from `process.env`,
 * optionally loading from a .env file and supporting configurable
 * prefixes and case-insensitive lookups.
 *
 * Key mapping: variable key `"port"` with prefix `"APP_"` looks for
 * `process.env.APP_port`, matched case-insensitively by default — so
 * `APP_PORT`, `APP_port`, etc. all resolve the same key.
 *
 * Returns raw string values only. No coercion or parsing happens here —
 * that's the engine's job via @synthing/toolkit's `coerceFromString()`,
 * which is the only component that knows a key's declared type.
 *
 * Implements the two-phase interface: `load()` once, `get()` per-key.
 */
export class EnvConnector implements BaseConnector<EnvConnectorConfig> {
  public config: EnvConnectorConfig;
  private prefix: string;
  private values = new Map<string, string>();
  private caseInsensitive: boolean;
  private maskValues: boolean;
  public logger?: Logger;
  private workingDir?: string;

  constructor(config: EnvConnectorConfig = {}) {
    this.config = config;
    this.prefix = config.prefix ?? "";
    this.caseInsensitive = config.caseInsensitive ?? true;
    this.maskValues = config.maskValues ?? true;
    this.workingDir = config.workingDir;
  }

  /**
   * Set the working directory for loading .env files.
   */
  setWorkingDir(dir: string | undefined): void {
    this.workingDir = dir;
  }

  /**
   * Get the working directory for loading .env files.
   */
  getWorkingDir(): string | undefined {
    return this.workingDir;
  }

  getEnvFilePath(): string {
    return path.join(this.workingDir ?? process.cwd(), ".env");
  }

  normalizeName(name: string): string {
    return this.caseInsensitive ? name.toLowerCase() : name;
  }

  /**
   * Load values from environment variables.
   * @param keys The names of the values to load.
   * @throws Will throw an error if a required env var is missing.
   */
  async load(keys: string[]): Promise<void> {
    if (this.config.allowDotEnv ?? true) {
      loadDotenv({ path: this.getEnvFilePath() });
      this.logger?.info(`Loaded .env file from ${this.getEnvFilePath()}`);
    }

    for (const key of keys) {
      this.logger?.info(`Loading value: ${key}`);
      const expectedKey = this.prefix + key;

      const matchKey = this.caseInsensitive
        ? Object.keys(process.env).find(
            (k) => this.normalizeName(k) === this.normalizeName(expectedKey)
          )
        : expectedKey;

      if (!matchKey || !process.env[matchKey]) {
        throw new Error(`Missing environment variable: ${expectedKey}`);
      }

      const rawValue = process.env[matchKey];
      const storeKey = this.normalizeName(key);
      this.values.set(storeKey, rawValue);
      this.logger?.info(`Loaded value: ${key} -> ${storeKey}`);
      this.logger?.info(
        `Value: ${this.maskValues ? maskingValue(rawValue) : rawValue}`
      );
    }
  }

  /**
   * Get the raw string value of a loaded key.
   * @param key The name of the value.
   * @throws Will throw if the value was not loaded (did you call load()?).
   */
  get(key: string): string {
    const storeKey = this.normalizeName(key);
    if (!this.values.has(storeKey)) {
      throw new Error(`Secret '${key}' not loaded. Did you call load()?`);
    }
    return this.values.get(storeKey)!;
  }
}
