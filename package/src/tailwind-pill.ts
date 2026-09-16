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
  PILL_EASE_SPREAD_VAR_NAME,
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

    const pillBase = {
      "@supports (background-image: paint(pill-shape))": {
        "background-image": "paint(pill-shape)",
        // The worklet only runs where there is an area to paint.
        "min-width": "1px",
        "min-height": "1px",
      },
      /*
       * Without the paint worklet, fall back to a plain fully-rounded
       * rectangle and nothing else. A superellipse corner reads as more
       * wrong than a stadium here: the cap is the whole shape, so reshaping
       * it changes the silhouette rather than just softening a corner.
       *
       * Gated only on the worklet being absent, so browsers with neither
       * feature still get a pill. The radius is the same `FULL_RADIUS` the
       * `-full` utilities use, matching Tailwind's `rounded-full`.
       */
      "@supports not (background-image: paint(pill-shape))": {
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
