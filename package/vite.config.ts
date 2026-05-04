import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [tailwindcss()],
  test: {
    include: ["src/**/*.test.ts"],
  },
  pack: {
    entry: {
      "tw-plugin": "./src/tw-plugin.ts",
      "tw-merge-cfg": "./src/tw-merge-cfg.ts",
      "panda-preset": "./src/panda-preset.ts",
      stylex: "./src/squircle.stylex.ts",
    },
    format: "esm",
    dts: true,
  },
  run: {
    tasks: {
      "test:plugin": {
        command: "vp test run tw-plugin",
      },
      "test:css": {
        command: "vp test run squircle-css",
        dependsOn: ["build"],
      },
      "test:radius": {
        command: "vp test run squircle-radius",
        dependsOn: ["build"],
      },
      "test:panda": {
        command: "vp test run panda-preset",
      },
      "test:stylex": {
        command: "vp test run squircle.stylex",
      },
      test: {
        command: "echo 'All tests passed'",
        dependsOn: [
          "test:plugin",
          "test:css",
          "test:radius",
          "test:panda",
          "test:stylex",
        ],
      },
      build: {
        command: "vp pack && tsx scripts/generate-squircle-css.ts",
      },
    },
  },
});
