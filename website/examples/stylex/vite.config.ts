import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import babel from "@babel/core";
import stylexPluginRaw from "@stylexjs/babel-plugin";

const stylexPlugin = (stylexPluginRaw as { default?: unknown }).default ?? stylexPluginRaw;

const stylexBabelOpts = {
  dev: true,
  runtimeInjection: true,
  unstable_moduleResolution: { type: "commonJS", rootDir: process.cwd() },
};

/**
 * Run @stylexjs/babel-plugin on `@klinking/squircle/stylex` (which @vitejs/plugin-react
 * skips because it lives inside node_modules).
 */
function stylexForExternalModules() {
  return {
    name: "stylex-external",
    enforce: "pre" as const,
    async transform(code: string, id: string) {
      if (!/\.m?jsx?$|\.tsx?$/.test(id)) return null;
      if (!id.includes("@klinking/squircle/dist/stylex.mjs")) return null;
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

export default defineConfig({
  plugins: [
    react({
      babel: { plugins: [[stylexPlugin, stylexBabelOpts]] },
    }),
    stylexForExternalModules(),
    tailwindcss(),
  ],
  optimizeDeps: { exclude: ["@klinking/squircle"] },
});
