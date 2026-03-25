import { defineConfig } from "@playwright/test";
import path from "node:path";
export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
  },
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      SOLANAOS_STATE_DIR: path.resolve("./tests/fixtures/solanaos-empty-state"),
      NEXT_PUBLIC_GATEWAY_URL: "",
    },
  },
});
