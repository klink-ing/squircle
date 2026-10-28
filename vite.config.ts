import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    sortTailwindcss: {
      stylesheet: "./website/src/styles/global.css",
    },
    overrides: [
      {
        // Keeps the README's embedded dist files exactly as generated.
        files: ["**/*.md"],
        options: { embeddedLanguageFormatting: "off" },
      },
    ],
  },
  lint: {
    plugins: ["typescript", "unicorn", "oxc"],
    categories: {
      correctness: "error",
    },
    ignorePatterns: [".astro/"],
    env: {
      builtin: true,
    },
  },
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
        dependsOn: [
          "fmt",
          "lint",
          "@klinking/squircle#typecheck",
          "@klinking/squircle#test",
          "website#build",
        ],
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
