# TODO List for Milestone 2

## Batch 1: Package Scaffolding and Core Interfaces

- [x] task-1: Scaffold new packages (synthing, @synthing/toolkit, @synthing/plugin-env)
- [x] task-2: Implement @synthing/core interfaces (BaseConnector, BaseGenerator, error types, shared types)
- [x] task-3: Implement @synthing/toolkit coercion utilities (coerceFromString)
- [x] task-4: Implement VariableManager with builder pattern, $var branded refs, and $spread helper
- [x] task-5: Implement EnvConnector in @synthing/plugin-env

## Batch 2: Engine, Generators, and Pipeline (planned, not yet detailed)

- [ ] task-6: Implement resolution engine (tag scanning, resolve, resolveAll, strict/loose mode)
- [ ] task-7: Implement YamlGenerator and GeneratorContext
- [ ] task-8: Implement generator pipeline runner
- [ ] task-9: Implement text pipeline (plain text and structural modes)
- [ ] task-10: Implement $spread resolution in structural mode

## Batch 3: CLI, Config, Integration, and Acceptance (planned, not yet detailed)

- [ ] task-11: Implement defineConfig() and config loading
- [ ] task-12: Implement CLI (synthing generate, synthing variable export-schema)
- [ ] task-13: Write integration tests and kubricate workflow tests
- [ ] task-14: Full acceptance verification against all criteria
