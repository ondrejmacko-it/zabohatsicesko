import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Stávající testy nahrávky běží se zapnutou ukázkou. Výchozí vypnutí ověřuje tests/zapisy-f13-f15.test.ts.
    env: { PGLITE_DIR: "memory://", SIM_LATENCY_MS: "0", RECORDING_DEMO: "on" },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
