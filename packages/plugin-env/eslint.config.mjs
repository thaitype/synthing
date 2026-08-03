import { config } from "@synthing/config-eslint/base";

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    // Test files freely set arbitrary process.env keys to simulate env vars —
    // these aren't real build-time config turbo needs to know about.
    files: ["**/*.test.ts"],
    rules: {
      "turbo/no-undeclared-env-vars": "off",
    },
  },
];
