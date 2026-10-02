/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import {
  DEFAULT_PILL_AMT,
  DEFAULT_PILL_CONTINUITY,
  DEFAULT_PILL_EASE_SPREAD,
  FULL_RADIUS,
  PILL_AMT_VAR_NAME,
  PILL_ATTRIBUTE,
  PILL_BORDER_COLOR_VAR_NAME,
  PILL_BORDER_STYLE_FALLBACK,
  PILL_BORDER_STYLE_VAR_NAME,
  PILL_BORDER_WIDTH_VAR_NAME,
  PILL_CONTINUITY_VAR_NAME,
  PILL_EASE_SPREAD_VAR_NAME,
  PILL_CLIP_VAR_NAME,
  PILL_CLIPPED_ATTRIBUTE,
  PILL_POLYFILL_ATTRIBUTE,
  PILL_RING_CLIP_VAR_NAME,
  PILL_STROKE_WIDTH_VAR_NAME,
  PILL_WORKLET_ATTRIBUTE,
} from "./variants";

/** Nested CSS-in-JS: a declaration, or a nested rule keyed by its selector. */
export type PillCss = { [key: string]: string | PillCss };

/**
 * Where the pill's rules come from decides how its border is wired up.
 *
 * `tailwind`: the `border-*` utilities own the real border, and
 * `tailwind-pill-border` mirrors their width and colour into the pill's own
 * properties; `border-dashed` and friends are read through `--tw-border-style`.
 *
 * `standalone`: the pill's own properties are the only API, so they drive a
 * real border too. That real border is what shows without the worklet, a
 * stadium ring, and what reserves room for the drawn ring with it.
 */
export type PillCssFlavor = "tailwind" | "standalone";

/**
 * `@property` registrations for everything the pill reads, with initial
 * values matching the worklet's own fallbacks. Registering makes the values
 * typed and animatable, and resolves lengths to px before the worklet sees
 * them.
 *
 * Everything the ring on `::after` reads inherits, so the ring gets it the
 * ordinary way. Pulling a non-inheriting property down with `inherit` works
 * once, but WebKit never restyles the pseudo when it changes: a hover colour,
 * a new width, or the clip the polyfill computes after the first paint would
 * never reach the ring in Safari. A pill nested in a bordered pill is kept
 * from drawing its parent's ring by resetting the border on every pill
 * instead; see `pillCssObj`.
 */
export function pillPropertyRegistrations(): Record<string, Record<string, string>> {
  return {
    [`@property ${PILL_AMT_VAR_NAME}`]: {
      syntax: '"<number>"',
      "initial-value": String(DEFAULT_PILL_AMT),
      inherits: "true",
    },
    [`@property ${PILL_EASE_SPREAD_VAR_NAME}`]: {
      syntax: '"<number>"',
      "initial-value": String(DEFAULT_PILL_EASE_SPREAD),
      inherits: "true",
    },
    [`@property ${PILL_CONTINUITY_VAR_NAME}`]: {
      syntax: '"<integer>"',
      "initial-value": String(DEFAULT_PILL_CONTINUITY),
      inherits: "true",
    },
    [`@property ${PILL_BORDER_WIDTH_VAR_NAME}`]: {
      syntax: '"<length>"',
      "initial-value": "0px",
      inherits: "true",
    },
    [`@property ${PILL_BORDER_COLOR_VAR_NAME}`]: {
      syntax: '"<color>"',
      "initial-value": "transparent",
      inherits: "true",
    },
    // The polyfill's per-element clips. The element's own is read only by the
    // element, so it doesn't inherit: a pill nested in another never wears
    // its parent's shape. The ring's does, for `::after`, and is reset on
    // every pill instead.
    [`@property ${PILL_CLIP_VAR_NAME}`]: { syntax: '"*"', inherits: "false" },
    [`@property ${PILL_RING_CLIP_VAR_NAME}`]: { syntax: '"*"', inherits: "true" },
  };
}

const maskWith = (image: string): PillCss => ({
  "-webkit-mask-image": image,
  "mask-image": image,
  "-webkit-mask-size": "100% 100%",
  "mask-size": "100% 100%",
  "-webkit-mask-repeat": "no-repeat",
  "mask-repeat": "no-repeat",
  "mask-mode": "alpha",
});

