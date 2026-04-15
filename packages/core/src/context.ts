/**
 * Minimal logger interface.
 */
export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Context passed to BaseGenerator.render().
 */
export interface GeneratorContext {
  /** Directory where generated output files will be written. */
  outputDir: string;
  /** Logger instance for the current run. */
  logger: Logger;
}
