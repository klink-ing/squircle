import { readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";

/**
 * Prefix for every custom property this package owns, inlined at build time
 * from `squircle.cssNamespace` in package.json.
 *
 * The paint worklet names the properties it reads in `inputProperties`, which
 * is a static list read once when the worklet registers — there is no per-
 * element or per-consumer hook to rename them through. So the namespace has to
 * be fixed when the code is built, not when it is used, and it is shared from
 * here with the worklet, the plugins and the stylesheet so they cannot disagree.
 *
 * It lives in package.json rather than an environment variable because the task
 * runner does not forward arbitrary variables to the commands it spawns, so an
 * env knob would silently do nothing for anyone building through `vp run`. A
 * file is also an input the task cache can see, so changing it rebuilds.
 */
const CSS_NAMESPACE: string =
  JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).squircle
    ?.cssNamespace ?? "klinking";

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
  // Covers the dev server and the test run; `pack.define` covers the library
  // build, which does not inherit this one.
  define: {
    __SQUIRCLE_CSS_NAMESPACE__: JSON.stringify(CSS_NAMESPACE),
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
  pack: {
    define: {
      __SQUIRCLE_CSS_NAMESPACE__: JSON.stringify(CSS_NAMESPACE),
    },
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
