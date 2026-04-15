import path from "node:path";

import { config as loadDotenv } from "dotenv";

import { BaseConnector, type Logger } from "@synthing/core";

/**
 * SecretValue — the resolved value of a secret.
 * Can be a raw string or a flat JSON object (string/number/boolean/null values).
 */
export type SecretValue =
  | string
  | Record<string, string | number | boolean | null>;

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
   * @default false
   */
  caseInsensitive?: boolean;

  /**
   * The working directory to load the .env file from.
   * @default process.cwd()
   */
  workingDir?: string;
}

/**
 * EnvConnector — reads secrets/variables from `process.env`,
 * optionally loading from a .env file and supporting configurable
 * prefixes and case-insensitive lookups.
 *
 * Key mapping: variable key `"port"` with prefix `"APP_"` reads `process.env.APP_port`.
 * (No uppercase transform — the key is used as-is.)
 *
 * Implements the two-phase interface: `load()` once, `get()` per-key.
 */
export class EnvConnector extends BaseConnector {
  public config: EnvConnectorConfig;
  private prefix: string;
  private secrets = new Map<string, SecretValue>();
  private caseInsensitive: boolean;
  public logger?: Logger;
  private workingDir?: string;

  constructor(config: EnvConnectorConfig = {}) {
    super();
    this.config = config;
    this.prefix = config.prefix ?? "";
    this.caseInsensitive = config.caseInsensitive ?? false;
    this.workingDir = config.workingDir;
  }

  /**
   * Set the working directory for loading .env files.
   */
  setWorkingDir(dir: string): void {
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
   * Load secrets from environment variables.
   * @param keys The names of the secrets to load.
   * @throws Will throw an error if a required env var is missing.
   */
  async load(keys: string[]): Promise<void> {
    if (this.config.allowDotEnv ?? true) {
      loadDotenv({ path: this.getEnvFilePath() });
      this.logger?.info(`Loaded .env file from ${this.getEnvFilePath()}`);
    }

    for (const key of keys) {
      this.logger?.info(`Loading secret: ${key}`);
      const expectedKey = this.prefix + key;

      const matchKey = this.caseInsensitive
        ? Object.keys(process.env).find(
            (k) => this.normalizeName(k) === this.normalizeName(expectedKey)
          )
        : expectedKey;

      if (!matchKey || !process.env[matchKey]) {
        throw new Error(`Missing environment variable: ${expectedKey}`);
      }

      const storeKey = this.normalizeName(key);
      this.secrets.set(storeKey, this.tryParseSecretValue(process.env[matchKey]));
      this.logger?.info(`Loaded secret: ${key} -> ${storeKey}`);
    }
  }

  /**
   * Parse a raw env var string into a SecretValue.
   * Attempts to parse flat JSON objects; otherwise returns raw string.
   */
  tryParseSecretValue(value: string): SecretValue {
    try {
      const parsed = JSON.parse(value);

      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed) &&
        Object.values(parsed).every(
          (v) =>
            typeof v === "string" ||
            typeof v === "number" ||
            typeof v === "boolean" ||
            v === null
        )
      ) {
        return parsed;
      }

      return value;
    } catch {
      return value;
    }
  }

  /**
   * Get the value of a loaded secret.
   * @param key The name of the secret.
   * @throws Will throw if the secret was not loaded (did you call load()?).
   */
  override get(key: string): SecretValue {
    const storeKey = this.normalizeName(key);
    if (!this.secrets.has(storeKey)) {
      throw new Error(`Secret '${key}' not loaded. Did you call load()?`);
    }
    return this.secrets.get(storeKey)!;
  }
}
