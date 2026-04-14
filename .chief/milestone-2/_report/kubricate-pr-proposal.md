# PR Proposal: Expose Programmatic Generate API in Kubricate

## Problem

Kubricate's generate flow is only accessible via `kubricate generate` CLI command. There is no programmatic API to get the same result in-process.

When external tools (like synthing) want to use kubricate in-process, they can only call `stack.build()` directly — which skips metadata injection, output modes, and filtering.

## What Users Need

A single function call that does what `kubricate generate` does, but returns results in memory instead of writing to disk.

- Respects all `kubricate.config.ts` settings (metadata, output mode, filtering, etc.)
- Also accepts an in-process config object directly (not only from `kubricate.config.ts` file) — so callers can construct the config programmatically
- Non-breaking — existing CLI behavior unchanged

## Why

External tools and web playgrounds want to call kubricate programmatically without spawning a CLI subprocess or writing intermediate files to disk.
