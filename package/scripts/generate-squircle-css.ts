import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_AMT, SUPPORTS_RULE, VARIANTS, isComment, squircleCssObj } from "../src/variants";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Support arbitrary, bare, and theme values in one --value() call.
// https://tailwindcss.com/docs/adding-custom-styles#functional-utilities
const value = "--value(--radius-*, [length])";

function renderUtility(name: string, props: string[]): string {
  const obj = squircleCssObj(props, value);
  const lines: string[] = [`@utility ${name} {`];

  for (const [key, val] of Object.entries(obj)) {
    if (key === SUPPORTS_RULE && typeof val === "object" && val !== null) {
      lines.push(`  ${SUPPORTS_RULE} {`);
      for (const [innerKey, innerVal] of Object.entries(val)) {
        lines.push(`    ${innerKey}: ${innerVal as string};`);
      }
      lines.push(`  }`);
    } else {
      lines.push(`  ${key}: ${val as string};`);
    }
  }
  lines.push(`}`);
  return lines.join("\n");
}

function generateCss(): string {
  const blocks: string[] = [];

  blocks.push(`\
/* ── Squircle utilities ─────────────────────────────────────── */
/* squircle-amt-[n] sets the superellipse amount (default ${DEFAULT_AMT})    */
/* squircle-* mirrors rounded-* variants: all, t, r, b, l, s, e, tl, tr, br, bl, ss, se, es, ee */

@utility squircle-amt-* {
  --squircle-amt: --value(--squircle-amt-*, number, [number]);
  ${SUPPORTS_RULE} {
    corner-shape: superellipse(var(--squircle-amt));
  }
}`);

  for (const [suffix, entry] of Object.entries(VARIANTS)) {
    if (isComment(entry)) {
      blocks.push(entry.comment);
      continue;
    }

    const name = suffix ? `squircle-${suffix}-*` : "squircle-*";
    blocks.push(renderUtility(name, entry));
  }

  return blocks.join("\n\n") + "\n";
}

const output = generateCss();
const tailwindDir = join(__dirname, "..", "dist", "tailwind");
mkdirSync(tailwindDir, { recursive: true });
const outPath = join(tailwindDir, "utils.css");
writeFileSync(outPath, output);
console.log(`Generated ${outPath} (skipping fmt)`);

const radiusSrc = join(__dirname, "..", "src", "squircle-radius.css");
const radiusDest = join(__dirname, "..", "dist", "radius-function.css");
copyFileSync(radiusSrc, radiusDest);
console.log(`Copied ${radiusDest}`);