/**
 * Tailwind's mask utilities — `mask-b-from-50%`, `mask-radial-*` and the rest
 * — build `mask-image` from these three layers, intersected, each opaque
 * until a utility sets it. Listing them after the pill's own shape keeps the
 * shape when one is used, instead of the two fighting over `mask-image`. The
 * fallbacks cover pages where Tailwind never registered them.
 */
const OPAQUE = "linear-gradient(#fff, #fff)";
const TAILWIND_MASK_LAYERS = ["--tw-mask-linear", "--tw-mask-radial", "--tw-mask-conic"]
  .map((name) => `var(${name}, ${OPAQUE})`)
  .join(", ");

/** Several mask layers, each kept only where all of them are opaque. */
const maskLayers = (images: string): PillCss => ({
  ...maskWith(images),
  "-webkit-mask-composite": "source-in",
  "mask-composite": "intersect",
});

/** Clips everything away: a ring with nothing computed for it draws nothing. */
const CLIP_ALL = "inset(50%)";

/**
 * The rules one pill utility carries, with `&` standing for the utility's own
 * selector.
 *
 * The shape is applied as a mask, not painted as a background, so the element
 * keeps whatever background it already has — a colour, a gradient, an image —
 * and that background is what gets pill-shaped.
 *
 * A mask erases everything outside the shape, which no `border`, `outline` or
 * outer `box-shadow` can survive. A border is therefore drawn, on `::after`, by
 * the same worklet in stroke mode, which lays an inset band along the inside
 * of the outline. The stadium `border-radius` is kept even under the mask, so
 * anything native that stays inside the box — an inset `box-shadow`, an
 * `outline` with a negative `outline-offset`, the focus ring — follows a shape
 * close enough to the pill that the mask only has to trim it. An outer shadow
 * is the one exception: `filter` runs before the mask, so `drop-shadow` has to
 * go on a wrapper, where it applies to the already-masked result.
 */
