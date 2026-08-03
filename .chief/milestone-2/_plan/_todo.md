# TODO List for Milestone 2

## Batch 1: Package Scaffolding and Core Interfaces

- [x] task-1: Scaffold new packages (synthing, @synthing/toolkit, @synthing/plugin-env)
- [x] task-2: Implement @synthing/core interfaces (BaseConnector, BaseGenerator, error types, shared types)
- [x] task-3: Implement @synthing/toolkit coercion utilities (coerceFromString)
- [x] task-4: Implement VariableManager with builder pattern, $var branded refs, and $spread helper
- [x] task-5: Implement EnvConnector in @synthing/plugin-env

## Batch 1.5: EnvConnector Realignment (blocks Batch 2 — resolution engine depends on the coercion boundary this batch locks in)

Handoff from the grilling session recorded in `.chief/milestone-2/_goal/design-spec.md` §14 (decisions 94–99) and `.chief/milestone-2/_contract/base-connector-contract.md`. Batch 1 shipped `EnvConnector` with behavior that drifted from its own task spec (task-5.md said "uppercase transform"; the shipped code does exact-case matching) and carried over kubricate mechanisms (`SecretValue`, `tryParseSecretValue`) that don't fit synthing's architecture. This batch reconciles code, contract, and docs before Batch 2 builds on top of it.

- [x] task-6: Convert `BaseConnector` from `abstract class` to `interface`; add `config`/`logger`/`setWorkingDir?`/`getWorkingDir?` to the contract
- [x] task-7: Remove `SecretValue` and `tryParseSecretValue()` from `EnvConnector`; narrow `get()` to `string | undefined`
- [x] task-8: Default `caseInsensitive` to `true` in `EnvConnectorConfig`; add a test locking in default uppercase-env-var matching
- [x] task-9: Add `maskValues` config (default `true`); restore a `maskingValue()` utility; mask all logged values by default

## Batch 2: Engine, Generators, and Pipeline (planned, not yet detailed)

- [ ] task-10: Implement resolution engine (tag scanning, resolve, resolveAll, strict/loose mode)
- [ ] task-11: Implement YamlGenerator and GeneratorContext
- [ ] task-12: Implement generator pipeline runner
- [ ] task-13: Implement text pipeline (plain text and structural modes)
- [ ] task-14: Implement $spread resolution in structural mode

## Batch 3: CLI, Config, Integration, and Acceptance (planned, not yet detailed)

- [ ] task-15: Implement defineConfig() and config loading
- [ ] task-16: Implement CLI (synthing generate, synthing variable export-schema)
- [ ] task-17: Write integration tests and kubricate workflow tests
- [ ] task-18: Full acceptance verification against all criteria
