import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser",
  use: {
    baseURL: "http://127.0.0.1:5174",
    viewport: { width: 1280, height: 1000 },
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    // WebKit covers the native fallback and polyfill, without the Paint API.
    { name: "webkit", use: { browserName: "webkit" }, grepInvert: /\bworklet\b/ },
  ],
  webServer: {
    cwd: new URL("..", import.meta.url).pathname,
    command: "vp dev --config tests/vite.config.ts --host 127.0.0.1 --port 5174 --strictPort",
    port: 5174,
  },
});
