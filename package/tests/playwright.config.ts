import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser",
  use: {
    baseURL: "http://127.0.0.1:5174",
    viewport: { width: 1280, height: 1000 },
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: {
    cwd: new URL("..", import.meta.url).pathname,
    command: "vp dev --config tests/vite.config.ts --host 127.0.0.1 --port 5174 --strictPort",
    port: 5174,
  },
});
