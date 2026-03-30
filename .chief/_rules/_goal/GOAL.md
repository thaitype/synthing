## 🎯 Goal

Build the **first working release** of Synthing as a **framework-agnostic**, **library-first** orchestration core for secure secret management.

This phase focuses purely on **single `SecretManager` usage**, providing Connectors, Providers, Secret Injection, and secure secret application flows.

✅ No multi-environment plans, no hydration flows, no snapshotting in Phase 1.

## 🎯 Success Criteria for Phase 1 Completion

✅ **Synthing is published as an independent library (npm)**  
✅ **Kubricate migrates to use Synthing internally for secret management**  
✅ **Kubricate fully removes its own internal `/secrets/` module**

> When Kubricate runs secret workflows (`useSecrets()`, `generate`, `secrets apply`) through Synthing without owning any secret orchestration code itself, Phase 1 is complete.

## ✅ Scope of Phase 1

### Core Modules

- [ ] `SecretManager`
- [ ] `SecretInjectionBuilder`
- [ ] `SecretsInjectionContext`
- [ ] `SecretsOrchestrator` (support only `intraProvider` and `crossProvider` merges)
- [ ] `SecretRegistry` (internal, hidden from user for now)

### Connectors & Providers (Core Abstractions)

- [ ] `BaseConnector`
- [ ] `InMemoryConnector` (for testing)
- [ ] `BaseProvider`
- [ ] `InMemoryProvider` (for testing)

### Config API

- [ ] `defineConfig()` supporting:
  ```ts
  export default defineConfig({
    secrets: {
      manager: mySecretManager,
    },
  });
  ```
- Internally auto-wrap into a hidden `SecretRegistry` keyed as `'default'`.

### Merge & Conflict Behavior

- [ ] `autoMerge` support within the same provider (intraProvider)
- [ ] `error` strategy for crossProvider conflicts
- [ ] Proper overwrite logging for secret conflicts
- [ ] Canonical identifier tracking (provider/manager:secretName)

### Minimal CLI (Optional)

- [ ] `synthing secrets apply` — apply to target provider
- [ ] `synthing generate` — trigger generator output (if provided in config)

> CLI is optional and exists only for small standalone usage.  
> Frameworks like Kubricate will wrap Synthing programmatically.

### Testing

- [ ] Unit tests for each module
- [ ] Integration tests using `InMemoryConnector` + `InMemoryProvider`
- [ ] Test secret merge scenarios (conflict, overwrite, success)

## ❌ Out of Scope (Phase 2+)

- ❌ Hydration flows (Env → Vault)
- ❌ Plan synthesis, matrix generation
- ❌ Snapshot history & drift detection
- ❌ Multi-manager user-facing Registry

## 📦 Target Directory Structure

```
/packages/core/
  /secrets/
    /manager/
      SecretManager.ts
    /injectors/
      SecretInjectionBuilder.ts
    /context/
      SecretsInjectionContext.ts
    /orchestrator/
      SecretsOrchestrator.ts
    /connectors/
      BaseConnector.ts
      InMemoryConnector.ts
    /providers/
      BaseProvider.ts
      InMemoryProvider.ts
    /registry/
      SecretRegistry.ts
    /types/
      secret-types.ts
  defineConfig.ts
```

# 🔥 Summary

> **Synthing Phase 1 is considered achieved when Synthing is published as a standalone library and Kubricate consumes it internally, fully removing its previous `/secrets/` module.**

# ✨ Next Step

- Create milestone: **Synthing v0.1.0 - Core Orchestration MVP**
- Break Phase 1 into PR-sized issues (e.g., Implement SecretManager, Implement Orchestrator)
- Scaffold base repo structure for `@synthing/core`

✅ Now your Phase 1 is **not just about code completion**, it’s about **real platform adoption** (Kubricate switching over).
t!