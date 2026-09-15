import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const distDir = join(__dirname, "..", "dist");
mkdirSync(distDir, { recursive: true });

// Copy pill CSS
const pillCssSrc = join(__dirname, "..", "src", "squircle-pill.css");
const pillCssDest = join(distDir, "squircle-pill.css");
copyFileSync(pillCssSrc, pillCssDest);
console.log(`Copied ${pillCssDest}`);

// Note: pill-shape.worklet.ts will be bundled by vp pack as a regular module
// Users will need to register it with CSS.paintWorklet.addModule() in their app
console.log("Pill shape worklet will be bundled as pill-shape.worklet.mjs");
