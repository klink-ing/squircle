import { CSS_NAMESPACE } from "../scripts/load-namespace";
import { defineConfig } from "vite-plus";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  define: { __SQUIRCLE_CSS_NAMESPACE__: JSON.stringify(CSS_NAMESPACE) },
  plugins: [tailwindcss()],
});
