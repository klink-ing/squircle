/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import plugin from "tailwindcss/plugin";
import { FULL_RADIUS, variantEntries } from "./variants";

export interface SquirclePillPluginOptions {
  /** Class name prefix for utilities (default: "squircle-pill") */
  prefix?: string;
}

const squirclePill: ReturnType<typeof plugin.withOptions<SquirclePillPluginOptions>> =
  plugin.withOptions<SquirclePillPluginOptions>((options = {}) => ({ addUtilities }) => {
    const prefix = options.prefix ?? "squircle-pill";

    const pillBase = {
      "data-squircle-pill": "",
      "@supports (background-image: paint(pill-shape))": {
        "background-image": "paint(pill-shape)",
      },
      /*
       * Without the paint worklet, fall back to a plain fully-rounded rectangle
       * and nothing else. A superellipse corner reads as more wrong than a
       * stadium here: the cap is the whole shape, so reshaping it changes the
       * silhouette rather than just softening a corner.
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
