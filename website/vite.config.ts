import { defineConfig } from "vite-plus";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
  run: {
    tasks: {
      dev: {
        command: "astro dev --host 0.0.0.0 --port 4332",
        dependsOn: ["@klinking/squircle#build"],
      },
      test: { command: "vp test run" },
      typecheck: { command: "tsc --noEmit" },
      build: {
        command: "astro build",
        dependsOn: ["@klinking/squircle#build"],
      },
    },
  },
});
