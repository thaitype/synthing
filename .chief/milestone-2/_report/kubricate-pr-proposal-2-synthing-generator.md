# PR Proposal: Ship `@kubricate/synthing-generator`

## Problem

When using synthing with kubricate in-process (Workflow A), users wrap `stack.build()` in a `YamlGenerator` manually:

```ts
const gen = new YamlGenerator({
  filename: "app.yaml",
  create: () => Object.values(stack.build()),
});
```

This works for basic variable resolution, but loses kubricate-specific features: metadata injection, output modes (stack/resource/flat), and filtering.

## What Users Need

A `KubricateGenerator` class (published by kubricate as `@kubricate/synthing-generator`) that:

- Extends synthing's `BaseGenerator`
- Accepts a kubricate config object (in-process, not from file)
- Respects kubricate features: metadata injection, output modes, filtering
- Produces multiple files via `serialize()` based on output mode
- Kubricate's `generate.outputDir` is ignored — synthing's writer controls output

## Example Usage

```ts
import { KubricateGenerator } from "@kubricate/synthing-generator";

const gen = new KubricateGenerator({
  config: kubricateConfig,
  outputMode: "resource",
});

export default defineConfig({
  variable: { variableSpec: vm, strictMode: true },
  pipelines: [
    { type: "generator", generators: [gen], writer: { type: "file", dir: "output/" } },
  ],
});
```

## Why

Gives users full kubricate features with single-CLI synthing workflow. No intermediate files, no two-step process.

## Independent from PR 1

This package lives in kubricate's repo and uses kubricate internals directly. It does not depend on a public programmatic API (PR 1). PR 1 is a separate concern for external tools and web playgrounds.
