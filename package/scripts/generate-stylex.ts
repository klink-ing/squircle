import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAMEL_VARIANTS,
  VARIANTS,
  cornerShapeProp,
  isComment,
  SUPPORTS_RULE,
} from "../src/variants";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEMPLATE_PATH = join(__dirname, "..", "src", "stylex.template.ts");
const OUTPUT_PATH = join(__dirname, "..", "src", "stylex.ts");
const VARIANTS_MARKER = /^[ \t]*\/\/ @stylex-generate:variants[ \t]*$/m;

const DO_NOT_EDIT = `// THIS FILE IS GENERATED — DO NOT EDIT.
// Source: scripts/generate-stylex.ts (template: src/stylex.template.ts)
//
// To regenerate: tsx package/scripts/generate-stylex.ts (also runs in vp build).
// To modify variant shape, edit \`renderVariant\` in the generator.
// To add/rename variants, edit \`CAMEL_VARIANTS\` and \`VARIANTS\` in src/variants.ts.

`;

const KEBAB_TO_CAMEL = new Map<string, string>();
function toCamel(kebab: string): string {
  const cached = KEBAB_TO_CAMEL.get(kebab);
  if (cached) return cached;
  const camel = kebab.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  KEBAB_TO_CAMEL.set(kebab, camel);
  return camel;
}

/**
 * Render one `key: (radius, amt) => ({ ... })` entry for the
 * `stylex.create({...})` literal. The body is one CSS-property block per
 * radius prop plus a matching shape block for each, both gated by `@supports`.
 *
 * Tweak the indentation, comment style, or fallback expression here — the
 * template file just stamps these strings into its create() call.
 */
function renderVariant(side: string, kebabProps: string[]): string {
  const indent = "  ";
  const radiusBlocks = kebabProps
    .map((prop) => {
      const camel = toCamel(prop);
      return [
        `${indent}${indent}${camel}: {`,
        `${indent}${indent}${indent}default: radius,`,
        `${indent}${indent}${indent}"${SUPPORTS_RULE}": \`calc(\${radius} * (1 - pow(2, -0.5)) / (1 - pow(2, -1 * pow(2, -1 * \${amt ?? 2}))))\`,`,
        `${indent}${indent}},`,
      ].join("\n");
    })
    .join("\n");

  // One shape block per radius prop, so a variant only reshapes the corners it
  // actually sets a radius on. `border-radius` maps to the `cornerShape`
  // shorthand, the narrower props to their per-corner longhands.
  const shapeBlocks = kebabProps
    .map((prop) =>
      [
        `${indent}${indent}${toCamel(cornerShapeProp(prop))}: {`,
        `${indent}${indent}${indent}default: null,`,
        `${indent}${indent}${indent}"${SUPPORTS_RULE}": \`superellipse(\${amt ?? 2})\`,`,
        `${indent}${indent}},`,
      ].join("\n"),
    )
    .join("\n");

  return [
    `${indent}${side}: (radius: string | number, amt: string | number | undefined) => ({`,
    radiusBlocks,
    shapeBlocks,
    `${indent}}),`,
  ].join("\n");
}

function renderAllVariants(): string {
  const blocks: string[] = [];
  let lastSection: string | null = null;

  for (const camel of CAMEL_VARIANTS) {
    const entry = VARIANTS[camel.suffix];
    if (!entry || isComment(entry)) continue;

    // Emit a section comment when we transition between physical/logical
    // groups, mirroring the structure of the variants table.
    const section = sectionFor(camel.side);
    if (section !== lastSection) {
      blocks.push(`  // --- ${section} ---`);
      lastSection = section;
    }

    blocks.push(renderVariant(camel.side, entry));
  }

  return blocks.join("\n\n");
}

function sectionFor(side: string): string {
  if (side === "all") return "All corners";
  if (["top", "right", "bottom", "left"].includes(side)) return "Per-side physical";
  if (["start", "end"].includes(side)) return "Per-side logical";
  if (["topLeft", "topRight", "bottomRight", "bottomLeft"].includes(side)) {
    return "Per-corner physical";
  }
  return "Per-corner logical";
}

const template = readFileSync(TEMPLATE_PATH, "utf8");

if (!VARIANTS_MARKER.test(template)) {
  console.error(
    `generate-stylex: template ${TEMPLATE_PATH} is missing the // @stylex-generate:variants marker line.`,
  );
  process.exit(1);
}

const variantsBlock = renderAllVariants();
const filled = template.replace(VARIANTS_MARKER, variantsBlock);
writeFileSync(OUTPUT_PATH, DO_NOT_EDIT + filled);

console.log(`Generated ${OUTPUT_PATH} (${CAMEL_VARIANTS.length} variants)`);
