/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

import { definePreset, type PropertyConfig } from "@pandacss/dev";
import {
  CAMEL_VARIANTS,
  DEFAULT_AMOUNT_VAR_NAME,
  NONE_RADIUS,
  SUPPORTS_RULE,
  variantEntries,
} from "./variants";

export interface SquirclePillPandaPresetOptions {
  /** CSS custom property name for the pill radius (default: "--pill-radius") */
  radiusVar?: string;
  /** CSS custom property name for the superellipse amount (default: "--squircle-amt") */
  amtVar?: string;
}

/**
 * Panda CSS preset for pill shapes with Houdini paint worklet support.
 * Follow the same pattern as the main squircle preset but with pill-specific rendering.
 */
export function squirclePillPandaPreset(options: SquirclePillPandaPresetOptions = {}) {
  const radiusVar = options.radiusVar ?? "--pill-radius";
  const amtVar = options.amtVar ?? DEFAULT_AMOUNT_VAR_NAME;

  const utilities: Record<string, PropertyConfig> = {};
  const variantBySuffix = new Map(variantEntries());

  for (const variant of CAMEL_VARIANTS) {
    const props = variantBySuffix.get(variant.suffix);
    if (!props) continue;

    utilities[`squirclePill${variant.property}`] = {
      shorthand: `sp${variant.shorthand}`,
      values: "radii",
      transform: (value: string) => {
        const paintSupport = {
          [radiusVar]: value,
          "--pill-width": "100%",
          "--pill-height": "100%",
          "data-squircle-pill": "",
          backgroundImage: "paint(pill-shape)",
        };

        const fallback: Record<string, unknown> = {};
        for (const p of props) {
          fallback[p] = value;
        }
        fallback["cornerShape"] = `superellipse(var(${amtVar}, 2))`;

        return {
          "@supports (background-image: paint(pill-shape))": paintSupport,
          "@supports (corner-shape: superellipse()) and not (background-image: paint(pill-shape))":
            fallback,
        };
      },
    };

    // Static -none variant
    utilities[`squirclePill${variant.property}None`] = {
      values: { none: NONE_RADIUS },
      transform: () => {
        const none: Record<string, string> = {};
        for (const p of props) {
          none[p] = NONE_RADIUS;
        }
        return none;
      },
    };
  }

  // Amount utility for pill transitions
  utilities["squirclePillAmt"] = {
    values: "numbers",
    transform: (value: string) => ({
      [amtVar]: value,
    }),
  };

  return definePreset({
    theme: { extend: { utilities } },
  });
}

export default squirclePillPandaPreset;
