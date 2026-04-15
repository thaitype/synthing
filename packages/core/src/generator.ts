import type { GeneratorContext } from './context.js';

/**
 * Output produced by BaseGenerator.render().
 * Content is an object (NOT a serialized string) — serialization happens in serialize().
 */
export interface GeneratorOutput {
  content: unknown;
}

/**
 * A single serialized file ready to be written to disk.
 */
export interface SerializedOutput {
  filename: string;
  content: string;
}

/**
 * BaseGenerator — abstract base for all generator implementations.
 *
 * Design notes:
 * - render() returns objects, NOT serialized strings.
 * - serialize() turns objects into file content strings.
 * - This mirrors kubricate's Stack → Renderer pattern.
 */
export abstract class BaseGenerator {
  /** Format identifier this generator produces (e.g. "yaml", "json"). */
  abstract readonly format: string;

  /**
   * Produce content objects for the given context.
   * Objects may contain $${{tag}} strings that the engine resolves after serialization.
   */
  abstract render(ctx: GeneratorContext): Promise<GeneratorOutput>;

  /**
   * Serialize objects into one or more output files.
   */
  abstract serialize(content: unknown): SerializedOutput[];
}
