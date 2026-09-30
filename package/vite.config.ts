// Pins the namespace before src/ modules are evaluated; keep it first.
import { CSS_NAMESPACE } from "./scripts/load-namespace";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";
import { renderPillCss } from "./src/pill-css";

/**
 * Prefix for every custom property this package owns, resolved once in
 * scripts/load-namespace.ts and inlined at build time.
 *
 * The paint worklet names the properties it reads in `inputProperties`, which
 * is a static list read once when the worklet registers — there is no per-
 * element or per-consumer hook to rename them through. So the namespace has to
 * be fixed when the code is built, not when it is used, and it is shared from
 * here with the worklet, the plugins and the stylesheet so they cannot disagree.
 *
 * Every task that bakes the value in declares the variable in its `env`, which
 * both forwards it to the task process and folds it into the cache key. An
 * undeclared variable is stripped, so without that it would appear to work when
 * a script was run directly and quietly do nothing through `vp run`.
 */
const NAMESPACE_ENV = ["SQUIRCLE_CSS_NAMESPACE"];

/**
 * Fills the dev page in from the same sources everything else is built from:
 * `%SQUIRCLE_NS%` becomes the namespace, and `%SQUIRCLE_PILL_CSS%` the
 * standalone stylesheet, so the page never carries a third copy of the rules.
 */
const pillDevPage = () => ({
  name: "pill-dev-page",
  transformIndexHtml: {
    // Before Vite lifts the inline module scripts out of the page, so the
    // placeholders inside them are replaced too.
    order: "pre" as const,
    handler(html: string) {
      return html
        .replaceAll("%SQUIRCLE_NS%", CSS_NAMESPACE)
        .replace("%SQUIRCLE_PILL_CSS%", () => renderPillCss());
    },
  },
});

/**
 * A registered paint worklet cannot be replaced or unregistered, so a worklet
 * cannot be hot-swapped in place. Editing one therefore triggers a full page
 * reload, which re-runs CSS.paintWorklet.addModule() against the fresh source.
 */
const pillWorkletHmr = () => ({
  name: "pill-worklet-hmr",
  handleHotUpdate({ file, server }: { file: string; server: { ws: { send(p: unknown): void } } }) {
    if (file.endsWith(".worklet.ts")) {
      server.ws.send({ type: "full-reload", path: "*" });
      return [];
    }
  },
});

export default defineConfig({
  plugins: [tailwindcss(), pillWorkletHmr(), pillDevPage()],
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
      // Siblings: the registration helper locates the worklet relative to
      // itself, so the two have to land in the same directory.
      "pill-worklet": "./src/pill-worklet.ts",
      "pill-shape.worklet": "./src/pill-shape.worklet.ts",
    },
    format: "esm",
    dts: true,
  },
  run: {
    tasks: {
      "test:tailwind": {
        env: NAMESPACE_ENV,
        // Matches tailwind.test.ts and tailwind-merge.test.ts; the latter
        // compiles the generated utils.css, so the build has to run first.
        command: "vp test run tailwind",
        dependsOn: ["build"],
      },
      "test:css": {
        env: NAMESPACE_ENV,
        command: "vp test run squircle-css",
        dependsOn: ["build"],
      },
      "test:radius": {
        env: NAMESPACE_ENV,
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
        env: NAMESPACE_ENV,
        command: "vp test run pill-",
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
        env: NAMESPACE_ENV,
        // One script, so the pack and the generators are one cache entry;
        // see scripts/build.ts.
        command: "tsx scripts/build.ts",
      },
      "pill-dev": {
        env: NAMESPACE_ENV,
        // The dev page loads the worklet straight from src/, which Vite
        // compiles on the fly, so no build step is needed (and a stale dist/
        // can no longer mask source edits).
        command: "vp dev",
      },
    },
  },
});
