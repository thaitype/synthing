# NPM Boilerplate for Publishing TypeScript Packages for Both ESM and CommonJS

NPM TypeScript Boilerplate with Bun, ESM, using TSC without bundler, support Sourcemap from TypeScript

## Usage

### Development
```
bun install
bun run build
```

### Type Checking
```
bun run check
```

### Type Checking with Watch
```
bun run check:watch
```

### Publish

Using `release-it` to publish the package, using npm commandline with OTP (One Time Password) for 2FA (Two Factor Authentication)

```
bun run release
``` 

## Supporting Both ESM and CommonJS

This library supports both **ECMAScript Modules (ESM)** and **CommonJS (CJS)** by compiling TypeScript to both module formats. This ensures compatibility across different environments.

### Build Process

We use multiple build steps to generate both ESM and CJS versions:

```json
{
  "build-esm": "tsc -b tsconfig.build.json",
  "build-cjs": "babel dist/esm --plugins @babel/transform-export-namespace-from --plugins @babel/transform-modules-commonjs --out-dir dist/cjs --source-maps",
  "build-annotate": "babel dist --plugins annotate-pure-calls --out-dir dist --source-maps"
}

```

- **`build-esm`**: Compiles TypeScript to ESM using `tsc` with the `tsconfig.build.json` configuration.
- **`build-cjs`**: Converts ESM to CommonJS using Babel with `@babel/transform-export-namespace-from` and `@babel/transform-modules-commonjs` plugins.
- **`build-annotate`**: Adds `annotate-pure-calls` annotations to improve tree-shaking and debugging.

### Handling `type: "module"`

When publishing to **npm**, we **remove** `"type": "module"` in `package.json` to prevent issues in CommonJS projects. Otherwise, Node.js would treat all JavaScript files as ESM, causing import errors in CJS environments.

During development, `"type": "module"` is **kept** to ensure correct behavior when testing the ESM build.

### Automating the Publish Process

To handle this automatically, we use **release-it** along with pre/post publish hooks:

```json
{
  "hooks": {
    "before:npm:release": "bun run prepublishOnly",
    "after:npm:release": "bun run postpublish"
  }
}

```

- **`before:npm:release`**: Ensures the correct build setup before publishing.
- **`after:npm:release`**: Cleans up any post-publish artifacts.

Since **release-it** does not use npm lifecycle hooks, we manually invoke these scripts in `.release-it.json` to ensure the correct behavior.

## References
Build process come from Effect.ts: https://github.com/Effect-TS/effect/blob/99fcbf712d40a90ac5c8843237d26914146d7312/packages/effect/package.json#L35-L39