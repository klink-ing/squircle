import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_AMT,
  NONE_RADIUS,
  cornerShapeProp,
  squircleFullCssObj,
  SUPPORTS_RULE,
  VARIANTS,
  isComment,
  squircleCssObj,
  type CssLikeObject,
} from "../src/variants";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Support arbitrary, bare, and theme values in one --value() call.
// https://tailwindcss.com/docs/adding-custom-styles#functional-utilities
const value = "--value(--radius-*, [length])";
// The reset re-declares the radius purely so `--value()` still decides what
// matches. Without it the utility would accept any suffix at all, turning a
// typo like `rounded-tl-garbage` into a real class. `[*]` covers the `(--x)`
// and `[var(--x)]` forms core accepts alongside theme keys and `[3px]`; the
// value it emits is identical to the one core emits for the same class.
const roundedValue = "--value(--radius-*, [length], [*])";

/**
 * Re-declare a `rounded-*` utility so it also resets the corners it owns back
 * to `round`. Tailwind keeps its own definition and emits it alongside this
 * one, so this only has to contribute the reset — which is the initial value,
 * hence inert unless a squircle class set a shape on the same element.
 */
function renderRoundedReset(name: string, props: string[], radius?: string): string {
  const obj: CssLikeObject = {};
  if (radius) for (const p of props) obj[p] = radius;
  for (const p of props) obj[cornerShapeProp(p)] = "round";
  return renderUtility(name, obj);
}

function renderUtility(name: string, obj: CssLikeObject): string {
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
/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */`);

  blocks.push(`\
/* ── Squircle utilities ─────────────────────────────────────── */
/* squircle-amt-[n] sets the superellipse amount (default ${DEFAULT_AMT})    */
/* squircle-* mirrors rounded-* variants: t, r, b, l, s, e, tl, tr, br, bl, ss, se, es, ee */
/* squircle-*-none and squircle-*-full are static, matching rounded-none and rounded-full */

/* squircle-amt-[n] only sets the amount — the same thing writing
   --squircle-amt yourself does. It applies no corner-shape of its own, so it
   never reshapes corners that no squircle-* utility claimed. */
@utility squircle-amt-* {
  --squircle-amt: --value(--squircle-amt-*, number, [number]);
}`);

  for (const [suffix, entry] of Object.entries(VARIANTS)) {
    if (isComment(entry)) {
      blocks.push(entry.comment);
      continue;
    }

    const root = suffix ? `squircle-${suffix}` : "squircle";
    // Static -none/-full first, then the functional utility — the same shape
    // Tailwind uses for rounded-none/rounded-full. -none needs no correction.
    blocks.push(
      renderUtility(`${root}-none`, Object.fromEntries(entry.map((p) => [p, NONE_RADIUS]))),
    );
    blocks.push(renderUtility(`${root}-full`, squircleFullCssObj(entry)));
    blocks.push(renderUtility(`${root}-*`, squircleCssObj(entry, value)));
  }

  blocks.push(`\
/* ── rounded-* corner-shape resets ──────────────────────────── */
/* Tailwind's rounded-* utilities only set a radius, so on their own they can't
   take a corner back from a squircle. These re-declarations add the matching
   corner-shape reset; Tailwind still emits its own rule for the radius. The
   reset is the initial value, so it does nothing unless a squircle class set a
   shape on the same element. rounded-*-none needs none: a zero radius has no
   visible corner to shape. */`);

  for (const [suffix, entry] of Object.entries(VARIANTS)) {
    if (isComment(entry)) continue;

    const root = suffix ? `rounded-${suffix}` : "rounded";
    // The -full name is static, so it needs no value matching and can stay
    // radius-free; the functional one has to keep --value() to stay bounded.
    blocks.push(renderRoundedReset(`${root}-full`, entry));
    blocks.push(renderRoundedReset(`${root}-*`, entry, roundedValue));
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
