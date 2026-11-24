import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// The functions' own tests: the ones that need their dependencies (the MCP
// SDK, Express). Pure modules are tested from the app's src/__tests__.
// Kept in test/ so that its tsconfig.json (type-checking and lint) covers it.
export default defineConfig({
  test: {
    root: resolve(__dirname, ".."),
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
