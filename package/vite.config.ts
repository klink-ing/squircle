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
      "tailwind-pill/index": "./src/tailwind-pill.ts",
      "panda/index": "./src/panda.ts",
      "panda-pill/index": "./src/panda-pill.ts",
      "stylex/index": "./src/stylex.ts",
      "stylex-pill/index": "./src/stylex-pill.template.ts",
      "pill-shape.worklet": "./src/pill-shape.worklet.ts",
    },
    format: "esm",
    dts: true,
  },
  run: {
    tasks: {
      "test:tailwind": {
        // Matches tailwind.test.ts and tailwind-merge.test.ts; the latter
        // compiles the generated utils.css, so the build has to run first.
        command: "vp test run tailwind",
        dependsOn: ["build"],
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
      "test:pill": {
        command: "vp test run pill-shape",
      },
      test: {
        command: "echo 'All tests passed'",
        dependsOn: ["test:tailwind", "test:css", "test:radius", "test:panda", "test:stylex", "test:pill"],
      },
      "generate:stylex": {
        command: "tsx scripts/generate-stylex.ts",
      },
      build: {
        command:
          "tsx scripts/generate-stylex.ts && vp pack && tsx scripts/generate-squircle-css.ts && tsx scripts/copy-pill-assets.ts",
      },
    },
  },
});
