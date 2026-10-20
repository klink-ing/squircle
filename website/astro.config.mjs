import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import { motionStudio } from "motion-studio";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [motionStudio({ serverUrl: "http://localhost:3013" }), tailwindcss()],
  },
});
