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
  PILL_BOX_SHADOW_VAR_NAME,
  PILL_CLIP_VAR_NAME,
  PILL_CONTINUITY_VAR_NAME,
  PILL_DECORATED_VAR_NAME,
  PILL_DECORATION_CLIP_VAR_NAME,
  PILL_DECORATION_VAR_NAME,
  PILL_EASE_SPREAD_VAR_NAME,
  PILL_INSET_RING_COLOR_VAR_NAME,
  PILL_INSET_RING_WIDTH_VAR_NAME,
  PILL_OUTLINE_COLOR_VAR_NAME,
  PILL_OUTLINE_OFFSET_VAR_NAME,
  PILL_OUTLINE_STYLE_VAR_NAME,
  PILL_OUTLINE_WIDTH_VAR_NAME,
  PILL_POLYFILL_ATTRIBUTE,
  PILL_REACH_VAR_NAME,
  PILL_RING_COLOR_VAR_NAME,
  PILL_RING_OFFSET_COLOR_VAR_NAME,
  PILL_RING_OFFSET_WIDTH_VAR_NAME,
  PILL_RING_WIDTH_VAR_NAME,
  PILL_SHADOW_REACH_VAR_NAME,
  PILL_WORKLET_ATTRIBUTE,
} from "./variants";

/** Nested CSS-in-JS: a declaration, or a nested rule keyed by its selector. */
export type PillCss = { [key: string]: string | PillCss };

/**
 * Where the pill's rules come from decides how its border and shadows are
 * wired up.
 *
 * `tailwind`: the `border-*`, `shadow-*` and ring utilities own those, and
 * the pill reads them — through `tailwind-pill-border` for widths, and
 * through Tailwind's own variables for styles, colours and shadow lists.
 *
 * `standalone`: the pill's own properties are the only API, so they drive a
 * real border too. That real border is what shows without the worklet, a
 * stadium ring, and what reserves room for the drawn one with it.
 */
export type PillCssFlavor = "tailwind" | "standalone";

/**
 * `@property` registrations for everything the pill reads, with initial
 * values matching the worklet's own fallbacks. Registering makes the values
 * typed and animatable, and resolves lengths to px before the worklet sees
 * them.
 *
 * Everything the pseudo-elements read inherits, so they get it the ordinary
 * way. Pulling a non-inheriting property down with `inherit` works once, but
 * WebKit never restyles the pseudo when it changes: a hover colour, a new
 * width, or the clip the polyfill computes after the first paint would never
 * reach it in Safari. A pill nested in a decorated pill is kept from drawing
 * its parent's border, rings and shadows by resetting them on every pill
 * instead; see `pillCssObj`.
 */
export function pillPropertyRegistrations(): Record<string, Record<string, string>> {
  const lengths = [
    PILL_BORDER_WIDTH_VAR_NAME,
    PILL_OUTLINE_WIDTH_VAR_NAME,
    PILL_OUTLINE_OFFSET_VAR_NAME,
    PILL_RING_WIDTH_VAR_NAME,
    PILL_RING_OFFSET_WIDTH_VAR_NAME,
    PILL_INSET_RING_WIDTH_VAR_NAME,
    PILL_SHADOW_REACH_VAR_NAME,
    PILL_REACH_VAR_NAME,
  ];
  const colors = [
    PILL_BORDER_COLOR_VAR_NAME,
    PILL_OUTLINE_COLOR_VAR_NAME,
    PILL_RING_COLOR_VAR_NAME,
    PILL_RING_OFFSET_COLOR_VAR_NAME,
    PILL_INSET_RING_COLOR_VAR_NAME,
  ];
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
    ...Object.fromEntries(
      lengths.map((name) => [
        `@property ${name}`,
        { syntax: '"<length>"', "initial-value": "0px", inherits: "true" },
      ]),
    ),
    ...Object.fromEntries(
      colors.map((name) => [
        `@property ${name}`,
        { syntax: '"<color>"', "initial-value": "transparent", inherits: "true" },
      ]),
    ),
    // The polyfill's shape for the background, and its drawing of the rest.
    [`@property ${PILL_CLIP_VAR_NAME}`]: { syntax: '"*"', inherits: "true" },
    [`@property ${PILL_DECORATION_VAR_NAME}`]: { syntax: '"*"', inherits: "true" },
    [`@property ${PILL_DECORATION_CLIP_VAR_NAME}`]: { syntax: '"*"', inherits: "true" },
  };
}

