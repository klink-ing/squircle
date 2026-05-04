import { defineConfig } from "@pandacss/dev";
import squirclePreset from "@klinking/squircle/panda-preset";

export default defineConfig({
  // Tailwind also runs on this site; prefix Panda's generated classes so they
  // never collide with a tailwind utility (`pd-bg-rose-500` vs `bg-rose-500`).
  prefix: "pd",

  preflight: false,

  jsxFramework: "react",

  presets: ["@pandacss/dev/presets", squirclePreset()],

  include: ["./src/**/*.{ts,tsx,astro}"],
  exclude: [],

  outdir: "styled-system",
});
