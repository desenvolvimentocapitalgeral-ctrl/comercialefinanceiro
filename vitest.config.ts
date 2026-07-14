import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/calculos/**/*.ts"],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 90,
        statements: 100,
      },
    },
  },
});
