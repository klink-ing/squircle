import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const distDir = join(__dirname, "..", "dist");
mkdirSync(distDir, { recursive: true });

/*
 * Copy the pill stylesheet, rewriting the custom-property namespace if one was
 * configured. The source carries the default so it stays readable and lintable;
 * the worklet and the plugins take the same value through a build-time define,
 * so all three agree however it is set.
 */
const DEFAULT_CSS_NAMESPACE = "klinking";
const cssNamespace: string =
  JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")).squircle?.cssNamespace ??
  DEFAULT_CSS_NAMESPACE;

const pillCssSrc = join(__dirname, "..", "src", "squircle-pill.css");
const pillCssDest = join(distDir, "squircle-pill.css");
const pillCss = readFileSync(pillCssSrc, "utf8").replaceAll(
  `--${DEFAULT_CSS_NAMESPACE}-pill-`,
  `--${cssNamespace}-pill-`,
);
writeFileSync(pillCssDest, pillCss);
console.log(`Copied ${pillCssDest} (namespace: ${cssNamespace})`);

// Note: pill-shape.worklet.ts will be bundled by vp pack as a regular module
// Users will need to register it with CSS.paintWorklet.addModule() in their app
console.log("Pill shape worklet will be bundled as pill-shape.worklet.mjs");
