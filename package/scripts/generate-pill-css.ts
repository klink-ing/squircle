// Pins the namespace before variants.ts is evaluated; keep it first.
import { CSS_NAMESPACE } from "./load-namespace";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderPillCss } from "../src/pill-css";

const __dirname = dirname(fileURLToPath(import.meta.url));

const distDir = join(__dirname, "..", "dist");
mkdirSync(distDir, { recursive: true });

// Rendered from the same rules the Tailwind utility carries, so the two
// cannot drift, and under the same namespace the worklet was built with.
const outPath = join(distDir, "squircle-pill.css");
writeFileSync(outPath, renderPillCss());
console.log(`Generated ${outPath} (namespace: ${CSS_NAMESPACE})`);
