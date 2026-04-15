/**
 * @synthing/core — public API
 *
 * Interfaces and types only. No implementation logic.
 */

export { BaseConnector } from './connector.js';
export { BaseGenerator } from './generator.js';
export type { GeneratorOutput, SerializedOutput } from './generator.js';
export type { GeneratorContext, Logger } from './context.js';
export { ResolutionError } from './errors.js';
export type {
  VariableRef,
  VariableType,
  VariableTypeMap,
  VariableSchemaOptions,
  StandardSchema,
  StandardSchemaResult,
} from './types.js';
