/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import plugin from "tailwindcss/plugin";
import {
  DEFAULT_PILL_AMT,
  DEFAULT_PILL_EASE_SPREAD,
  FULL_RADIUS,
  PILL_AMT_VAR_NAME,
  PILL_BORDER_COLOR_VAR_NAME,
  PILL_BORDER_WIDTH_VAR_NAME,
  PILL_EASE_SPREAD_VAR_NAME,
  PILL_STROKE_WIDTH_VAR_NAME,
  variantEntries,
} from "./variants";

export interface SquirclePillPluginOptions {
  /** Class name prefix for utilities (default: "squircle-pill") */
  prefix?: string;
}

const squirclePill: ReturnType<typeof plugin.withOptions<SquirclePillPluginOptions>> =
  plugin.withOptions<SquirclePillPluginOptions>((options = {}) => ({ addBase, addUtilities }) => {
    const prefix = options.prefix ?? "squircle-pill";

    /*
     * Register the properties the worklet reads. The utility has to carry
     * these itself rather than lean on squircle-pill.css: that stylesheet
     * hangs its rules off `[data-squircle-pill]`, and no stylesheet can set
     * an attribute, so a class could never pull them in. Registering also
     * makes the values typed and animatable, with initial values matching
     * the worklet's own fallbacks.
     */
    addBase({
      [`@property ${PILL_AMT_VAR_NAME}`]: {
        syntax: '"<number>"',
        "initial-value": String(DEFAULT_PILL_AMT),
        inherits: "false",
      },
      [`@property ${PILL_EASE_SPREAD_VAR_NAME}`]: {
        syntax: '"<number>"',
        "initial-value": String(DEFAULT_PILL_EASE_SPREAD),
        inherits: "false",
      },
    });

    /*
     * The shape is applied as a mask, not painted as a background, so the
     * element keeps whatever background it already has — a colour, a gradient,
     * an image — and that background is what gets pill-shaped.
     *
     * A mask erases everything outside the shape, which no `border`, `outline`
     * or `box-shadow` can survive: a border would be a rectangle clipped to the
     * pill, and the other two are painted outside the box and vanish entirely.
     * `filter` is applied before the mask, so even `drop-shadow` set here would
     * shadow the unmasked rectangle and then be clipped away.
     *
     * A border is therefore drawn, on `::after`, by the same worklet in stroke
     * mode, which lays an inset band along the inside of the outline. For a
     * shadow, put `filter: drop-shadow(...)` on a wrapper, where it applies to
     * the already-masked result.
     */
    const mask = {
      "-webkit-mask-image": "paint(pill-shape)",
      "mask-image": "paint(pill-shape)",
      "-webkit-mask-size": "100% 100%",
      "mask-size": "100% 100%",
      "-webkit-mask-repeat": "no-repeat",
      "mask-repeat": "no-repeat",
      "mask-mode": "alpha",
    };

    const pillBase = {
      "@supports (mask-image: paint(pill-shape))": {
        ...mask,
        // The worklet only runs where there is an area to paint.
        "min-width": "1px",
        "min-height": "1px",
        position: "relative",

        "&::after": {
          content: '""',
          position: "absolute",
          inset: "0",
          "pointer-events": "none",
          background: `var(${PILL_BORDER_COLOR_VAR_NAME}, transparent)`,
          [PILL_STROKE_WIDTH_VAR_NAME]: `var(${PILL_BORDER_WIDTH_VAR_NAME}, 0px)`,
          ...mask,
        },
      },
      /*
       * Without the paint worklet, fall back to a plain fully-rounded rectangle
       * and nothing else. A superellipse corner reads as more wrong than a
       * stadium here: the cap is the whole shape, so reshaping it changes the
       * silhouette rather than just softening a corner.
       *
       * Gated only on the worklet being absent, so browsers with neither
       * feature still get a pill. The radius is the same `FULL_RADIUS` the
       * `-full` utilities use, matching Tailwind's `rounded-full`. Native
       * border, outline and box-shadow all work on this branch, because
       * border-radius is a shape the platform understands.
       */
      "@supports not (mask-image: paint(pill-shape))": {
        "border-radius": FULL_RADIUS,
      },
    };

    addUtilities({
      [`.${prefix}`]: pillBase,
    });

    // Side-specific variants
    for (const [suffix] of variantEntries()) {
      if (suffix) {
        // Only add side-specific variants, not the base
        addUtilities({
          [`.${prefix}-${suffix}`]: { ...pillBase },
        });
      }
    }
  });

export default squirclePill;
