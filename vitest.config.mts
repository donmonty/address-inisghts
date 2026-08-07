import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    // The suite's one seam is lib/scoring.ts, which lands with the scoring
    // ticket. Drop this line once those tests exist.
    passWithNoTests: true,
  },
});