/** Tailwind's ring and shadow variables, in the order `box-shadow` lists them. */
const TAILWIND_BOX_SHADOW = [
  "--tw-inset-shadow",
  "--tw-inset-ring-shadow",
  "--tw-ring-offset-shadow",
  "--tw-ring-shadow",
  "--tw-shadow",
]
  .map((name) => `var(${name}, 0 0 #0000)`)
  .join(", ");

/**
 * The rules one pill utility carries, with `&` standing for the utility's own
 * selector.
 *
 * Nothing about the element itself is masked. Its background is hidden —
 * clipped to its text, which sits on top of it anyway — and painted again on
 * `::before`, under the content, shaped exactly to the pill. Whatever the
 * background is, a colour, a gradient, an image, that copy of it is what
 * shows. Hiding the original matters: it would paint into the stadium
 * `border-radius`, which sits up to a few pixels outside the pill near its
 * caps, and in that sliver no shadow could show.
 *
 * Around the pill, on `::after`, the pill draws its own border, outline,
 * rings and box shadows, cast by its true outline; the element's own box
 * shadows are switched off, and the copy of the background paints the inset
 * ones. A drop shadow, a filter on the element, sees the pill-shaped copy and
 * follows it by itself. A mask on the element — Tailwind's `mask-*` — applies
 * as it would anywhere, shadows and all.
 */
