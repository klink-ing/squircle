import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [tailwindcss()],
  test: {
    include: ["src/**/*.test.ts"],
  },
  pack: {
    entry: {
      "tailwind/index": "./src/tailwind.ts",
      "panda/index": "./src/panda.ts",
      "stylex/index": "./src/stylex.ts",
    },
    format: "esm",
    dts: true,
  },
  run: {
    tasks: {
      "test:tailwind": {
        command: "vp test run tailwind",
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
        command: "vp test run panda",
      },
      "test:stylex": {
        command: "vp test run stylex",
      },
      test: {
        command: "echo 'All tests passed'",
        dependsOn: [
          "test:tailwind",
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
