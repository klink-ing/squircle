import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    cache: true,
    tasks: {
      fmt: {
        command: "vp fmt --check",
        dependsOn: ["@klinking/squircle#build"],
      },
      lint: {
        command: "vp lint",
      },
      ready: {
        command: "echo 'All checks passed'",
        dependsOn: ["fmt", "lint", "@klinking/squircle#test", "website#build"],
      },
      "sync-readme": {
        command: "bash scripts/sync-readme.sh && vp fmt README.md",
        dependsOn: ["@klinking/squircle#build"],
      },
    },
  },
  staged: {
    "*": "vp check --fix",
  },
});
