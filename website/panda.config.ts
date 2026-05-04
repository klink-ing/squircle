import { defineConfig } from "@pandacss/dev";
import squirclePreset from "@klinking/squircle/panda";

export default defineConfig({
  // Tailwind also runs on this site; prefix Panda's generated classes so they
  // never collide with a tailwind utility (`pd-bg-rose-500` vs `bg-rose-500`).
  prefix: "pd",

  preflight: false,

  jsxFramework: "react",

  presets: ["@pandacss/dev/presets", squirclePreset()],

  // Semantic colors used by the demo boxes — names line up with the StyleX
  // and Tailwind demos so the same logical concept is the same color in all
  // three styling systems.
  theme: {
    extend: {
      semanticTokens: {
        colors: {
          demoPlain: { value: "#4f46e5" },
          demoSquircle: { value: "#db2777" },
          demoAmount: { value: "#059669" },
          demoCorner: { value: "#7c3aed" },
        },
      },
    },
  },

  include: ["./src/**/*.{ts,tsx,astro}"],
  exclude: [],

  outdir: "styled-system",
});
