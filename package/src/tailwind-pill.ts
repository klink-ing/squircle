/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import plugin from "tailwindcss/plugin";
import { DEFAULT_AMOUNT_VAR_NAME, variantEntries } from "./variants";

export interface SquirclePillPluginOptions {
  /** CSS custom property name for the superellipse amount (default: "--pill-squircle-amt") */
  amtVar?: string;
  /** @plugin CSS alias for amtVar */
  "amt-var"?: string;
  /** Class name prefix for utilities (default: "squircle-pill") */
  prefix?: string;
}

const squirclePill: ReturnType<typeof plugin.withOptions<SquirclePillPluginOptions>> =
  plugin.withOptions<SquirclePillPluginOptions>((options = {}) => ({ addUtilities }) => {
    const amtVar = options.amtVar ?? options["amt-var"] ?? DEFAULT_AMOUNT_VAR_NAME;
    const prefix = options.prefix ?? "squircle-pill";

    // Base pill utility with automatic radius calculation
    const pillBase = {
      "data-squircle-pill": "",
      "@supports (background-image: paint(pill-shape))": {
        "background-image": "paint(pill-shape)",
      },
      "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))": {
        // A pill is a fully-rounded rectangle. `50%` resolves to an ellipse on
        // any non-square element, which is never the intended shape.
        "border-radius": "9999px",
        "corner-shape": `superellipse(var(${amtVar}, 2))`,
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
