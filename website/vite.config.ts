import { defineConfig } from "vite-plus";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
  run: {
    tasks: {
      dev: {
        command: "astro dev --port 4333",
        dependsOn: ["@klinking/squircle#build"],
      },
      test: { command: "vp test run" },
      typecheck: { command: "tsc --noEmit" },
      studio: {
        command: "motion-studio serve --port 3013",
        dependsOn: ["@klinking/squircle#build"],
      },
      build: {
        command: "astro build",
        dependsOn: ["@klinking/squircle#build"],
      },
    },
  },
});
