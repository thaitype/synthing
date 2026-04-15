/**
 * synthing engine
 *
 * VariableManager, $var, resolution, GeneratorContext, pipeline runner, YamlGenerator.
 * No filesystem I/O, no arg parsing, no process.argv.
 */

export { VariableManager } from './variable-manager.js';
export type {
  VariableMeta,
  VariableMetaJSON,
  VariableManagerJSON,
  SpreadRef,
  VariableRefHelper,
} from './variable-manager.js';
