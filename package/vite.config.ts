// Pins the namespace before src/ modules are evaluated; keep it first.
import { CSS_NAMESPACE } from "./scripts/load-namespace";
import { defineConfig } from "vite-plus";

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

export default defineConfig({
  // Covers the test run; `pack.define` covers the library
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
      "pill-polyfill": "./src/pill-polyfill.ts",
      "pill-shape.worklet": "./src/pill-shape.worklet.ts",
    },
    format: "esm",
    dts: true,
  },
  run: {
    tasks: {
      "test:tailwind": {
        cache: { env: NAMESPACE_ENV },
        // Matches tailwind.test.ts and tailwind-merge.test.ts; the latter
        // compiles the generated utils.css, so the build has to run first.
        command: "vp test run tailwind",
        dependsOn: ["build"],
      },
      "test:css": {
        cache: { env: NAMESPACE_ENV },
        command: "vp test run squircle-css",
        dependsOn: ["build"],
      },
      "test:radius": {
        cache: { env: NAMESPACE_ENV },
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
        cache: { env: NAMESPACE_ENV },
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
        cache: { env: NAMESPACE_ENV },
        // One script, so the pack and the generators are one cache entry;
        // see scripts/build.ts.
        command: "tsx scripts/build.ts",
      },
    },
  },
});
