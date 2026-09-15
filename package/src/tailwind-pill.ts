/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import plugin from "tailwindcss/plugin";
import {
  DEFAULT_AMOUNT_VAR_NAME,
  NONE_RADIUS,
  variantEntries,
} from "./variants";

export interface SquirclePillPluginOptions {
  /** CSS custom property name for the pill corner radius (default: "--pill-radius") */
  radiusVar?: string;
  /** @plugin CSS alias for radiusVar */
  "radius-var"?: string;
  /** CSS custom property name for the superellipse amount (default: "--pill-squircle-amt") */
  amtVar?: string;
  /** @plugin CSS alias for amtVar */
  "amt-var"?: string;
  /** Class name prefix for utilities (default: "squircle-pill") */
  prefix?: string;
}

const DEFAULT_RADIUS_VAR = "--pill-radius";

const squirclePill: ReturnType<typeof plugin.withOptions<SquirclePillPluginOptions>> =
  plugin.withOptions<SquirclePillPluginOptions>((options = {}) =>
    ({ addUtilities, matchUtilities, theme }) => {
      const radiusVar = options.radiusVar ?? options["radius-var"] ?? DEFAULT_RADIUS_VAR;
      const amtVar = options.amtVar ?? options["amt-var"] ?? DEFAULT_AMOUNT_VAR_NAME;
      const prefix = options.prefix ?? "squircle-pill";

      // Drop none/full from theme values
      const { none: _none, full: _full, ...radiusValues } = theme("borderRadius") ?? {};

      // Utility for setting the superellipse amount for pill transitions
      matchUtilities(
        { [`${prefix}-amt`]: (value: string) => ({ [amtVar]: value }) },
        { type: "number" },
      );

      for (const [suffix, props] of variantEntries()) {
        const name = suffix ? `${prefix}-${suffix}` : prefix;

        // Static -none utility
        addUtilities({
          [`.${name}-none`]: Object.fromEntries(props.map((p) => [p, NONE_RADIUS])),
        });

        // Dynamic radius utilities
        matchUtilities(
          {
            [name]: (value: string) => ({
              [radiusVar]: value,
              "--pill-width": "100%",
              "--pill-height": "100%",
              "data-squircle-pill": "",
              "@supports (background-image: paint(pill-shape))": {
                "background-image": "paint(pill-shape)",
              },
              "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))":
                {
                  "border-radius": value,
                  "corner-shape": `superellipse(var(${amtVar}, 2))`,
                },
            }),
          },
          { type: "length", values: radiusValues },
        );
      }
    },
  );

export default squirclePill;