export function pillCssObj(flavor: PillCssFlavor): PillCss {
  const background = (shape: PillCss): PillCss => ({
    content: '""',
    position: "absolute",
    // The pseudo is positioned against the padding box; the border box is
    // what it has to cover.
    inset: `calc(-1 * var(${PILL_BORDER_WIDTH_VAR_NAME}))`,
    "z-index": "-1",
    "pointer-events": "none",
    "border-radius": "inherit",
    background: "inherit",
    // A border as wide as the element's, so a background positioned against
    // the padding box lines up with the original. Painted under it too.
    border: `var(${PILL_BORDER_WIDTH_VAR_NAME}) solid transparent`,
    "-webkit-background-clip": "border-box",
    "background-clip": "border-box",
    // The inset shadows paint inside the copy; the outer ones are cut away
    // with everything else outside the pill, and drawn on `::after` instead.
    "box-shadow": `var(${PILL_BOX_SHADOW_VAR_NAME}, none)`,
    ...shape,
  });

  const decoration = (paint: PillCss): PillCss => ({
    // With Tailwind, only on pills `tailwind-pill-border` has seen a border,
    // outline, ring or shadow utility on: a pseudo on every pill, even drawing
    // nothing, costs a paint each per resize. Without that plugin, always.
    content: flavor === "tailwind" ? `var(${PILL_DECORATED_VAR_NAME}, "")` : '""',
    position: "absolute",
    "pointer-events": "none",
    inset: `calc(-1 * (var(${PILL_BORDER_WIDTH_VAR_NAME}) + var(${PILL_REACH_VAR_NAME})))`,
    ...paint,
  });

  const shaped = (shape: PillCss, paint: PillCss): PillCss => ({
    // The worklet only runs where there is an area to paint.
    "min-width": "1px",
    "min-height": "1px",
    position: "relative",
    // Keeps the copy of the background, at `z-index: -1`, above the element's
    // own and below its content.
    isolation: "isolate",
    // The real border must not paint: it is a stadium ring. Its width still
    // reserves room for the drawn one.
    "border-color": "transparent",
    "&::before": background(shape),
    "&::after": decoration(paint),
  });

  return {
    // A stadium on every branch: it is the whole fallback without the
    // worklet, and what an outline the pill doesn't draw itself — the
    // browser's focus ring — follows with it.
    "border-radius": FULL_RADIUS,
    ...(flavor === "standalone"
      ? {
          "border-width": `var(${PILL_BORDER_WIDTH_VAR_NAME})`,
          "border-style": `var(${PILL_BORDER_STYLE_VAR_NAME}, ${PILL_BORDER_STYLE_FALLBACK})`,
          "border-color": `var(${PILL_BORDER_COLOR_VAR_NAME})`,
        }
      : {}),
    // Same default colours a real border and ring have. Zero specificity, so
    // a value set any other way — a utility, a rule, an inline style — wins
    // whatever the order.
    //
    // Everything here inherits, so each pill also starts from none of it,
    // rather than drawing a decorated parent's border, rings or shadows.
    ":where(&)": {
      [PILL_BORDER_WIDTH_VAR_NAME]: "0px",
      [PILL_BORDER_COLOR_VAR_NAME]: "currentColor",
      [PILL_OUTLINE_WIDTH_VAR_NAME]: "0px",
      [PILL_OUTLINE_OFFSET_VAR_NAME]: "0px",
      [PILL_OUTLINE_COLOR_VAR_NAME]: "currentColor",
      [PILL_RING_WIDTH_VAR_NAME]: "0px",
      [PILL_INSET_RING_WIDTH_VAR_NAME]: "0px",
      [PILL_SHADOW_REACH_VAR_NAME]: "0px",
      [PILL_CLIP_VAR_NAME]: "initial",
      [PILL_DECORATION_VAR_NAME]: "initial",
      [PILL_DECORATION_CLIP_VAR_NAME]: "initial",
      // How far the outline, the ring and the shadows reach past the box,
      // which the decoration's box grows by.
      [PILL_REACH_VAR_NAME]: `max(0px, var(${PILL_OUTLINE_OFFSET_VAR_NAME}) + var(${PILL_OUTLINE_WIDTH_VAR_NAME}), var(${PILL_RING_OFFSET_WIDTH_VAR_NAME}) + var(${PILL_RING_WIDTH_VAR_NAME}), var(${PILL_SHADOW_REACH_VAR_NAME}))`,
      ...(flavor === "tailwind"
        ? {
            // `border-dashed` and friends set `--tw-border-style`, so the
            // pill reads it rather than asking for a second source of truth.
            // Mapped here, on the element, because Tailwind registers it as
            // non-inheriting; the pseudo-elements inherit the result.
            [PILL_BORDER_STYLE_VAR_NAME]: `var(--tw-border-style, ${PILL_BORDER_STYLE_FALLBACK})`,
            // Likewise the outline's style, every ring setting Tailwind keeps
            // in a variable of its own, and its whole shadow list. Widths
            // aren't among them — a ring's is folded into its shadow — so
            // `tailwind-pill-border` mirrors those from the utilities.
            [PILL_OUTLINE_STYLE_VAR_NAME]: "var(--tw-outline-style, solid)",
            [PILL_RING_COLOR_VAR_NAME]: "var(--tw-ring-color, currentColor)",
            [PILL_RING_OFFSET_WIDTH_VAR_NAME]: "var(--tw-ring-offset-width, 0px)",
            [PILL_RING_OFFSET_COLOR_VAR_NAME]: "var(--tw-ring-offset-color, #fff)",
            [PILL_INSET_RING_COLOR_VAR_NAME]: "var(--tw-inset-ring-color, currentColor)",
            [PILL_BOX_SHADOW_VAR_NAME]: TAILWIND_BOX_SHADOW,
          }
        : {
            [PILL_RING_COLOR_VAR_NAME]: "currentColor",
            [PILL_RING_OFFSET_WIDTH_VAR_NAME]: "0px",
            [PILL_RING_OFFSET_COLOR_VAR_NAME]: "transparent",
            [PILL_INSET_RING_COLOR_VAR_NAME]: "currentColor",
            [PILL_BOX_SHADOW_VAR_NAME]: "none",
          }),
    },
    // Only once the worklet has actually loaded; see PILL_WORKLET_ATTRIBUTE.
    // `:where()` keeps the specificity that of the bare utility.
    [`:where(:root[${PILL_WORKLET_ATTRIBUTE}]) &`]: shaped(
      {
        "-webkit-mask-image": "paint(pill-shape)",
        "mask-image": "paint(pill-shape)",
        "-webkit-mask-size": "100% 100%",
        "mask-size": "100% 100%",
        "-webkit-mask-repeat": "no-repeat",
        "mask-repeat": "no-repeat",
        "mask-mode": "alpha",
      },
      { background: "paint(pill-decoration)" },
    ),
    // Without a worklet, `polyfillPills()` computes the same shape per
    // element as a `clip-path: path()`, and the decoration as an image — or,
    // for a single band, as a clip over its colour. Until they are computed
    // the background shows as a stadium.
    [`:where(:root[${PILL_POLYFILL_ATTRIBUTE}]) &`]: shaped(
      { "clip-path": `var(${PILL_CLIP_VAR_NAME}, none)` },
      {
        "background-image": `var(${PILL_DECORATION_VAR_NAME}, none)`,
        "background-size": "100% 100%",
        "background-repeat": "no-repeat",
        "clip-path": `var(${PILL_DECORATION_CLIP_VAR_NAME}, none)`,
      },
    ),
    // Hiding the element's own background and shadows, on a doubled selector
    // so it outranks a background or shadow utility, or a `background`
    // shorthand, on the same element whichever order they are emitted in.
    [`:where(:root[${PILL_WORKLET_ATTRIBUTE}], :root[${PILL_POLYFILL_ATTRIBUTE}]) &&`]: {
      "-webkit-background-clip": "text",
      "background-clip": "text",
      "box-shadow": "none",
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
