import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(root, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Loads .env + routes DATABASE_URL at a disposable test database
    // before any test module (incl. src/lib/db.ts) is imported.
    setupFiles: ["tests/setup.ts"],
  },
});