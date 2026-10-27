import { defineConfig } from "vite-plus";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
  run: {
    tasks: {
      dev: {
        command: "astro dev",
        dependsOn: ["@klinking/squircle#build"],
      },
      build: {
        command: "astro build",
        dependsOn: ["@klinking/squircle#build"],
      },
      test: { command: "vp test run" },
      typecheck: { command: "tsc --noEmit -p tsconfig.tour.json" },
    },
  },
});
