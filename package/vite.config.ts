import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";

/**
 * A registered paint worklet cannot be replaced or unregistered, so the worklet
 * cannot be hot-swapped in place. Editing it therefore triggers a full page
 * reload, which re-runs CSS.paintWorklet.addModule() against the fresh source.
 */
const pillWorkletHmr = () => ({
  name: "pill-worklet-hmr",
  handleHotUpdate({ file, server }: { file: string; server: { ws: { send(p: unknown): void } } }) {
    if (file.replace(/\\/g, "/").endsWith("src/pill-shape.worklet.ts")) {
      server.ws.send({ type: "full-reload", path: "*" });
      return [];
    }
  },
});

export default defineConfig({
  plugins: [tailwindcss(), pillWorkletHmr()],
  test: {
    include: ["src/**/*.test.ts"],
  },
  pack: {
    entry: {
      "tailwind/index": "./src/tailwind.ts",
      "tailwind-pill/index": "./src/tailwind-pill.ts",
      "tailwind-pill-border/index": "./src/tailwind-pill-border.ts",
      "panda/index": "./src/panda.ts",
      "stylex/index": "./src/stylex.ts",
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
        dependsOn: [
          "test:tailwind",
          "test:css",
          "test:radius",
          "test:panda",
          "test:stylex",
          "test:pill",
        ],
      },
      "generate:stylex": {
        command: "tsx scripts/generate-stylex.ts",
      },
      build: {
        command:
          "tsx scripts/generate-stylex.ts && vp pack && tsx scripts/generate-squircle-css.ts && tsx scripts/copy-pill-assets.ts",
      },
      "build:pill": {
        command: "vp pack",
      },
      "pill-dev": {
        // The dev page loads the worklet straight from src/, which Vite
        // compiles on the fly, so no build step is needed (and a stale dist/
        // can no longer mask source edits).
        command: "vp dev",
      },
    },
  },
});