export function pillCssObj(flavor: PillCssFlavor): PillCss {
  const ring = (ringShape: PillCss): PillCss => ({
    content: '""',
    position: "absolute",
    "pointer-events": "none",
    // The shape, border and ring clip all arrive by inheritance; see
    // `pillPropertyRegistrations`.
    // The pseudo is positioned against the padding box, but the real border
    // still reserves its width for layout, so the ring has to grow back out
    // by that much to hug the border box the mask covers.
    inset: `calc(-1 * var(${PILL_BORDER_WIDTH_VAR_NAME}))`,
    background: `var(${PILL_BORDER_COLOR_VAR_NAME})`,
    // Set on the ring only: its presence is what switches the worklet from
    // filling the shape to stroking it. Fed from the registered width so the
    // worklet sees a px value whatever unit the width was written in.
    [PILL_STROKE_WIDTH_VAR_NAME]: `var(${PILL_BORDER_WIDTH_VAR_NAME})`,
    ...ringShape,
  });

  const shaped = (ringShape: PillCss): PillCss => ({
    // The worklet only runs where there is an area to paint.
    "min-width": "1px",
    "min-height": "1px",
    position: "relative",
    // The real border must not paint: under the mask it is a stadium ring
    // clipped to the pill. Its width still reserves room for the drawn one.
    "border-color": "transparent",
    "&::after": ring(ringShape),
  });

  return {
    // A stadium on every branch: it is the whole fallback without the
    // worklet, and what native inset decorations follow with it.
    "border-radius": FULL_RADIUS,
    ...(flavor === "standalone"
      ? {
          "border-width": `var(${PILL_BORDER_WIDTH_VAR_NAME})`,
          "border-style": `var(${PILL_BORDER_STYLE_VAR_NAME}, ${PILL_BORDER_STYLE_FALLBACK})`,
          "border-color": `var(${PILL_BORDER_COLOR_VAR_NAME})`,
        }
      : {}),
    // Same default a real border has. Zero specificity, so a colour set any
    // other way — a utility, a rule, an inline style — wins whatever the
    // order.
    //
    // The border and the ring clip inherit, so each pill also starts from
    // none of either, rather than drawing a bordered parent's ring.
    ":where(&)": {
      [PILL_BORDER_WIDTH_VAR_NAME]: "0px",
      [PILL_BORDER_COLOR_VAR_NAME]: "currentColor",
      [PILL_RING_CLIP_VAR_NAME]: "initial",
      ...(flavor === "tailwind"
        ? {
            // `border-dashed` and friends set `--tw-border-style`, so the ring
            // reads it rather than asking for a second source of truth. It is
            // mapped here, on the element, because Tailwind registers it as
            // non-inheriting; the ring inherits the result.
            [PILL_BORDER_STYLE_VAR_NAME]: `var(--tw-border-style, ${PILL_BORDER_STYLE_FALLBACK})`,
          }
        : {}),
    },
    // Only once the worklet has actually loaded; see PILL_WORKLET_ATTRIBUTE.
    // `:where()` keeps the specificity that of the bare utility.
    [`:where(:root[${PILL_WORKLET_ATTRIBUTE}]) &`]: shaped(
      // The ring sits inside the element, so the element's mask — the shape
      // and any Tailwind mask with it — already fades it too.
      maskWith("paint(pill-shape)"),
    ),
    // Without a worklet, `polyfillPills()` computes the same shapes per
    // element as `clip-path: path()` — vector clips, which the browser applies
    // directly, where a mask image would have to be decoded and rasterised on
    // every resize. Until they are computed the element shows its stadium, and
    // the ring nothing at all.
    [`:where(:root[${PILL_POLYFILL_ATTRIBUTE}]) &`]: shaped({
      "clip-path": `var(${PILL_RING_CLIP_VAR_NAME}, ${CLIP_ALL})`,
    }),
    // The shape itself, on a doubled selector so it outranks a mask or clip
    // utility on the same element whichever order they are emitted in.
    // Tailwind emits its mask utilities after this one, at the same
    // single-class specificity, which would otherwise replace the shape
    // rather than combine with it.
    [`:where(:root[${PILL_WORKLET_ATTRIBUTE}]) &&`]:
      flavor === "tailwind"
        ? maskLayers(`paint(pill-shape), ${TAILWIND_MASK_LAYERS}`)
        : maskWith("paint(pill-shape)"),
    // A clip, not a mask, so Tailwind's mask utilities apply on top as they
    // would on any element. An element has only one clip, though, so the
    // polyfill folds the element's own — `sr-only`, a `[clip-path:…]` — into
    // this one, and marks the pills it has done that for; the rest keep their
    // own clip.
    [`:where(:root[${PILL_POLYFILL_ATTRIBUTE}]) &&:where([${PILL_CLIPPED_ATTRIBUTE}])`]: {
      "clip-path": `var(${PILL_CLIP_VAR_NAME}, none)`,
    },
  };
}

function renderDeclarations(obj: PillCss, indent: string): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") lines.push(`${indent}${key}: ${value};`);
  }
  return lines;
}

/** Flattens nested rules, resolving `&` against the parent selector. */
function renderRule(selector: string, obj: PillCss): string[] {
  const blocks: string[] = [];
  const declarations = renderDeclarations(obj, "  ");
  if (declarations.length > 0) blocks.push(`${selector} {\n${declarations.join("\n")}\n}`);
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") continue;
    const child = key.includes("&") ? key.replaceAll("&", selector) : `${selector} ${key}`;
    blocks.push(...renderRule(child, value));
  }
  return blocks;
}

/**
 * The standalone stylesheet, `squircle-pill.css`: the same rules the Tailwind
 * utility carries, hung off `[data-<namespace>-pill]` so they work without
 * Tailwind. Generated from the one source so the two cannot drift.
 */
export function renderPillCss(selector = `[${PILL_ATTRIBUTE}]`): string {
  const blocks: string[] = [
    `/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */`,
    `/* Generated from src/pill-css.ts — do not edit by hand. */`,
  ];

  for (const [rule, decls] of Object.entries(pillPropertyRegistrations())) {
    blocks.push(`${rule} {\n${renderDeclarations(decls, "  ").join("\n")}\n}`);
  }

  blocks.push(...renderRule(selector, pillCssObj("standalone")));
  return blocks.join("\n\n") + "\n";
}
