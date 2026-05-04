import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import babel from "@babel/core";
import { execFileSync } from "node:child_process";
import path from "node:path";
import stylexPluginRaw from "@stylexjs/babel-plugin";

const stylexPlugin = stylexPluginRaw.default ?? stylexPluginRaw;

const stylexBabelOpts = {
  dev: true,
  runtimeInjection: true,
  unstable_moduleResolution: {
    type: "commonJS",
    rootDir: process.cwd(),
  },
};

/**
 * Run `@stylexjs/babel-plugin` on files outside of `@vitejs/plugin-react`'s
 * reach — notably the package's compiled `dist/stylex/index.mjs`, resolved
 * through the pnpm workspace.
 */
function stylexForExternalModules() {
  return {
    name: "stylex-external",
    enforce: "pre",
    async transform(code, id) {
      if (!/\.m?jsx?$|\.tsx?$/.test(id)) return null;
      if (
        !id.includes("/package/dist/stylex/index.mjs") &&
        !id.includes(".stylex.")
      ) {
        return null;
      }
      const result = await babel.transformAsync(code, {
        filename: id,
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        plugins: [[stylexPlugin, stylexBabelOpts]],
      });
      if (!result?.code) return null;
      return { code: result.code, map: result.map };
    },
  };
}

/**
 * Run Panda's codegen + cssgen at server start, then re-run cssgen whenever a
 * source file that might contain a `css({...})` call changes. The output is
 * written to `src/styles/panda.css`, which the panda demo page imports.
 */
function pandaCodegen() {
  const PANDA_BIN = path.resolve("node_modules/.bin/panda");
  const CSS_OUT = "src/styles/panda.css";

  function codegen() {
    execFileSync(PANDA_BIN, ["codegen"], { stdio: "inherit" });
  }
  function cssgen() {
    execFileSync(PANDA_BIN, ["cssgen", "--outfile", CSS_OUT], {
      stdio: "inherit",
    });
  }

  return {
    name: "panda-codegen",
    config() {
      codegen();
      cssgen();
    },
    handleHotUpdate({ file }) {
      if (file.endsWith("panda.config.ts")) {
        codegen();
        cssgen();
      } else if (
        /\/src\/.*\.(?:tsx?|astro)$/.test(file) &&
        !file.endsWith("/src/styles/panda.css")
      ) {
        cssgen();
      }
    },
  };
}

export default defineConfig({
  integrations: [
    react({
      babel: {
        plugins: [[stylexPlugin, stylexBabelOpts]],
      },
    }),
  ],
  vite: {
    plugins: [pandaCodegen(), stylexForExternalModules(), tailwindcss()],
    optimizeDeps: {
      exclude: ["@klinking/squircle"],
    },
    ssr: {
      noExternal: ["@klinking/squircle"],
    },
  },
});
