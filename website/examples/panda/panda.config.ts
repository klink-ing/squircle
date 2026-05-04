import { defineConfig } from "@pandacss/dev";
import squirclePreset from "@klinking/squircle/panda-preset";

export default defineConfig({
  prefix: "pd",
  preflight: true,
  jsxFramework: "react",
  presets: ["@pandacss/dev/presets", squirclePreset()],

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

  include: ["./src/**/*.{ts,tsx}"],
  exclude: [],
  outdir: "styled-system",
});
